#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Inline src/* into a single self-contained HTML file (dist/md-flashcards.html).

--images / --out 仍可用于本地生成带题库/自定义输出的变体（变体文件不入库）。
"""
import argparse
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent      # scripts/
PROJECT = ROOT.parent
SRC = PROJECT / "src"
DIST = PROJECT / "dist"


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def read_bundled() -> str:
    path = SRC / "bundled-decks.js"
    if not path.exists():
        return "window.MDReviewBundledDecks = null;"
    return path.read_text(encoding="utf-8")


def read_images(path: str) -> str:
    if path == "none":
        return "window.MDReviewBundledImages = null;"
    p = pathlib.Path(path)
    if not p.is_absolute():
        p = PROJECT / p
    if not p.exists():
        return "window.MDReviewBundledImages = null;"
    return p.read_text(encoding="utf-8")


def read_katex() -> str:
    """KaTeX 本地化：JS + CSS（字体转 base64 内联，保持单文件离线）。vendor 缺失时降级为空（公式原样显示）。"""
    import base64, re as _re
    vdir = PROJECT / "vendor" / "katex"
    js_path = vdir / "katex.min.js"
    css_path = vdir / "katex.min.css"
    if not js_path.exists() or not css_path.exists():
        return "window.katex = null;"
    js = js_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    # fonts url(fonts/xxx.woff2) → data URI；缺失字体从 CSS 中剔除该 @font-face（子集化）
    faces = css.split("@font-face")
    keep = []
    for face in faces:
        m = _re.search(r"url\(fonts/([A-Za-z0-9_\-]+)\.woff2\)", face)
        if not m:
            if face.strip():
                keep.append(face)
            continue
        f = vdir / "fonts" / (m.group(1) + ".woff2")
        if not f.exists():
            continue  # 未打包的字体：丢弃该 face（浏览器回退系统字体）
        b64 = base64.b64encode(f.read_bytes()).decode("ascii")
        face = face.replace(m.group(0), "url(data:font/woff2;base64," + b64 + ")")
        keep.append(face)
    css = "@font-face".join(keep)
    return ("(function(){var d=document;var st=d.createElement('style');"
            "st.textContent=" + json_js_string(css) + ";d.head.appendChild(st);\n"
            + js + "\n})();")


def json_js_string(text: str) -> str:
    import json
    return json.dumps(text)


def build(images_path: str, out_path: str) -> pathlib.Path:
    tpl = read("index.tpl.html")
    css = read("styles.css")
    core = read("core.js")
    app = read("app.js")
    bundled = read_bundled()
    images = read_images(images_path)
    katex = read_katex()

    for label, code in (("app.js", app), ("core.js", core), ("bundled-decks.js", bundled), ("images", images)):
        if "</script" in code.lower():
            raise SystemExit("%s contains </script> which would break inlining" % label)

    out = tpl.replace("/*STYLES*/", css)
    out = out.replace("/*IMAGES*/", images)
    out = out.replace("/*BUNDLED*/", bundled)
    out = out.replace("/*KATEX*/", katex)
    out = out.replace("/*CORE*/", core)
    out = out.replace("/*APP*/", app)

    missing = [m for m in ("/*STYLES*/", "/*IMAGES*/", "/*BUNDLED*/", "/*KATEX*/", "/*CORE*/", "/*APP*/") if m in out]
    if missing:
        raise SystemExit("template placeholders not replaced: %s" % missing)

    target = pathlib.Path(out_path)
    if not target.is_absolute():
        target = PROJECT / target
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(out, encoding="utf-8")

    print("built %s (%.1f KB)" % (target, target.stat().st_size / 1024))
    return target


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", default="src/bundled-images.js",
                    help="bundled images JS path, or 'none'")
    ap.add_argument("--out", default="dist/md-flashcards.html")
    args = ap.parse_args()
    build(args.images, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
