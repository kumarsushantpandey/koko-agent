from __future__ import annotations
import ast
import datetime
import math
import operator
import os
import platform
import re
import sys
import urllib.parse
from typing import Any
import requests
from dateutil import tz

from src.tools.base import Tool
from src import config

# --- 1. Tool Discovery ---
def _get_available_tools_impl() -> dict[str, Any]:
    from src.tools.registry import tool_registry
    tools = tool_registry.get_all_tools()
    return {
        "status": "success",
        "total_tools": len(tools),
        "tools": [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
                "aliases": t.aliases,
            }
            for t in tools
        ],
    }

tool_get_available_tools = Tool(
    name="get_available_tools",
    description="Inspect and list all active registered tools, capabilities, and schemas available to Koko AI. Call this BEFORE declining any user request.",
    parameters={"type": "object", "properties": {}, "required": []},
    function=_get_available_tools_impl,
    aliases=["get_tool_list", "tool_list", "list_tools", "get_tools"],
)

tool_get_tool_list = Tool(
    name="get_tool_list",
    description="Alias for get_available_tools. Returns list of all registered tools and their functional schemas.",
    parameters={"type": "object", "properties": {}, "required": []},
    function=_get_available_tools_impl,
    aliases=["available_tools"],
)

# --- 2. Clock & Time ---
def _resolve_tz(tz_name: str | None) -> datetime.tzinfo:
    if not tz_name:
        return datetime.datetime.now().astimezone().tzinfo or datetime.timezone.utc
    cleaned = tz_name.strip()
    zone = tz.gettz(cleaned)
    if zone:
        return zone
    # Common city to IANA mapping
    city_map = {
        "tokyo": "Asia/Tokyo",
        "kyoto": "Asia/Tokyo",
        "osaka": "Asia/Tokyo",
        "london": "Europe/London",
        "new york": "America/New_York",
        "nyc": "America/New_York",
        "los angeles": "America/Los_Angeles",
        "san francisco": "America/Los_Angeles",
        "chicago": "America/Chicago",
        "seattle": "America/Los_Angeles",
        "paris": "Europe/Paris",
        "berlin": "Europe/Berlin",
        "sydney": "Australia/Sydney",
        "singapore": "Asia/Singapore",
        "mumbai": "Asia/Kolkata",
        "delhi": "Asia/Kolkata",
        "bangalore": "Asia/Kolkata",
        "kolkata": "Asia/Kolkata",
        "toronto": "America/Toronto",
    }
    lowered = cleaned.lower()
    if lowered in city_map:
        mapped = tz.gettz(city_map[lowered])
        if mapped:
            return mapped
    return datetime.datetime.now().astimezone().tzinfo or datetime.timezone.utc

def _get_current_time_impl(location: str | None = None) -> dict[str, Any]:
    target_tz = _resolve_tz(location)
    now = datetime.datetime.now(target_tz)
    offset_hours = now.utcoffset().total_seconds() / 3600.0 if now.utcoffset() else 0.0
    sign = "+" if offset_hours >= 0 else "-"
    formatted_offset = f"UTC{sign}{abs(int(offset_hours)):02d}:{abs(int((offset_hours % 1) * 60)):02d}"
    return {
        "status": "success",
        "location": location or "Local",
        "time_12h": now.strftime("%I:%M:%S %p"),
        "time_24h": now.strftime("%H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "day_of_week": now.strftime("%A"),
        "utc_offset": formatted_offset,
        "iso": now.isoformat(),
    }

tool_get_current_time = Tool(
    name="get_current_time",
    description="Get the current time, date, and day of the week for the user's local timezone or any specified city/country/timezone worldwide.",
    parameters={
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City name, country, or IANA timezone (e.g. 'Tokyo', 'New York', 'Asia/Kolkata', 'London'). Defaults to local time.",
            }
        },
        "required": [],
    },
    function=_get_current_time_impl,
    aliases=["time", "clock", "current_time"],
)

def _get_timezone_info_impl(location: str) -> dict[str, Any]:
    target_tz = _resolve_tz(location)
    now = datetime.datetime.now(target_tz)
    offset = now.utcoffset().total_seconds() / 3600.0 if now.utcoffset() else 0.0
    return {
        "status": "success",
        "query": location,
        "timezone_name": str(target_tz),
        "utc_offset_hours": offset,
        "is_dst": bool(now.dst()),
        "current_time": now.strftime("%I:%M %p"),
    }

