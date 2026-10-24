from __future__ import annotations
import asyncio
import inspect
import logging
from typing import Any

from src.tools.base import Tool
from src.tools.builtins import BUILTIN_TOOLS
from src import config

logger = logging.getLogger(__name__)

class ToolRegistry:
    """Manages tool registration, resilient alias lookup, and safe asynchronous execution."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}
        for tool in BUILTIN_TOOLS:
            self.register(tool)

    def register(self, tool: Tool):
        self._tools[tool.name] = tool
        for alias in tool.aliases:
            self._tools[alias] = tool

    def get_tool(self, name: str) -> Tool | None:
        """Resiliently lookup a tool by its exact name or common alias variations."""
        if not name:
            return None
        cleaned = name.strip()
        tool = self._tools.get(cleaned)
        if tool:
            return tool

        # Resilient mapping for discovery tool variations
        if cleaned.lower() in ("get_tool_list", "tool_list", "tools_list", "list_tools", "get_tools", "tools"):
            return self._tools.get("get_available_tools") or self._tools.get("get_tool_list")
        if cleaned.lower() in ("get_available_tools", "available_tools", "active_tools"):
            return self._tools.get("get_available_tools")

        return None

    def get_all_tools(self) -> list[Tool]:
        """Returns unique tool definitions (deduping aliases)."""
        seen: set[str] = set()
        unique: list[Tool] = []
        for t in self._tools.values():
            if t.name not in seen:
                seen.add(t.name)
                unique.append(t)
        return unique

    def get_openai_tools(self) -> list[dict[str, Any]]:
        """Return all tools in standard OpenAI function calling tool definition format."""
        return [tool.to_openai_schema() for tool in self.get_all_tools()]

    def get_tools_summary(self) -> list[dict[str, Any]]:
        """Return all tools summarized for the client UI."""
        return [tool.to_summary_dict() for tool in self.get_all_tools()]

    async def execute_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool safely with timeout protection."""
        tool = self.get_tool(name)
        if not tool:
            return {
                "status": "error",
                "error": f"Tool '{name}' is not registered. Execute 'get_available_tools' to see valid tools.",
            }

        logger.info("Executing tool: %s with arguments: %s", tool.name, arguments)

        try:
            func = tool.function
            timeout = config.TOOL_EXECUTION_TIMEOUT

            if inspect.iscoroutinefunction(func):
                result = await asyncio.wait_for(func(**arguments), timeout=timeout)
            else:
                loop = asyncio.get_running_loop()
                result = await asyncio.wait_for(loop.run_in_executor(None, lambda: func(**arguments)), timeout=timeout)

            return result if isinstance(result, dict) else {"status": "success", "result": result}
        except asyncio.TimeoutError:
            logger.error("Tool '%s' timed out after %.1fs", tool.name, config.TOOL_EXECUTION_TIMEOUT)
            return {"status": "error", "error": f"Tool '{tool.name}' timed out after {config.TOOL_EXECUTION_TIMEOUT}s."}
        except Exception as e:
            logger.exception("Error executing tool '%s': %s", tool.name, e)
            return {"status": "error", "error": f"Tool execution failed: {e}"}

tool_registry = ToolRegistry()
