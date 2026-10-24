from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable

@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    function: Callable[..., Any]
    aliases: list[str] = field(default_factory=list)

    def to_openai_schema(self) -> dict[str, Any]:
        """Convert tool declaration into OpenAI/Mistral function calling tool schema."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

    def to_summary_dict(self) -> dict[str, Any]:
        """Convert tool to client telemetry & settings summary dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "aliases": self.aliases,
        }
