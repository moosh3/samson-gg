import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "scripts" / "build_anonymous_graph.py"


def load_builder():
    spec = importlib.util.spec_from_file_location("build_anonymous_graph", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AnonymousGraphTests(unittest.TestCase):
    def test_emits_opaque_nodes_and_internal_edges_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            brain = Path(tmp) / "brain"
            (brain / "projects").mkdir(parents=True)
            (brain / "concepts").mkdir()
            (brain / "projects" / "secret-project.md").write_text(
                "# Secret project\n\nLinks [[concepts/important-idea]].\n",
                encoding="utf-8",
            )
            (brain / "concepts" / "important-idea.md").write_text(
                "# Important idea\n",
                encoding="utf-8",
            )
            graph = load_builder().build_graph(brain)

        self.assertEqual(len(graph["nodes"]), 2)
        self.assertEqual(len(graph["edges"]), 1)
        self.assertEqual(set(graph["nodes"][0]), {"id", "hue"})
        self.assertEqual(set(graph["edges"][0]), {"source", "target"})
        serialized = json.dumps(graph)
        self.assertNotIn("secret-project", serialized)
        self.assertNotIn("important-idea", serialized)
        self.assertNotIn("title", serialized)
        self.assertNotIn("path", serialized)
        self.assertNotIn("slug", serialized)

    def test_keeps_archive_fanout_and_isolated_nodes(self):
        with tempfile.TemporaryDirectory() as tmp:
            brain = Path(tmp) / "brain"
            brain.mkdir()
            links = []
            for index in range(41):
                name = f"leaf-{index}"
                (brain / f"{name}.md").write_text("# Leaf", encoding="utf-8")
                links.append(f"[[{name}]]")
            (brain / "indexer.md").write_text(" ".join(links), encoding="utf-8")
            (brain / "pair-a.md").write_text("[[pair-b]]", encoding="utf-8")
            (brain / "pair-b.md").write_text("# Pair", encoding="utf-8")

            graph = load_builder().build_graph(brain)

        self.assertEqual(len(graph["nodes"]), 44)
        self.assertEqual(len(graph["edges"]), 42)

    def test_ignores_readmes_and_unresolved_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            brain = Path(tmp) / "brain"
            brain.mkdir()
            (brain / "readme.md").write_text("# Not a node", encoding="utf-8")
            (brain / "idea.md").write_text("[[missing]]", encoding="utf-8")
            graph = load_builder().build_graph(brain)

        self.assertEqual(len(graph["nodes"]), 1)
        self.assertEqual(graph["edges"], [])


if __name__ == "__main__":
    unittest.main()
