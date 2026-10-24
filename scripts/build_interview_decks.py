#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把《大模型老学员_高频面试题》3 个 md 拆成问答卡片，生成内置题库 JS。

切分逻辑（针对该套资料的排版）：
  - 章节层级：# 第X章 / ## x.y / ### x.y.z
  - 每个 ### 小节里，**（N）疑问句？** 视为一道题，其后的正文到下一条加粗疑问为止
  - 加粗但不是问句的（如 **（4.1）问题：**）保留在答案里
  - 没有加粗问句的小节：整节作为一张卡，题面用小节标题
  - 图片引用转成「（配图 imgXXX）」文字，避免卡片里出现裂图
  - 目录小节跳过

用法：
  python scripts/build_interview_decks.py --input <面试题目录>
  INTERVIEW_DIR=<面试题目录> python scripts/build_interview_decks.py
"""
import argparse
import json
import os
import re
from pathlib import Path

DEFAULT_INPUT = os.environ.get("INTERVIEW_DIR", "")
DEFAULT_OUT = str(Path(__file__).resolve().parent.parent / "src" / "bundled-decks.js")
BUNDLE_VERSION = "2026-10-23.1"

QUESTION_START = re.compile(
    r"^(?:什么是|是什么|为什么|为何|如何|怎么|怎样|请|简述|介绍|解释|说明|谈谈|聊聊|说说|列举|描述|对比|比较|区别|分析|设计|实现|"
    r"能否|是否|有哪些|哪些|可以|会不会|知不知道|有没有|大题|问题|Q)"
)
LIST_LABEL = re.compile(r"^[（(]\s*\d+(?:\.\d+)*\s*[）)]")
IMAGE_RE = re.compile(r"!\[\[([^\]]+)\]\]")
MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
HEAD_RE = re.compile(r"^(#{1,6})[ \t]+(.*)$")
BOLD_RE = re.compile(r"^\s*\*\*(.+?)\*\*\s*$")


def clean_title(text: str) -> str:
    t = re.sub(r"\*\*|`|__", "", text).strip()
    t = re.sub(r"^[（(]\s*\d+(?:\.\d+)*\s*[）)]\s*", "", t)
    return t.strip()


def is_question(text: str) -> bool:
    t = clean_title(text)
    if not t:
        return False
    if t.endswith("？") or t.endswith("?"):
        return True
    if QUESTION_START.match(t):
        return True
    if "？" in t and len(t) <= 120:
        return True
    return False


def strip_images(text: str) -> str:
    def repl(m):
        name = m.group(1).rstrip("/").split("/")[-1]
        return f"（配图 {name}）"
    text = IMAGE_RE.sub(repl, text)
    text = MD_IMAGE_RE.sub(lambda m: f"（配图 {m.group(2).rstrip('/').split('/')[-1]}）", text)
    return text


def split_file(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")
    lines = text.split("\n")

    cards = []
    chapter = ["", "", ""]  # h1, h2, h3
    cur = None
    in_code = False
    fence = ""
    in_toc = False

    def flush():
        nonlocal cur
        if cur and cur["answer"].strip():
            cards.append(cur)
        cur = None

    for raw in lines:
        line = raw.rstrip()
        fm = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fm:
            if not in_code:
                in_code = True
                fence = fm.group(1)[0]
            elif fm.group(1)[0] == fence:
                in_code = False
            if cur:
                cur["answer"] += "\n" + line
            continue
        if in_code:
            if cur:
                cur["answer"] += "\n" + line
            continue

        hm = HEAD_RE.match(line)
        if hm:
            level = len(hm.group(1))
            title = clean_title(hm.group(2))
            flush()
            if level == 1:
                in_toc = "目录" in title
                chapter = [title, "", ""]
            elif level == 2:
                chapter[1] = title
                chapter[2] = ""
            elif level == 3:
                chapter[2] = title
            else:
                # 四级标题并入当前答案（若有）
                if cur:
                    cur["answer"] += "\n" + line
                else:
                    chapter[2] = (chapter[2] + " / " + title).strip(" /")
            continue

        if in_toc:
            continue

        bm = BOLD_RE.match(line)
        if bm and is_question(bm.group(1)):
            flush()
            q = clean_title(bm.group(1))
            cur = {
                "title": q[:120],
                "question": "",
                "answer": "",
                "path": [p for p in chapter if p],
            }
            continue

        if cur:
            cur["answer"] += "\n" + line
        elif line.strip() and chapter[2]:
            # 小节开头、还没遇到加粗问句：先攒着
            cur = {
                "title": chapter[2],
                "question": "",
                "answer": line,
                "path": [p for p in chapter if p],
            }

    flush()

    # 整理：去掉多余空行、图片转文字、抑制目录/标题残留
    out = []
    for c in cards:
        body = c["answer"].replace("\n\n\n", "\n\n").strip()
        body = strip_images(body)
        if not body:
            continue
        out.append({
            "title": c["title"],
            "question": "",
            "answer": body,
            "path": c["path"],
        })
    return out


def main():
    ap = argparse.ArgumentParser(description="Split interview markdown files into bundled-decks.js")
    ap.add_argument("--input", default=DEFAULT_INPUT, help="folder containing the interview .md files (or set INTERVIEW_DIR)")
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    if not args.input:
        print("缺少 --input：请传入面试题 md 所在目录，或设置环境变量 INTERVIEW_DIR")
        return 2

    root = Path(args.input)
    files = sorted([p for p in root.glob("*.md")])
    if not files:
        raise SystemExit(f"没有找到 md：{root}")

    decks = []
    for f in files:
        cards = split_file(f)
        decks.append({
            "name": f.stem,
            "source": f.name,
            "mode": "ai",
            "cards": cards,
        })
        print(f"{f.name}: {len(cards)} 张卡")

    data = {"version": BUNDLE_VERSION, "generatedAt": "2026-10-23", "decks": decks}
    js = "/* generated by scripts/build_interview_decks.py - do not edit */\nwindow.MDReviewBundledDecks = " + json.dumps(data, ensure_ascii=False) + ";\n"
    out = Path(args.out)
    out.write_text(js, encoding="utf-8")
    total = sum(len(d["cards"]) for d in decks)
    print(f"共 {total} 张卡 -> {out}（{out.stat().st_size / 1024:.0f} KB）")
    return 0


if __name__ == "__main__":
    main()