tool_get_timezone_info = Tool(
    name="get_timezone_info",
    description="Retrieve detailed timezone identifier, UTC offset, and Daylight Saving Time status for a given location or timezone string.",
    parameters={
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "Location, city, or timezone name (e.g. 'Paris', 'UTC+9', 'America/New_York').",
            }
        },
        "required": ["location"],
    },
    function=_get_timezone_info_impl,
    aliases=["timezone_info", "tz_info"],
)

def _convert_time_impl(time_str: str, from_location: str, to_location: str) -> dict[str, Any]:
    from_tz = _resolve_tz(from_location)
    to_tz = _resolve_tz(to_location)
    # Parse time_str (e.g. '14:30' or '2:30 PM')
    today = datetime.datetime.now().date()
    parsed_time = None
    for fmt in ("%H:%M", "%I:%M %p", "%I:%M%p", "%H:%M:%S", "%I:%M:%S %p"):
        try:
            t = datetime.datetime.strptime(time_str.strip(), fmt).time()
            parsed_time = datetime.datetime.combine(today, t, tzinfo=from_tz)
            break
        except ValueError:
            continue
    if not parsed_time:
        return {"status": "error", "error": f"Could not parse time format: '{time_str}'. Use HH:MM or HH:MM AM/PM."}

    converted = parsed_time.astimezone(to_tz)
    day_diff = converted.day - parsed_time.day
    day_note = "same day" if day_diff == 0 else ("next day" if day_diff > 0 else "previous day")
    return {
        "status": "success",
        "source": {"location": from_location, "time": parsed_time.strftime("%I:%M %p (%H:%M)")},
        "target": {"location": to_location, "time": converted.strftime("%I:%M %p (%H:%M)"), "day_offset": day_note},
    }

tool_convert_time = Tool(
    name="convert_time",
    description="Convert a specific time from one city/timezone to another.",
    parameters={
        "type": "object",
        "properties": {
            "time_str": {"type": "string", "description": "Time string to convert (e.g. '15:00', '3:30 PM')."},
            "from_location": {"type": "string", "description": "Origin city or timezone (e.g. 'Tokyo')."},
            "to_location": {"type": "string", "description": "Target city or timezone (e.g. 'New York')."},
        },
        "required": ["time_str", "from_location", "to_location"],
    },
    function=_convert_time_impl,
    aliases=["time_convert", "convert_timezone"],
)

def _time_difference_impl(location_a: str, location_b: str) -> dict[str, Any]:
    tz_a = _resolve_tz(location_a)
    tz_b = _resolve_tz(location_b)
    now_a = datetime.datetime.now(tz_a)
    now_b = datetime.datetime.now(tz_b)
    diff_sec = (now_b.utcoffset().total_seconds() if now_b.utcoffset() else 0) - (now_a.utcoffset().total_seconds() if now_a.utcoffset() else 0)
    diff_hours = diff_sec / 3600.0
    return {
        "status": "success",
        "location_a": {"name": location_a, "current_time": now_a.strftime("%I:%M %p")},
        "location_b": {"name": location_b, "current_time": now_b.strftime("%I:%M %p")},
        "difference_hours": diff_hours,
        "summary": f"{location_b} is {abs(diff_hours):.1f} hours {'ahead of' if diff_hours >= 0 else 'behind'} {location_a}.",
    }

tool_time_difference = Tool(
    name="time_difference",
    description="Calculate the time difference in hours between two cities or timezones.",
    parameters={
        "type": "object",
        "properties": {
            "location_a": {"type": "string", "description": "First city or timezone."},
            "location_b": {"type": "string", "description": "Second city or timezone."},
        },
        "required": ["location_a", "location_b"],
    },
    function=_time_difference_impl,
    aliases=["time_diff"],
)

# --- 3. Calendar & Date ---
def _get_current_date_impl(location: str | None = None) -> dict[str, Any]:
    target_tz = _resolve_tz(location)
    now = datetime.datetime.now(target_tz)
    return {
        "status": "success",
        "date_formatted": now.strftime("%B %d, %Y"),
        "iso_date": now.strftime("%Y-%m-%d"),
        "day_of_week": now.strftime("%A"),
        "day_of_year": now.timetuple().tm_yday,
        "is_leap_year": (now.year % 4 == 0 and (now.year % 100 != 0 or now.year % 400 == 0)),
    }

