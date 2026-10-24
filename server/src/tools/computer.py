"""
computer.py - Koko AI computer-use tools
Gives Koko the ability to interact with the host PC:
  - run_bash         : Execute a shell command and capture output
  - read_file        : Read a file text content (with byte-limit cap)
  - write_file       : Overwrite or create a file with given content
  - edit_file        : Replace an exact string inside a file (safe surgical edit)
  - delete_file      : Delete a single file
  - list_directory   : List files/dirs in a path with type + size info
  - find_files       : Glob-search for files matching a pattern under a root
  - get_processes    : List running processes (name + PID + CPU/mem)
"""
from __future__ import annotations

import glob
import logging
import os
import platform
import subprocess
from pathlib import Path
from typing import Any

from src.tools.base import Tool
from src import config as _cfg

logger = logging.getLogger(__name__)

_ENABLED: bool = os.getenv("COMPUTER_TOOLS_ENABLED", "True").lower() == "true"
_BASH_TIMEOUT: float = float(os.getenv("MAX_BASH_TIMEOUT", "30"))
_MAX_READ_BYTES: int = int(os.getenv("MAX_FILE_READ_KB", "128")) * 1024
_MAX_WRITE_BYTES: int = int(os.getenv("MAX_FILE_WRITE_KB", "512")) * 1024

_raw_bash_dirs = os.getenv("BASH_ALLOWED_DIRS", "")
_raw_file_dirs = os.getenv("FILE_ALLOWED_DIRS", "")
BASH_ALLOWED_DIRS: list[str] = [d.strip() for d in _raw_bash_dirs.split(",") if d.strip()]
FILE_ALLOWED_DIRS: list[str] = [d.strip() for d in _raw_file_dirs.split(",") if d.strip()]
_IS_WINDOWS = platform.system() == "Windows"


def _disabled() -> dict[str, Any]:
    return {"status": "error", "error": "Computer tools are disabled. Set COMPUTER_TOOLS_ENABLED=True in .env to enable."}


def _check_path_allowed(path_str: str, allowed: list[str]) -> tuple[bool, str]:
    try:
        resolved = str(Path(path_str).resolve())
    except Exception as e:
        return False, str(e)
    if not allowed:
        return True, resolved
    for root in allowed:
        try:
            if resolved.startswith(str(Path(root).resolve())):
                return True, resolved
        except Exception:
            continue
    return False, resolved


def _truncate(text: str, max_chars: int = 4000, label: str = "output") -> str:
    if len(text) <= max_chars:
        return text
    half = max_chars // 2
    omitted = len(text) - max_chars
    return text[:half] + f"\n\n... [{omitted} chars omitted] ...\n\n" + text[-half:]


