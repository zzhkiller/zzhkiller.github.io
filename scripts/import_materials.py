#!/usr/bin/env python3
"""Copy selected local material files into the public portal content folder."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "portal.config.json"
MATERIALS_ROOT = ROOT / "content" / "materials"
IMPORTED_ROOT = MATERIALS_ROOT / "imported"


def read_config() -> dict:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-")
    return slug or "materials"


def is_hidden_or_excluded(path: Path, base: Path, exclude_names: set[str]) -> bool:
    rel_parts = path.relative_to(base).parts
    return any(part.startswith(".") or part in exclude_names for part in rel_parts)


def copy_materials(source: Path, dry_run: bool, max_bytes: int) -> tuple[int, int]:
    config = read_config()
    include_exts = {ext.lower() for ext in config.get("includeExtensions", [])}
    exclude_names = set(config.get("excludeNames", []))
    copied = 0
    skipped = 0
    source = source.expanduser().resolve()

    if not source.exists():
      print(f"Skip missing source: {source}")
      return 0, 1

    target_group = IMPORTED_ROOT / slugify(source.name)
    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        resolved = path.resolve()
        if resolved == MATERIALS_ROOT.resolve() or MATERIALS_ROOT.resolve() in resolved.parents:
            skipped += 1
            continue
        if is_hidden_or_excluded(path, source, exclude_names):
            skipped += 1
            continue
        if path.suffix.lower() not in include_exts:
            skipped += 1
            continue
        if path.stat().st_size > max_bytes:
            skipped += 1
            continue

        rel = path.relative_to(source)
        destination = target_group / rel
        print(f"{'Would copy' if dry_run else 'Copy'}: {path} -> {destination}")
        copied += 1
        if not dry_run:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)

    return copied, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import selected public materials into the personal portal.")
    parser.add_argument("sources", nargs="+", help="Local folders to import from.")
    parser.add_argument("--dry-run", action="store_true", help="Preview what would be copied.")
    parser.add_argument("--max-mb", type=float, default=5, help="Skip files larger than this size. Default: 5 MB.")
    args = parser.parse_args()

    total_copied = 0
    total_skipped = 0
    max_bytes = int(args.max_mb * 1024 * 1024)
    for source in args.sources:
        copied, skipped = copy_materials(Path(source), args.dry_run, max_bytes)
        total_copied += copied
        total_skipped += skipped

    print(f"Done. {'Matched' if args.dry_run else 'Copied'} {total_copied} file(s), skipped {total_skipped}.")
    if not args.dry_run:
        print("Next: python3 scripts/collect_materials.py")


if __name__ == "__main__":
    main()