tool_get_current_date = Tool(
    name="get_current_date",
    description="Get today's full calendar date, month, year, and day of the year.",
    parameters={
        "type": "object",
        "properties": {
            "location": {"type": "string", "description": "Optional location/city to check date for."}
        },
        "required": [],
    },
    function=_get_current_date_impl,
    aliases=["date", "today", "calendar"],
)

def _get_day_of_week_impl(date_str: str) -> dict[str, Any]:
    try:
        lowered = date_str.lower().strip()
        today = datetime.date.today()
        if lowered in ("today", "now"):
            target_date = today
        elif lowered == "tomorrow":
            target_date = today + datetime.timedelta(days=1)
        elif lowered == "yesterday":
            target_date = today - datetime.timedelta(days=1)
        else:
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%B %d, %Y", "%b %d %Y"):
                try:
                    target_date = datetime.datetime.strptime(lowered, fmt).date()
                    break
                except ValueError:
                    continue
            else:
                return {"status": "error", "error": f"Could not parse date '{date_str}'. Use YYYY-MM-DD."}
        return {
            "status": "success",
            "date": target_date.strftime("%Y-%m-%d"),
            "day_of_week": target_date.strftime("%A"),
            "is_weekend": target_date.weekday() >= 5,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

tool_get_day_of_week = Tool(
    name="get_day_of_week",
    description="Get the day of the week for any past, future, or relative date ('tomorrow', 'yesterday', '2026-12-25').",
    parameters={
        "type": "object",
        "properties": {
            "date_str": {"type": "string", "description": "Date to inspect (e.g. '2026-10-31', 'tomorrow')."}
        },
        "required": ["date_str"],
    },
    function=_get_day_of_week_impl,
    aliases=["day_of_week"],
)

# --- 4. Math Calculator ---
_SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

def _calculate_impl(expression: str) -> dict[str, Any]:
    try:
        # Preprocess percentage: '15% of 85' -> '(15 / 100) * 85', '20%' -> '(20/100)'
        expr = re.sub(r"(\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(\d+(?:\.\d+)?)", r"(\1 / 100) * \2", expression)
        expr = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"(\1 / 100)", expr)
        expr = expr.replace("^", "**").strip()

        node = ast.parse(expr, mode="eval").body

        def _eval(n: ast.AST) -> float | int:
            if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
                return n.value
            if isinstance(n, ast.UnaryOp) and type(n.op) in _SAFE_OPERATORS:
                return _SAFE_OPERATORS[type(n.op)](_eval(n.operand))
            if isinstance(n, ast.BinOp) and type(n.op) in _SAFE_OPERATORS:
                return _SAFE_OPERATORS[type(n.op)](_eval(n.left), _eval(n.right))
            raise ValueError(f"Unsupported AST node or operation: {type(n).__name__}")

        val = _eval(node)
        rounded = round(val, 6) if isinstance(val, float) else val
        return {
            "status": "success",
            "expression": expression,
            "result": rounded,
        }
    except Exception as e:
        return {"status": "error", "expression": expression, "error": f"Invalid expression: {e}"}

tool_calculate = Tool(
    name="calculate",
    description="Safely evaluate exact arithmetic and math expressions without arbitrary code execution (e.g. '145 * 28', '15% of 3200', '2^16').",
    parameters={
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "Mathematical expression to evaluate."}
        },
        "required": ["expression"],
    },
    function=_calculate_impl,
    aliases=["calc", "math", "calculator"],
)

# --- 5. System Status ---
def _get_system_status_impl() -> dict[str, Any]:
    from src.bridge.broadcaster import broadcaster
    return {
        "status": "success",
        "assistant_name": "Koko AI",
        "os": f"{platform.system()} {platform.release()}",
        "architecture": platform.machine(),
        "python_version": sys.version.split()[0],
        "connected_clients": len(broadcaster._connections),
        "default_provider": config.DEFAULT_LLM_PROVIDER,
        "tool_calling_enabled": config.TOOL_CALLING_ENABLED,
        "max_tool_rounds": config.MAX_TOOL_CALL_ROUNDS,
    }