# --- 1. run_bash ---
def _run_bash_impl(command: str, working_dir: str | None = None, timeout: float | None = None) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    cwd = working_dir or os.getcwd()
    ok, resolved_cwd = _check_path_allowed(cwd, BASH_ALLOWED_DIRS)
    if not ok:
        return {"status": "error", "error": f"Working directory '{cwd}' is not in BASH_ALLOWED_DIRS."}
    effective_timeout = min(float(timeout or _BASH_TIMEOUT), _BASH_TIMEOUT)
    shell_args = ["powershell", "-NonInteractive", "-Command", command] if _IS_WINDOWS else ["bash", "-c", command]
    try:
        result = subprocess.run(shell_args, capture_output=True, text=True, timeout=effective_timeout, cwd=resolved_cwd)
        return {
            "status": "success" if result.returncode == 0 else "error",
            "exit_code": result.returncode,
            "stdout": _truncate(result.stdout.strip(), label="stdout"),
            "stderr": _truncate(result.stderr.strip(), label="stderr"),
            "command": command,
            "working_dir": resolved_cwd,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": f"Command timed out after {effective_timeout}s.", "command": command}
    except Exception as e:
        return {"status": "error", "error": str(e), "command": command}

tool_run_bash = Tool(
    name="run_bash",
    description=(
        "Execute a shell command on the host PC and return stdout, stderr, and exit code. "
        "Uses PowerShell on Windows, bash on Linux/macOS. Use for running scripts, installing packages, "
        "git operations, building code, checking services, or any system automation."
    ),
    parameters={
        "type": "object",
        "properties": {
            "command": {"type": "string", "description": "Shell command to execute (PowerShell on Windows, bash on Linux/macOS)."},
            "working_dir": {"type": "string", "description": "Optional absolute working directory path (defaults to server cwd)."},
            "timeout": {"type": "number", "description": f"Max seconds to wait (default {_BASH_TIMEOUT}, hard cap {_BASH_TIMEOUT}s)."},
        },
        "required": ["command"],
    },
    function=_run_bash_impl,
    aliases=["bash", "shell", "exec", "execute_command", "run_command"],
)


# --- 2. read_file ---
def _read_file_impl(path: str, start_line: int | None = None, end_line: int | None = None) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    ok, resolved = _check_path_allowed(path, FILE_ALLOWED_DIRS)
    if not ok:
        return {"status": "error", "error": f"Path '{path}' is not in FILE_ALLOWED_DIRS."}
    try:
        p = Path(resolved)
        if not p.exists():
            return {"status": "error", "error": f"File not found: {resolved}"}
        if not p.is_file():
            return {"status": "error", "error": f"Not a file: {resolved}"}
        size = p.stat().st_size
        if size > _MAX_READ_BYTES and start_line is None and end_line is None:
            return {"status": "error", "error": f"File is {size // 1024} KB (limit {_MAX_READ_BYTES // 1024} KB). Use start_line/end_line."}
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
        total_lines = len(lines)
        if start_line is not None or end_line is not None:
            s = max(0, (start_line or 1) - 1)
            e = min(total_lines, end_line or total_lines)
            content = "".join(lines[s:e])
            return {"status": "success", "path": resolved, "total_lines": total_lines, "returned_lines": f"{s+1}-{e}", "content": _truncate(content)}
        return {"status": "success", "path": resolved, "total_lines": total_lines, "size_bytes": size, "content": _truncate("".join(lines))}
    except Exception as e:
        return {"status": "error", "error": str(e), "path": path}

tool_read_file = Tool(
    name="read_file",
    description="Read the text content of a file on the host PC. Supports start_line/end_line to read a specific range. Output capped at configured limit.",
    parameters={
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative path to the file."},
            "start_line": {"type": "integer", "description": "1-indexed start line (inclusive)."},
            "end_line": {"type": "integer", "description": "1-indexed end line (inclusive)."},
        },
        "required": ["path"],
    },
    function=_read_file_impl,
    aliases=["cat", "view_file", "open_file", "file_read"],
)


# --- 3. write_file ---
def _write_file_impl(path: str, content: str, append: bool = False) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    ok, resolved = _check_path_allowed(path, FILE_ALLOWED_DIRS)
    if not ok:
        return {"status": "error", "error": f"Path '{path}' is not in FILE_ALLOWED_DIRS."}
    if len(content.encode("utf-8")) > _MAX_WRITE_BYTES:
        return {"status": "error", "error": f"Content exceeds write limit of {_MAX_WRITE_BYTES // 1024} KB."}
    try:
        p = Path(resolved)
        p.parent.mkdir(parents=True, exist_ok=True)
        if append:
            with p.open("a", encoding="utf-8") as f:
                f.write(content)
        else:
            p.write_text(content, encoding="utf-8")
        return {"status": "success", "path": resolved, "bytes_written": len(content.encode("utf-8")), "mode": "append" if append else "overwrite"}
    except Exception as e:
        return {"status": "error", "error": str(e), "path": path}

tool_write_file = Tool(
    name="write_file",
    description="Create or overwrite a file on the host PC with text content. Use append=true to add to an existing file. Parent directories are created automatically.",
    parameters={
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative path of the file to write."},
            "content": {"type": "string", "description": "Text content to write."},
            "append": {"type": "boolean", "description": "Append to existing file instead of overwriting (default false)."},
        },
        "required": ["path", "content"],
    },
    function=_write_file_impl,
    aliases=["create_file", "save_file", "file_write"],
)


