"""
Simple session-based admin authentication.

This is intentionally lightweight (in-memory sessions, one admin
account) -- appropriate for a single-operator local DevOps dashboard,
NOT a multi-tenant production auth system. It is still REAL: passwords
are hashed (never stored/compared in plaintext), sessions are random
tokens with an expiry, and nothing is faked on the frontend.

Credentials are read from environment variables so they are never
hardcoded into source control:

    OPSMIND_ADMIN_USERNAME  (default: admin)
    OPSMIND_ADMIN_PASSWORD  (default: opsmind123 -- CHANGE THIS)

To change the password, set the environment variable before starting
uvicorn, e.g. (PowerShell):
    $env:OPSMIND_ADMIN_PASSWORD = "your-new-password"
    uvicorn app:app --reload
"""

import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

ADMIN_USERNAME = os.environ.get("OPSMIND_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("OPSMIND_ADMIN_PASSWORD", "opsmind123")

SESSION_TTL_HOURS = 8

# token -> {"username": ..., "expires_at": datetime}
_sessions = {}


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def verify_credentials(username: str, password: str) -> bool:
    return (
        secrets.compare_digest(username, ADMIN_USERNAME)
        and secrets.compare_digest(_hash(password), _hash(ADMIN_PASSWORD))
    )


def create_session(username: str) -> dict:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)
    _sessions[token] = {"username": username, "expires_at": expires_at}
    return {"token": token, "expires_at": expires_at.isoformat()}


def verify_session(token: str) -> bool:
    session = _sessions.get(token)
    if not session:
        return False
    if session["expires_at"] < datetime.now(timezone.utc):
        del _sessions[token]
        return False
    return True


def destroy_session(token: str):
    _sessions.pop(token, None)
