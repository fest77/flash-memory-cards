#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 markdown 笔记批量转成「问题 + 答案」卡片 JSON，供手机端「导入 AI 卡片」使用。

特点：不需要服务器。脚本直接调用你自己填的 OpenAI 兼容 API：
  - 本机 Ollama（完全免费、不联网）
  - DeepSeek / 通义 / Kimi / OpenRouter 等任意 OpenAI 兼容接口

用法：
  # 1) 只看会拆出多少段（不调用 API，先验证切分）
  python scripts/ai_cards.py --input "D:/notes" --dry-run

  # 2) 本机 Ollama（推荐：零成本、无需联网；需加 --allow-local 放行本机地址）
  #    先 ollama pull qwen2.5:7b && ollama serve
  python scripts/ai_cards.py --input "D:/notes" --out ai-cards.json --allow-local \
      --base http://127.0.0.1:11434/v1 --model qwen2.5:7b

  # 3) DeepSeek 等云端 API（按 token 计费，不是租服务器）
  set DEEPSEEK_API_KEY=sk-xxx
  python scripts/ai_cards.py --input "D:/notes" --out ai-cards.json \
      --base https://api.deepseek.com/v1 --model deepseek-chat

生成的 ai-cards.json 传到手机，在网页里展开「AI 提炼设置」→「导入 AI 卡片」即可。
"""

import argparse
import ipaddress
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

DEFAULT_SYSTEM = (
    "你是资深技术面试官，负责把技术笔记整理成自测问题。要求："
    "1) 每个条目给出一句自然、具体、可用来自测的问题；"
    "2) 问题必须能从给定答案回答出来，不得编造答案里没有的内容；"
    "3) 标题本身已经是好问题时可以沿用或轻微润色；"
    "4) 只输出 JSON，不要任何解释，格式：{\"questions\":[{\"idx\":数字,\"q\":\"问题\"}]}"
)


# ----------------------------- markdown 切分 -----------------------------

def strip_front_matter(text: str) -> str:
    m = re.match(r"^---\n[\s\S]*?\n---[ \t]*(?:\n|$)", text)
    return text[m.end():] if m else text


def split_sections(text: str):
    """把 md 拆成 [{title, body, path}]，策略与应用端一致：优先 h2，其次 h3/h1。"""
    text = text.replace("\r\n", "\n").replace("\r", "\n").lstrip("\ufeff")
    text = strip_front_matter(text)
    lines = text.split("\n")

    in_code = False
    fence = ""
    headings = []
    for i, line in enumerate(lines):
        m = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if m:
            if not in_code:
                in_code, fence = True, m.group(1)[0]
            elif m.group(1)[0] == fence and not m.group(2).strip():
                in_code = False
            continue
        if in_code:
            continue
        hm = re.match(r"^ {0,3}(#{1,6})[ \t]+(.*)$", line)
        if hm:
            title = re.sub(r"[ \t]+#+[ \t]*$", "", hm.group(2)).strip()
            title = re.sub(r"[`*_~]", "", title)
            if title:
                headings.append({"index": i, "level": len(hm.group(1)), "title": title})

    def sections_at(level):
        out = []
        for k, h in enumerate(headings):
            if h["level"] != level:
                continue
            end = len(lines)
            for j in range(k + 1, len(headings)):
                if headings[j]["level"] <= level:
                    end = headings[j]["index"]
                    break
            chain, min_lv = [], level
            for b in range(k - 1, -1, -1):
                if headings[b]["level"] < min_lv:
                    chain.insert(0, headings[b]["title"])
                    min_lv = headings[b]["level"]
            body = "\n".join(lines[h["index"] + 1:end]).strip()
            out.append({"title": h["title"], "body": body, "path": chain})
        return out

    for level in (2, 3, 1):
        if sum(1 for h in headings if h["level"] == level) >= 2:
            return sections_at(level)
    if headings and len(headings) == 1:
        body = "\n".join(lines[headings[0]["index"] + 1:]).strip()
        return [{"title": headings[0]["title"], "body": body, "path": []}]
    return [{"title": "", "body": text.strip(), "path": []}]


def chunk_long(section, max_len=2200):
    body = section["body"]
    if len(body) <= max_len * 1.5:
        return [section]
    paras = [p for p in re.split(r"\n\s*\n", body) if p.strip()]
    chunks, cur = [], ""
    for p in paras:
        if cur and len(cur) + len(p) + 2 > max_len:
            chunks.append(cur)
            cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    if len(chunks) <= 1:
        return [section]
    out = []
    for i, c in enumerate(chunks):
        out.append({
            "title": f"{section['title']} ({i + 1}/{len(chunks)})".strip(),
            "body": c,
            "path": section["path"],
        })
    return out


# ----------------------------- API -----------------------------

def validate_url(base: str, allow_local: bool = False) -> str:
    """校验 API 地址：仅允许 http/https，默认拒绝解析到内网/环回/链路本地/保留地址的
    主机（防 SSRF）；--allow-local 显式放行（本机 Ollama 等文档化用法）。"""
    url = base.rstrip("/") + "/chat/completions"
    parts = urlparse(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise SystemExit(f"API 地址必须是合法的 http(s) URL，收到：{base!r}")
    if not allow_local:
        try:
            infos = socket.getaddrinfo(parts.hostname, None, proto=socket.IPPROTO_TCP)
        except socket.gaierror as e:
            raise SystemExit(f"无法解析 API 主机名 {parts.hostname!r}：{e}")
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
                raise SystemExit(
                    f"拒绝访问内网/环回地址 {ip}（如需调用本机 Ollama 等本地服务，请加 --allow-local）"
                )
    return url


def call_api(base, model, key, messages, timeout=120, allow_local=False):
    url = validate_url(base, allow_local=allow_local)
    body = json.dumps({
        "model": model,
        "temperature": 0.2,
        "max_tokens": 2000,
        "messages": messages,
    }).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read().decode("utf-8", "replace")
    data = json.loads(raw)
    content = data["choices"][0]["message"]["content"]
    if not content:
        raise RuntimeError("返回里没有 content")
    return content


def parse_questions(content: str):
    text = str(content or "")
    m = re.search(r"\[[\s\S]*\]", text)
    arr = None
    if m:
        try:
            arr = json.loads(m.group(0))
        except Exception:
            arr = None
    if not isinstance(arr, list):
        m2 = re.search(r"\{[\s\S]*\}", text)
        if m2:
            try:
                obj = json.loads(m2.group(0))
                if isinstance(obj, dict) and isinstance(obj.get("questions"), list):
                    arr = obj["questions"]
            except Exception:
                arr = None
    if not isinstance(arr, list):
        return []
    out = []
    for item in arr:
        if isinstance(item, str):
            out.append({"idx": None, "q": item})
        elif isinstance(item, dict):
            out.append({
                "idx": item.get("idx", item.get("i")),
                "q": item.get("q") or item.get("question") or "",
            })
    return [x for x in out if x["q"]]


def refine_batch(items, base, model, key, retries=2, allow_local=False):
    payload = [{"idx": i, "title": it["title"], "answer": it["body"][:2500]} for i, it in enumerate(items)]
    messages = [
        {"role": "system", "content": DEFAULT_SYSTEM},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    last_err = None
    for attempt in range(retries + 1):
        try:
            content = call_api(base, model, key, messages, allow_local=allow_local)
            qs = parse_questions(content)
            if not qs:
                raise RuntimeError("模型返回的 JSON 无法解析")
            no_idx = all(q.get("idx") is None for q in qs)
            out = {}
            for pos, q in enumerate(qs):
                idx = pos if no_idx else int(q["idx"]) if q.get("idx") is not None else pos
                if 0 <= idx < len(items) and q["q"].strip():
                    out[idx] = q["q"].strip()
            if not out:
                raise RuntimeError("没有解析出任何问题")
            return out
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"调用失败：{last_err}")


# ----------------------------- 主流程 -----------------------------

def iter_md_files(root: Path):
    if root.is_file():
        yield root
        return
    for p in sorted(root.rglob("*")):
        if p.suffix.lower() in (".md", ".markdown", ".txt"):
            yield p


def main():
    ap = argparse.ArgumentParser(description="markdown 笔记 → AI 卡片 JSON")
    ap.add_argument("--input", required=True, help="md 文件或目录")
    ap.add_argument("--out", default="ai-cards.json", help="输出 JSON 路径")
    ap.add_argument("--base", default=os.environ.get("OPENAI_BASE_URL", ""), help="API 地址，如 https://api.deepseek.com/v1 或 http://127.0.0.1:11434/v1")
    ap.add_argument("--model", default=os.environ.get("OPENAI_MODEL", ""), help="模型名")
    ap.add_argument("--key", default=os.environ.get("OPENAI_API_KEY", "") or os.environ.get("DEEPSEEK_API_KEY", ""), help="API Key（Ollama 可留空）")
    ap.add_argument("--batch-chars", type=int, default=4000, help="每批送进模型的字符上限")
    ap.add_argument("--batch-items", type=int, default=6, help="每批最多几条")
    ap.add_argument("--dry-run", action="store_true", help="只切分、不调用 API")
    ap.add_argument("--allow-local", action="store_true",
                    help="允许调用内网/环回地址（本机 Ollama 用；默认拒绝以防误请求内网）")
    args = ap.parse_args()

    root = Path(args.input)
    if not root.exists():
        print(f"输入不存在：{root}")
        return 2

    files = list(iter_md_files(root))
    if not files:
        print("没有找到 md 文件")
        return 2

    decks = []
    total_sections = 0
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        sections = []
        for sec in split_sections(text):
            sections.extend(chunk_long(sec))
        sections = [s for s in sections if s["body"].strip()]
        total_sections += len(sections)
        print(f"· {f.name}: {len(sections)} 段")
        if args.dry_run:
            for s in sections[:5]:
                print(f"    - {s['title'] or '(无标题)'} · {len(s['body'])} 字")
            continue
        if not sections:
            continue

        # 分批
        batches, cur, cur_len = [], [], 0
        for sec in sections:
            ln = len(sec["title"]) + len(sec["body"])
            if cur and (cur_len + ln > args.batch_chars or len(cur) >= args.batch_items):
                batches.append(cur)
                cur, cur_len = [], 0
            cur.append(sec)
            cur_len += ln
        if cur:
            batches.append(cur)

        cards = []
        for bi, batch in enumerate(batches, 1):
            print(f"  [{f.name}] 批次 {bi}/{len(batches)}（{len(batch)} 段）…", flush=True)
            try:
                mapping = refine_batch(batch, args.base, args.model, args.key,
                                       allow_local=args.allow_local)
            except Exception as e:  # noqa: BLE001
                print(f"    跳过（{e}）")
                mapping = {}
            for i, sec in enumerate(batch):
                q = mapping.get(i, "")
                cards.append({
                    "title": sec["title"] or f.stem,
                    "question": q,
                    "answer": sec["body"],
                    "path": sec["path"],
                })
        if cards:
            decks.append({"name": f.stem, "title": f.stem, "cards": cards})

    if args.dry_run:
        print(f"\n共 {len(files)} 个文件 / {total_sections} 段。加上 --out 和 API 参数即可生成卡片。")
        return 0

    if not args.base or not args.model:
        print("\n缺少参数：--base 和 --model（或用环境变量 OPENAI_BASE_URL / OPENAI_MODEL）。")
        print("本机 Ollama 示例：--allow-local --base http://127.0.0.1:11434/v1 --model qwen2.5:7b")
        print("云端示例：--base https://api.deepseek.com/v1 --model deepseek-chat")
        return 2

    out = {"app": "md-review-ai", "version": 1, "decks": decks}
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    n = sum(len(d["cards"]) for d in decks)
    print(f"\n已生成 {args.out}：{len(decks)} 个笔记 / {n} 张卡片")
    print("把该文件传到手机 → 网页「AI 提炼设置」→「导入 AI 卡片」。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
