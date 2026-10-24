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


def build(images_path: str, out_path: str) -> pathlib.Path:
    tpl = read("index.tpl.html")
    css = read("styles.css")
    core = read("core.js")
    app = read("app.js")
    bundled = read_bundled()
    images = read_images(images_path)

    for label, code in (("app.js", app), ("core.js", core), ("bundled-decks.js", bundled), ("images", images)):
        if "</script" in code.lower():
            raise SystemExit("%s contains </script> which would break inlining" % label)

    out = tpl.replace("/*STYLES*/", css)
    out = out.replace("/*IMAGES*/", images)
    out = out.replace("/*BUNDLED*/", bundled)
    out = out.replace("/*CORE*/", core)
    out = out.replace("/*APP*/", app)

    missing = [m for m in ("/*STYLES*/", "/*IMAGES*/", "/*BUNDLED*/", "/*CORE*/", "/*APP*/") if m in out]
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
