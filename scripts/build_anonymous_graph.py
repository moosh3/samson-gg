#!/usr/bin/env python3
"""Build a text-free, anonymous public graph from a local GBrain tree.

The emitted JSON intentionally contains only opaque node IDs, display hues, and
anonymous edges. Never add titles, paths, slugs, tags, source IDs, or body text.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

WIKILINK = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")
HUES = [198, 252, 292, 166, 32, 338]


def source_files(brain: Path) -> list[Path]:
    return sorted(
        path
        for path in brain.rglob("*.md")
        if path.name.lower() not in {"readme.md", "index.md"}
    )


def build_graph(brain: Path) -> dict[str, list[dict[str, Any]]]:
    """Return an anonymous graph for every non-resolver Markdown page."""
    files = source_files(brain)
    relative = {path.relative_to(brain).with_suffix("").as_posix(): path for path in files}
    node_id = {path: f"n{index:04d}" for index, path in enumerate(files, start=1)}

    nodes = [
        {"id": node_id[path], "hue": HUES[(index - 1) % len(HUES)]}
        for index, path in enumerate(files, start=1)
    ]
    edges: set[tuple[str, str]] = set()
    for path in files:
        text = path.read_text(encoding="utf-8")
        for match in WIKILINK.finditer(text):
            target_key = match.group(1).strip().removesuffix(".md").lstrip("/")
            target = relative.get(target_key)
            if target and target != path:
                edges.add((node_id[path], node_id[target]))

    return {
        "nodes": nodes,
        "edges": [
            {"source": source, "target": target}
            for source, target in sorted(edges)
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--brain", type=Path, default=Path.home() / "brain")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    graph = build_graph(args.brain)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(graph, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {len(graph['nodes'])} nodes and {len(graph['edges'])} edges to {args.output}")


if __name__ == "__main__":
    main()