# --- 4. edit_file ---
def _edit_file_impl(path: str, old_text: str, new_text: str, replace_all: bool = False) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    ok, resolved = _check_path_allowed(path, FILE_ALLOWED_DIRS)
    if not ok:
        return {"status": "error", "error": f"Path '{path}' is not in FILE_ALLOWED_DIRS."}
    try:
        p = Path(resolved)
        if not p.exists():
            return {"status": "error", "error": f"File not found: {resolved}"}
        original = p.read_text(encoding="utf-8", errors="replace")
        count = original.count(old_text)
        if count == 0:
            return {"status": "error", "error": "old_text not found in file. Must match exactly (whitespace and newlines included).", "path": resolved}
        if count > 1 and not replace_all:
            return {"status": "error", "error": f"old_text appears {count} times. Set replace_all=true or make it more specific.", "occurrences": count, "path": resolved}
        updated = original.replace(old_text, new_text) if replace_all else original.replace(old_text, new_text, 1)
        p.write_text(updated, encoding="utf-8")
        return {"status": "success", "path": resolved, "replacements": count if replace_all else 1}
    except Exception as e:
        return {"status": "error", "error": str(e), "path": path}

tool_edit_file = Tool(
    name="edit_file",
    description=(
        "Surgically replace old_text with new_text inside an existing file. "
        "old_text must match exactly (indentation and newlines). "
        "Set replace_all=true to replace every occurrence. "
        "Prefer this over write_file for targeted code edits."
    ),
    parameters={
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative path to the file to edit."},
            "old_text": {"type": "string", "description": "Exact text block to find and replace."},
            "new_text": {"type": "string", "description": "Replacement text."},
            "replace_all": {"type": "boolean", "description": "Replace all occurrences instead of just the first (default false)."},
        },
        "required": ["path", "old_text", "new_text"],
    },
    function=_edit_file_impl,
    aliases=["patch_file", "replace_in_file", "file_edit"],
)


# --- 5. delete_file ---
def _delete_file_impl(path: str) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    ok, resolved = _check_path_allowed(path, FILE_ALLOWED_DIRS)
    if not ok:
        return {"status": "error", "error": f"Path '{path}' is not in FILE_ALLOWED_DIRS."}
    try:
        p = Path(resolved)
        if not p.exists():
            return {"status": "error", "error": f"File not found: {resolved}"}
        if p.is_dir():
            return {"status": "error", "error": "Path is a directory. Use run_bash to delete directories."}
        p.unlink()
        return {"status": "success", "deleted": resolved}
    except Exception as e:
        return {"status": "error", "error": str(e), "path": path}

tool_delete_file = Tool(
    name="delete_file",
    description="Permanently delete a single file from the host PC. For deleting directories, use run_bash.",
    parameters={
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative path to the file to delete."},
        },
        "required": ["path"],
    },
    function=_delete_file_impl,
    aliases=["remove_file", "rm_file"],
)


# --- 6. list_directory ---
def _list_directory_impl(path: str, show_hidden: bool = False) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    ok, resolved = _check_path_allowed(path, FILE_ALLOWED_DIRS)
    if not ok:
        return {"status": "error", "error": f"Path '{path}' is not in FILE_ALLOWED_DIRS."}
    try:
        p = Path(resolved)
        if not p.exists():
            return {"status": "error", "error": f"Path not found: {resolved}"}
        if not p.is_dir():
            return {"status": "error", "error": f"Not a directory: {resolved}"}
        entries = []
        for item in sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
            if not show_hidden and item.name.startswith("."):
                continue
            entry: dict[str, Any] = {"name": item.name, "type": "file" if item.is_file() else "dir"}
            if item.is_file():
                try:
                    entry["size_bytes"] = item.stat().st_size
                except Exception:
                    pass
            entries.append(entry)
        return {"status": "success", "path": resolved, "total": len(entries), "entries": entries}
    except Exception as e:
        return {"status": "error", "error": str(e), "path": path}

