#!/usr/bin/env python3
"""Build the public search index for the personal portal."""

from __future__ import annotations

import csv
import datetime as dt
import html
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "portal.config.json"
INDEX_PATH = ROOT / "data" / "search-index.json"


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def flatten_json(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(flatten_json(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(flatten_json(item) for item in value)
    return str(value)


def strip_html(text: str) -> str:
    without_tags = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    without_tags = re.sub(r"<style\b[^>]*>.*?</style>", " ", without_tags, flags=re.I | re.S)
    without_tags = re.sub(r"<[^>]+>", " ", without_tags)
    return html.unescape(without_tags)


def strip_markdown(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^[#>*\-\s]+", "", text, flags=re.M)
    return text


def compact(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text

    meta: dict[str, Any] = {}
    raw = text[4:end].strip()
    body = text[end + 4 :].lstrip()
    for line in raw.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if value.startswith("[") and value.endswith("]"):
            meta[key] = [item.strip().strip('"').strip("'") for item in value[1:-1].split(",") if item.strip()]
        elif "," in value and key in {"tags", "keywords"}:
            meta[key] = [item.strip() for item in value.split(",") if item.strip()]
        else:
            meta[key] = value
    return meta, body


def markdown_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        match = re.match(r"^#\s+(.+)", line.strip())
        if match:
            return match.group(1).strip()
    return fallback


def extract(path: Path, max_text_chars: int) -> tuple[dict[str, Any], str]:
    ext = path.suffix.lower()
    raw = read_text(path)
    meta: dict[str, Any] = {}

    if ext in {".md", ".markdown"}:
        meta, body = parse_frontmatter(raw)
        text = compact(strip_markdown(body))
        meta.setdefault("title", markdown_title(body, path.stem))
    elif ext == ".json":
        try:
            payload = json.loads(raw)
            text = compact(flatten_json(payload))
            if isinstance(payload, dict):
                meta = {key: payload[key] for key in ("title", "summary", "date", "tags", "type", "url") if key in payload}
        except json.JSONDecodeError:
            text = compact(raw)
    elif ext == ".csv":
        rows = []
        for row in csv.reader(raw.splitlines()):
            rows.extend(cell for cell in row if cell)
        text = compact(" ".join(rows))
    elif ext == ".html":
        text = compact(strip_html(raw))
        title_match = re.search(r"<title[^>]*>(.*?)</title>", raw, flags=re.I | re.S)
        if title_match:
            meta["title"] = compact(strip_html(title_match.group(1)))
    else:
        text = compact(raw)

    return meta, text[:max_text_chars]


def should_skip(path: Path, root: Path, exclude_names: set[str], include_exts: set[str]) -> bool:
    rel_parts = path.relative_to(root).parts
    if any(part.startswith(".") and part != "." for part in rel_parts):
        return True
    if any(part in exclude_names for part in rel_parts):
        return True
    return path.suffix.lower() not in include_exts


def excerpt(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    trimmed = text[: max_chars + 1].rsplit(" ", 1)[0]
    return f"{trimmed}..."


def normalize_tags(value: Any) -> list[str]:
    if isinstance(value, list):
        tags = value
    elif isinstance(value, str):
        tags = [item.strip() for item in value.split(",")]
    else:
        tags = []
    return sorted({str(tag).strip() for tag in tags if str(tag).strip()})


def build_document(path: Path, source_root: Path, config: dict[str, Any]) -> dict[str, Any]:
    meta, text = extract(path, int(config.get("maxTextChars", 12000)))
    stat = path.stat()
    rel = path.relative_to(ROOT).as_posix()
    tags = normalize_tags(meta.get("tags") or meta.get("keywords"))
    if not tags:
        tags = [part for part in path.relative_to(source_root).parts[:-1] if not part.startswith(".")]

    return {
        "title": str(meta.get("title") or path.stem).strip(),
        "summary": str(meta.get("summary") or excerpt(text, int(config.get("maxExcerptChars", 220)))).strip(),
        "type": str(meta.get("type") or path.suffix.lower().lstrip(".") or "资料").strip(),
        "tags": tags,
        "date": str(meta.get("date") or "").strip(),
        "updatedAt": dt.datetime.fromtimestamp(stat.st_mtime, dt.timezone.utc).isoformat(),
        "path": rel,
        "url": str(meta.get("url") or rel).strip(),
        "text": text,
    }


def main() -> None:
    config = read_json(CONFIG_PATH, {})
    profile = read_json(ROOT / config.get("profile", "content/profile.json"), {})
    include_exts = {item.lower() for item in config.get("includeExtensions", [])}
    exclude_names = set(config.get("excludeNames", []))
    documents: list[dict[str, Any]] = []

    for source in config.get("sourceDirs", []):
        source_root = (ROOT / source).resolve()
        if not source_root.exists():
            continue
        for path in sorted(source_root.rglob("*")):
            if not path.is_file():
                continue
            if should_skip(path, ROOT, exclude_names, include_exts):
                continue
            documents.append(build_document(path, source_root, config))

    tags = sorted({tag for doc in documents for tag in doc.get("tags", [])})
    types: dict[str, int] = {}
    for doc in documents:
        doc_type = doc.get("type") or "资料"
        types[doc_type] = types.get(doc_type, 0) + 1

    index = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "site": config.get("site", {}),
        "profile": profile,
        "documents": documents,
        "stats": {
            "count": len(documents),
            "tags": tags,
            "types": types,
        },
    }

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Indexed {len(documents)} public material file(s).")


if __name__ == "__main__":
    main()

