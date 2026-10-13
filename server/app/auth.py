import hashlib
import os
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import HTTPException, Request

from .db import pool

COOKIE_NAME = "tara_session"
SESSION_TTL = timedelta(days=7)
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"

_hasher = PasswordHasher()
# Verified against when the username doesn't exist, so timing doesn't reveal valid usernames
_DUMMY_HASH = _hasher.hash(secrets.token_hex(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, InvalidHashError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(supervisor_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with pool.connection() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < now()")
        conn.execute(
            "INSERT INTO sessions (token_hash, supervisor_id, expires_at) VALUES (%s, %s, now() + %s)",
            (_token_hash(token), supervisor_id, SESSION_TTL),
        )
    return token


def delete_session(token: str) -> None:
    with pool.connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = %s", (_token_hash(token),))


def delete_sessions_for(conn, supervisor_id: int, keep_token: str | None = None) -> None:
    """End a supervisor's sessions, optionally keeping the one making the request."""
    conn.execute(
        "DELETE FROM sessions WHERE supervisor_id = %s AND token_hash <> %s",
        (supervisor_id, _token_hash(keep_token) if keep_token else ""),
    )


def current_supervisor(request: Request) -> dict:
    """FastAPI dependency: the logged-in supervisor, or 401."""
    token = request.cookies.get(COOKIE_NAME)
    if token:
        with pool.connection() as conn:
            row = conn.execute(
                """SELECT s.id, s.username, s.display_name, s.role
                   FROM sessions x JOIN supervisors s ON s.id = x.supervisor_id
                   WHERE x.token_hash = %s AND x.expires_at > now() AND s.is_active""",
                (_token_hash(token),),
            ).fetchone()
        if row:
            return row
    raise HTTPException(status_code=401, detail="not_authenticated")


def require_admin(request: Request) -> dict:
    """FastAPI dependency: the logged-in supervisor if they are an admin, otherwise 401/403."""
    supervisor = current_supervisor(request)
    if supervisor["role"] != "admin":
        raise HTTPException(status_code=403, detail="admin_only")
    return supervisor