tool_list_directory = Tool(
    name="list_directory",
    description="List files and subdirectories inside a directory on the host PC, showing name, type (file/dir), and file size.",
    parameters={
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative path to the directory."},
            "show_hidden": {"type": "boolean", "description": "Include hidden items (dotfiles). Default false."},
        },
        "required": ["path"],
    },
    function=_list_directory_impl,
    aliases=["ls", "dir", "list_dir", "list_files"],
)


# --- 7. find_files ---
def _find_files_impl(pattern: str, root: str | None = None, max_results: int = 50) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    search_root = root or os.getcwd()
    ok, resolved_root = _check_path_allowed(search_root, FILE_ALLOWED_DIRS)
    if not ok:
        return {"status": "error", "error": f"Root '{search_root}' is not in FILE_ALLOWED_DIRS."}
    try:
        full_pattern = os.path.join(resolved_root, "**", pattern) if not os.path.isabs(pattern) else pattern
        matches = glob.glob(full_pattern, recursive=True)
        capped = matches[:max_results]
        return {"status": "success", "pattern": pattern, "root": resolved_root, "total_found": len(matches), "returned": len(capped), "files": capped}
    except Exception as e:
        return {"status": "error", "error": str(e)}

tool_find_files = Tool(
    name="find_files",
    description="Recursively search for files matching a glob pattern under a root directory (e.g. pattern='*.py', '**/*.ts', 'config.json').",
    parameters={
        "type": "object",
        "properties": {
            "pattern": {"type": "string", "description": "Glob pattern (e.g. '*.py', '**/*.json', 'README*')."},
            "root": {"type": "string", "description": "Root directory to search from (defaults to server working directory)."},
            "max_results": {"type": "integer", "description": "Max results to return (default 50)."},
        },
        "required": ["pattern"],
    },
    function=_find_files_impl,
    aliases=["glob", "search_files", "file_search"],
)


# --- 8. get_processes ---
def _get_processes_impl(filter_name: str | None = None) -> dict[str, Any]:
    if not _ENABLED:
        return _disabled()
    try:
        import psutil
        procs = []
        for proc in psutil.process_iter(["pid", "name", "status", "cpu_percent", "memory_info"]):
            try:
                info = proc.info
                name = info.get("name", "")
                if filter_name and filter_name.lower() not in name.lower():
                    continue
                procs.append({
                    "pid": info["pid"],
                    "name": name,
                    "status": info.get("status", ""),
                    "cpu_percent": info.get("cpu_percent", 0.0),
                    "memory_mb": round(info["memory_info"].rss / (1024 * 1024), 2) if info.get("memory_info") else None,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        procs.sort(key=lambda p: p.get("cpu_percent", 0.0) or 0.0, reverse=True)
        return {"status": "success", "total": len(procs), "processes": procs[:80]}
    except ImportError:
        try:
            cmd = ["tasklist", "/FO", "CSV", "/NH"] if _IS_WINDOWS else ["ps", "aux", "--no-header"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            lines = result.stdout.strip().splitlines()
            if filter_name:
                lines = [l for l in lines if filter_name.lower() in l.lower()]
            return {"status": "success", "note": "psutil not installed; raw OS output", "output": "\n".join(lines[:80])}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    except Exception as e:
        return {"status": "error", "error": str(e)}

tool_get_processes = Tool(
    name="get_processes",
    description="List running processes on the host PC with PID, name, CPU%, and memory. Optionally filter by name substring. Uses psutil if available.",
    parameters={
        "type": "object",
        "properties": {
            "filter_name": {"type": "string", "description": "Filter by process name substring (e.g. 'python', 'node', 'chrome')."},
        },
        "required": [],
    },
    function=_get_processes_impl,
    aliases=["ps", "processes", "tasklist", "running_processes"],
)


COMPUTER_TOOLS: list[Tool] = [
    tool_run_bash,
    tool_read_file,
    tool_write_file,
    tool_edit_file,
    tool_delete_file,
    tool_list_directory,
    tool_find_files,
    tool_get_processes,
]