tool_get_system_status = Tool(
    name="get_system_status",
    description="Retrieve live runtime host telemetry: operating system, architecture, Python version, Koko status, and active connections.",
    parameters={"type": "object", "properties": {}, "required": []},
    function=_get_system_status_impl,
    aliases=["system_status", "status"],
)

# --- 6. Live Web Search & Page Reader ---
def _web_search_impl(query: str, max_results: int = 3) -> dict[str, Any]:
    # Defensive URL routing: if user passed a full URL into search, route to fetch_web_page
    if query.startswith("http://") or query.startswith("https://"):
        return _fetch_web_page_impl(query)

    api_key = config.TAVILY_API_KEY
    if api_key and api_key.startswith("tvly-"):
        try:
            resp = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": max_results,
                },
                timeout=config.TOOL_EXECUTION_TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("results", []):
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "content": item.get("content", "")[:350],
                    })
                return {"status": "success", "provider": "tavily", "query": query, "results": results}
        except Exception as e:
            pass

    # DuckDuckGo fallback
    try:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KokoAi/1.0"}
        resp = requests.get(url, headers=headers, timeout=config.TOOL_EXECUTION_TIMEOUT)
        if resp.status_code == 200:
            snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', resp.text, re.DOTALL)
            titles = re.findall(r'<a class="result__url[^>]*>(.*?)</a>', resp.text, re.DOTALL)
            results = []
            for i in range(min(max_results, len(snippets))):
                clean_snippet = re.sub(r"<[^>]+>", "", snippets[i]).strip()
                clean_title = re.sub(r"<[^>]+>", "", titles[i]).strip() if i < len(titles) else ""
                results.append({"title": clean_title, "content": clean_snippet[:350]})
            return {"status": "success", "provider": "duckduckgo", "query": query, "results": results}
    except Exception as e:
        return {"status": "error", "query": query, "error": f"Search failed: {e}"}

    return {"status": "error", "query": query, "error": "Search service unavailable."}

tool_web_search = Tool(
    name="web_search",
    description="Search the live internet for recent news, real-time facts, anime releases, gaming updates, or general queries using Tavily AI with DuckDuckGo fallback.",
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query terms (e.g. 'latest anime releases 2026', 'weather in Tokyo')."},
            "max_results": {"type": "integer", "description": "Number of results to return (default 3)."}
        },
        "required": ["query"],
    },
    function=_web_search_impl,
    aliases=["search", "google", "find"],
)

def _fetch_web_page_impl(url: str) -> dict[str, Any]:
    api_key = config.TAVILY_API_KEY
    if api_key and api_key.startswith("tvly-"):
        try:
            resp = requests.post(
                "https://api.tavily.com/extract",
                json={"api_key": api_key, "urls": [url]},
                timeout=config.TOOL_EXECUTION_TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    raw_content = results[0].get("raw_content", "")[:1200]
                    return {"status": "success", "url": url, "content": raw_content}
        except Exception:
            pass

    # Direct HTTP GET fallback
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KokoAi/1.0"}
        resp = requests.get(url, headers=headers, timeout=config.TOOL_EXECUTION_TIMEOUT)
        if resp.status_code == 200:
            # Strip script and style tags
            text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", resp.text, flags=re.DOTALL | re.IGNORECASE)
            # Strip all HTML tags
            text = re.sub(r"<[^>]+>", " ", text)
            # Normalize whitespace
            clean = re.sub(r"\s+", " ", text).strip()
            return {"status": "success", "url": url, "content": clean[:1200]}
        return {"status": "error", "url": url, "error": f"HTTP status {resp.status_code}"}
    except Exception as e:
        return {"status": "error", "url": url, "error": str(e)}

tool_fetch_web_page = Tool(
    name="fetch_web_page",
    description="Fetch and extract readable text content from a specific web page URL.",
    parameters={
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "The full HTTP/HTTPS URL of the web page to read."}
        },
        "required": ["url"],
    },
    function=_fetch_web_page_impl,
    aliases=["read_url", "web_fetch", "inspect_url"],
)

BUILTIN_TOOLS: list[Tool] = [
    tool_get_available_tools,
    tool_get_tool_list,
    tool_get_current_time,
    tool_get_timezone_info,
    tool_convert_time,
    tool_time_difference,
    tool_get_current_date,
    tool_get_day_of_week,
    tool_calculate,
    tool_get_system_status,
    tool_web_search,
    tool_fetch_web_page,
]
