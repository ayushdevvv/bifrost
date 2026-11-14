"""Contract test for the remote RIFT read-only MCP surface."""
from __future__ import annotations

import re
import unittest
from pathlib import Path


class McpSurfaceContractTests(unittest.TestCase):
    def test_all_mcp_tools_are_annotated_read_only(self):
        source_path = Path(__file__).resolve().parents[1] / "main.py"
        source = source_path.read_text(encoding="utf-8")
        block = source.split("# Remote MCP connector", 1)[1].split("# Static files are optional.", 1)[0]
        tools = re.findall(r"@MCP_SERVER\.tool\(annotations=_MCP_READ_ONLY\)\s+def (rift_[a-z0-9_]+)\(", block)
        self.assertEqual(len(tools), 21, tools)
        self.assertEqual(len(set(tools)), 21)
        self.assertNotIn("rift_create_experiment", tools)
        self.assertNotIn("rift_cancel_run", tools)
        self.assertNotIn("rift_update_settings", tools)
        self.assertNotIn("rift_register_agent", tools)
        self.assertNotIn("@MCP_SERVER.tool()", block)

    def test_mcp_discovery_resources_and_prompt_are_registered(self):
        source_path = Path(__file__).resolve().parents[1] / "main.py"
        source = source_path.read_text(encoding="utf-8")
        block = source.split("# Remote MCP connector", 1)[1].split("# Static files are optional.", 1)[0]
        self.assertIn('@MCP_SERVER.resource("rift://workspace/catalog")', block)
        self.assertIn('@MCP_SERVER.resource("rift://benchmark/tasks")', block)
        self.assertIn("@MCP_SERVER.prompt()", block)


if __name__ == "__main__":
    unittest.main()
