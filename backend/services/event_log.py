"""
Real event/log store for OpsMind.

There is no external log aggregator (ELK/Loki/CloudWatch Logs) wired up
yet, so this module is the source of truth for /api/logs. It does NOT
generate fake log lines -- every entry here is written by real code
paths (a monitoring poll happening, a status change being detected,
the server starting, etc). This keeps the Logs page honest: what you
see is what has actually happened in this backend process.

Because it is in-memory, history resets when the FastAPI process
restarts. That's an accurate limitation to disclose, not something to
hide.
"""

from collections import deque
from datetime import datetime, timezone
from threading import Lock

_MAX_ENTRIES = 500
_log = deque(maxlen=_MAX_ENTRIES)
_lock = Lock()
_next_id = 1


def add_log(level: str, service: str, message: str, source: str = "backend"):
    """
    level: one of INFO, WARNING, ERROR, CRITICAL, DEBUG
    """
    global _next_id

    with _lock:
        entry = {
            "id": _next_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level.upper(),
            "service": service,
            "source": source,
            "message": message
        }
        _log.append(entry)
        _next_id += 1

    return entry


def get_logs(limit: int = 200, level: str | None = None, service: str | None = None):
    with _lock:
        entries = list(_log)

    if level and level.lower() != "all":
        entries = [e for e in entries if e["level"].lower() == level.lower()]

    if service and service.lower() != "all":
        entries = [e for e in entries if e["service"].lower() == service.lower()]

    entries = list(reversed(entries))  # newest first

    return entries[:limit]


def clear_logs():
    with _lock:
        _log.clear()
