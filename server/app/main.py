import csv
import io
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth
from .catalog import COURSES, INSTRUCTORS
from .db import init_schema, pool

PHONE_PATTERN = re.compile(r"^(\+98|0098|0)9\d{9}$")
NATIONAL_ID_PATTERN = re.compile(r"^\d{10}$")
USERNAME_PATTERN = re.compile(r"^[a-z0-9._-]{3,32}$")
# Persian (۰-۹) and Arabic (٠-٩) digits → Latin
DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
PAGE_SIZE = 20
# Public form submissions allowed per IP and form within the window
RATE_LIMIT = 5
RATE_WINDOW_SECONDS = 3600
STATUSES = ("new", "in_progress", "done")
TEHRAN = ZoneInfo("Asia/Tehran")

Status = Literal["new", "in_progress", "done"]
Kind = Literal["course_request", "consultation"]
Role = Literal["admin", "supervisor"]

TICKET_COLUMNS = """t.id, t.tracking_code, t.kind, t.first_name, t.last_name, t.national_id, t.company,
                    t.course_slug, t.course_title, t.instructor_slug, t.instructor_name,
                    t.phone, t.message, t.status, t.note, t.created_at, t.updated_at,
                    t.assigned_to, a.display_name AS assigned_name"""
TICKET_FROM = "tickets t LEFT JOIN supervisors a ON a.id = t.assigned_to"


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool.open(wait=True)
    init_schema()
    yield
    pool.close()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/healthz")
def healthz():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    return {"ok": True}


@app.get("/api/catalog")
def catalog():
    return {"courses": COURSES, "instructors": INSTRUCTORS}


# ---------- Public: course request + consultation forms ----------

def normalize_digits(value: str) -> str:
    return re.sub(r"[\s\-()]", "", value.translate(DIGITS))


def is_valid_national_id(national_id: str) -> bool:
    """Iranian national ID (کد ملی): 10 digits, the last is a mod-11 check digit."""
    if not NATIONAL_ID_PATTERN.match(national_id) or len(set(national_id)) == 1:
        return False
    remainder = sum(int(d) * (10 - i) for i, d in enumerate(national_id[:9])) % 11
    check = int(national_id[9])
    return check == remainder if remainder < 2 else check == 11 - remainder


def is_valid_name(name: str, max_length: int = 50) -> bool:
    return 2 <= len(name) <= max_length and not any(c.isdigit() for c in name)


def _honeypot_response() -> dict:
    # A real-looking code so bots can't tell they were caught; nothing is saved
    with pool.connection() as conn:
        return {"id": 0, "tracking_code": conn.execute("SELECT tara_tracking_code() AS code").fetchone()["code"]}


def _rate_limited(request: Request, form: str) -> JSONResponse | None:
    """Count this submission against the IP's limit for the form; a 429 response if it is over."""
    ip = request.client.host
    with pool.connection() as conn, conn.transaction():
        # Serialise per IP and form so two simultaneous submissions can't both take the last slot
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"{form}:{ip}",))
        conn.execute(
            "DELETE FROM form_submissions WHERE created_at < now() - make_interval(secs => %s)", (RATE_WINDOW_SECONDS,)
        )
        row = conn.execute(
            """SELECT count(*) AS n, extract(epoch FROM min(created_at) + make_interval(secs => %s) - now()) AS wait
               FROM form_submissions WHERE ip = %s AND form = %s""",
            (RATE_WINDOW_SECONDS, ip, form),
        ).fetchone()
        if row["n"] >= RATE_LIMIT:
            # Retry-After: seconds until the oldest counted submission leaves the window
            return JSONResponse(
                {"error": "rate_limited"}, status_code=429, headers={"Retry-After": str(int(row["wait"]) + 1)}
            )
        conn.execute("INSERT INTO form_submissions (ip, form) VALUES (%s, %s)", (ip, form))
    return None


class TicketIn(BaseModel):
    first_name: str = ""
    last_name: str = ""
    national_id: str = ""
    company: str = ""
    course: str = ""
    instructor: str = ""
    phone: str = ""
    message: str = ""
    website: str = ""  # honeypot, hidden from real users


@app.post("/api/tickets", status_code=201)
def create_ticket(body: TicketIn, request: Request):
    if body.website:
        return _rate_limited(request, "course_request") or _honeypot_response()

    first_name = body.first_name.strip()
    last_name = body.last_name.strip()
    national_id = normalize_digits(body.national_id)
    company = body.company.strip()
    phone = normalize_digits(body.phone)
    message = body.message.strip()
    course = COURSES.get(body.course)

    errors = {}
    if not is_valid_name(first_name):
        errors["first_name"] = "invalid"
    if not is_valid_name(last_name):
        errors["last_name"] = "invalid"
    if not is_valid_national_id(national_id):
        errors["national_id"] = "invalid"
    if len(company) > 100:
        errors["company"] = "invalid"
    if not course:
        errors["course"] = "invalid"
    if not course or body.instructor not in course["instructors"]:
        errors["instructor"] = "invalid"
    if not PHONE_PATTERN.match(phone):
        errors["phone"] = "invalid"
    if not 10 <= len(message) <= 2000:
        errors["message"] = "invalid"
    if errors:
        return JSONResponse({"errors": errors}, status_code=422)
    # Only submissions that pass validation count against the limit
    if limited := _rate_limited(request, "course_request"):
        return limited

    with pool.connection() as conn:
        row = conn.execute(
            """INSERT INTO tickets (first_name, last_name, national_id, company, course_slug, course_title,
                                  instructor_slug, instructor_name, phone, message)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, tracking_code""",
            (first_name, last_name, national_id, company, body.course, course["title"],
             body.instructor, INSTRUCTORS[body.instructor], phone, message),
        ).fetchone()
    return {"id": row["id"], "tracking_code": row["tracking_code"]}


class ConsultationIn(BaseModel):
    name: str = ""
    phone: str = ""
    company: str = ""
    message: str = ""
    website: str = ""  # honeypot


@app.post("/api/consultations", status_code=201)
def create_consultation(body: ConsultationIn, request: Request):
    if body.website:
        return _rate_limited(request, "consultation") or _honeypot_response()

    name = body.name.strip()
    phone = normalize_digits(body.phone)
    company = body.company.strip()
    message = body.message.strip()

    errors = {}
    if not is_valid_name(name, max_length=100):
        errors["name"] = "invalid"
    if not PHONE_PATTERN.match(phone):
        errors["phone"] = "invalid"
    if len(company) > 100:
        errors["company"] = "invalid"
    if not 10 <= len(message) <= 2000:
        errors["message"] = "invalid"
    if errors:
        return JSONResponse({"errors": errors}, status_code=422)
    if limited := _rate_limited(request, "consultation"):
        return limited

    # Consultations have no course; the full name goes in first_name
    with pool.connection() as conn:
        row = conn.execute(
            """INSERT INTO tickets (kind, first_name, company, phone, message,
                                  course_slug, course_title, instructor_slug, instructor_name)
               VALUES ('consultation', %s, %s, %s, %s, '', '', '', '') RETURNING id, tracking_code""",
            (name, company, phone, message),
        ).fetchone()
    return {"id": row["id"], "tracking_code": row["tracking_code"]}


# ---------- Supervisor auth ----------

class LoginIn(BaseModel):
    username: str
    password: str


def _set_session_cookie(response: Response, supervisor_id: int) -> None:
    response.set_cookie(
        auth.COOKIE_NAME,
        auth.create_session(supervisor_id),
        max_age=int(auth.SESSION_TTL.total_seconds()),
        httponly=True,
        samesite="strict",
        secure=auth.COOKIE_SECURE,
        path="/",
    )


def _public_supervisor(row: dict) -> dict:
    return {"id": row["id"], "username": row["username"], "display_name": row["display_name"], "role": row["role"]}


@app.post("/api/auth/login")
def login(body: LoginIn, response: Response):
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT id, username, display_name, role, is_active, password_hash FROM supervisors WHERE username = %s",
            (body.username.strip().lower(),),
        ).fetchone()

    # Disabled accounts get the same answer as a wrong password
    valid = auth.verify_password(row["password_hash"] if row else None, body.password)
    if not valid or not row["is_active"]:
        time.sleep(1)  # slow down password guessing
        raise HTTPException(status_code=401, detail="invalid_credentials")

    _set_session_cookie(response, row["id"])
    return _public_supervisor(row)


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get(auth.COOKIE_NAME)
    if token:
        auth.delete_session(token)
    response.delete_cookie(auth.COOKIE_NAME, path="/")


@app.get("/api/auth/me")
def me(supervisor: dict = Depends(auth.current_supervisor)):
    return _public_supervisor(supervisor)


class PasswordChange(BaseModel):
    current: str
    new: str


@app.post("/api/auth/password", status_code=204)
def change_password(body: PasswordChange, request: Request, supervisor: dict = Depends(auth.current_supervisor)):
    if len(body.new) < 8:
        return JSONResponse({"errors": {"new": "too_short"}}, status_code=422)

    with pool.connection() as conn:
        row = conn.execute("SELECT password_hash FROM supervisors WHERE id = %s", (supervisor["id"],)).fetchone()
        if not auth.verify_password(row["password_hash"], body.current):
            time.sleep(1)
            return JSONResponse({"errors": {"current": "wrong"}}, status_code=422)
        conn.execute(
            "UPDATE supervisors SET password_hash = %s WHERE id = %s",
            (auth.hash_password(body.new), supervisor["id"]),
        )
        # Sign out every other device; keep this one
        auth.delete_sessions_for(conn, supervisor["id"], keep_token=request.cookies.get(auth.COOKIE_NAME))


# ---------- Supervisor: tickets ----------

def _ticket_filters(supervisor: dict, kind=None, course=None, q=None, assigned=None) -> tuple[list[str], list]:
    """WHERE clauses shared by the ticket list, its tab counts and the CSV export (status excluded)."""
    where, params = [], []
    if kind:
        where.append("t.kind = %s")
        params.append(kind)
    if course:
        where.append("t.course_slug = %s")
        params.append(course)
    if assigned == "me":
        where.append("t.assigned_to = %s")
        params.append(supervisor["id"])
    elif assigned == "none":
        where.append("t.assigned_to IS NULL")
    elif assigned and assigned.isdigit():
        where.append("t.assigned_to = %s")
        params.append(int(assigned))
    if q and q.strip():
        term = "%" + q.strip().translate(DIGITS).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        where.append("""(t.tracking_code ILIKE %s OR t.phone ILIKE %s OR t.message ILIKE %s OR t.national_id ILIKE %s
                         OR t.company ILIKE %s OR (t.first_name || ' ' || t.last_name) ILIKE %s)""")
        params += [term] * 6
    return where, params


def _with_status(where: list[str], params: list, status: str | None) -> tuple[str, list]:
    if status:
        return " AND ".join(where + ["t.status = %s"]), params + [status]
    return " AND ".join(where) or "TRUE", params


@app.get("/api/admin/tickets")
def list_tickets(
    status: Status | None = None,
    kind: Kind | None = None,
    course: str | None = None,
    q: str | None = None,
    assigned: str | None = None,
    page: int = Query(1, ge=1),
    supervisor: dict = Depends(auth.current_supervisor),
):
    where, params = _ticket_filters(supervisor, kind, course, q, assigned)
    # Tab counts follow every filter except status
    base_sql, base_params = _with_status(where, params, None)
    status_sql, status_params = _with_status(where, params, status)

    with pool.connection() as conn:
        counts = {s: 0 for s in STATUSES}
        for row in conn.execute(f"SELECT status, count(*) AS n FROM tickets t WHERE {base_sql} GROUP BY status", base_params):
            counts[row["status"]] = row["n"]
        total = conn.execute(f"SELECT count(*) AS n FROM tickets t WHERE {status_sql}", status_params).fetchone()["n"]
        items = conn.execute(
            f"""SELECT {TICKET_COLUMNS} FROM {TICKET_FROM} WHERE {status_sql}
                ORDER BY t.created_at DESC, t.id DESC LIMIT %s OFFSET %s""",
            status_params + [PAGE_SIZE, (page - 1) * PAGE_SIZE],
        ).fetchall()

    return {"items": items, "total": total, "page": page, "page_size": PAGE_SIZE, "counts": counts}


STATUS_LABELS = {"new": "جدید", "in_progress": "در حال بررسی", "done": "انجام‌شده"}
KIND_LABELS = {"course_request": "درخواست دوره", "consultation": "مشاوره"}
CSV_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _csv_text(value) -> str:
    """Neutralise values Excel would run as formulas (CSV injection)."""
    text = "" if value is None else str(value)
    return "'" + text if text.startswith(CSV_FORMULA_START) else text


def _csv_digits(value: str) -> str:
    # ="0912…" keeps Excel from dropping the leading zero; values are validated digit strings
    return f'="{value}"' if value and re.fullmatch(r"\+?\d+", value) else _csv_text(value)


@app.get("/api/admin/tickets/export.csv")
def export_tickets(
    status: Status | None = None,
    kind: Kind | None = None,
    course: str | None = None,
    q: str | None = None,
    assigned: str | None = None,
    supervisor: dict = Depends(auth.current_supervisor),
):
    where, params = _ticket_filters(supervisor, kind, course, q, assigned)
    sql, sql_params = _with_status(where, params, status)
    with pool.connection() as conn:
        rows = conn.execute(
            f"SELECT {TICKET_COLUMNS} FROM {TICKET_FROM} WHERE {sql} ORDER BY t.created_at DESC, t.id DESC",
            sql_params,
        ).fetchall()

    out = io.StringIO()
    out.write("﻿")  # BOM so Excel reads the file as UTF-8
    writer = csv.writer(out)
    writer.writerow(["شماره", "کد پیگیری", "نوع", "تاریخ ثبت", "نام", "نام خانوادگی", "کد ملی", "سازمان", "تلفن",
                     "دوره", "مدرس", "وضعیت", "مسئول", "توضیحات", "یادداشت داخلی"])
    for t in rows:
        writer.writerow([
            t["id"],
            t["tracking_code"],
            KIND_LABELS[t["kind"]],
            t["created_at"].astimezone(TEHRAN).strftime("%Y-%m-%d %H:%M"),
            _csv_text(t["first_name"]),
            _csv_text(t["last_name"]),
            _csv_digits(t["national_id"]),
            _csv_text(t["company"]),
            _csv_digits(t["phone"]),
            _csv_text(t["course_title"]),
            _csv_text(t["instructor_name"]),
            STATUS_LABELS[t["status"]],
            _csv_text(t["assigned_name"]),
            _csv_text(t["message"]),
            _csv_text(t["note"]),
        ])

    filename = f"tara-tickets-{datetime.now(TEHRAN):%Y-%m-%d}.csv"
    return Response(
        out.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/admin/stats")
def stats(_: dict = Depends(auth.current_supervisor)):
    with pool.connection() as conn:
        by_status = {s: 0 for s in STATUSES}
        for row in conn.execute("SELECT status, count(*) AS n FROM tickets GROUP BY status"):
            by_status[row["status"]] = row["n"]

        by_kind = {k: 0 for k in KIND_LABELS}
        for row in conn.execute("SELECT kind, count(*) AS n FROM tickets GROUP BY kind"):
            by_kind[row["kind"]] = row["n"]

        week = conn.execute(
            """SELECT count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS this_week,
                      count(*) FILTER (WHERE created_at >= now() - interval '14 days'
                                         AND created_at <  now() - interval '7 days') AS last_week
               FROM tickets"""
        ).fetchone()

        # Last 30 days in Tehran time, including days with no tickets
        daily = conn.execute(
            """WITH days AS (
                 SELECT generate_series((now() AT TIME ZONE 'Asia/Tehran')::date - 29,
                                        (now() AT TIME ZONE 'Asia/Tehran')::date, interval '1 day')::date AS day
               )
               SELECT d.day, count(t.id) AS n
               FROM days d
               LEFT JOIN tickets t ON (t.created_at AT TIME ZONE 'Asia/Tehran')::date = d.day
               GROUP BY d.day ORDER BY d.day"""
        ).fetchall()

        by_course = conn.execute(
            """SELECT course_slug AS slug, course_title AS title, count(*) AS n
               FROM tickets WHERE kind = 'course_request'
               GROUP BY course_slug, course_title ORDER BY n DESC, title"""
        ).fetchall()

        # Time from submission until someone first moved the ticket out of «جدید»
        pickup = conn.execute(
            """WITH first_pick AS (
                 SELECT t.created_at, min(e.created_at) AS picked_at
                 FROM tickets t JOIN ticket_events e
                   ON e.ticket_id = t.id AND e.field = 'status' AND e.old_value = 'new'
                 GROUP BY t.id, t.created_at
               )
               SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM picked_at - created_at))
                        AS median_seconds,
                      count(*) AS n
               FROM first_pick"""
        ).fetchone()

        unassigned_open = conn.execute(
            "SELECT count(*) AS n FROM tickets WHERE assigned_to IS NULL AND status <> 'done'"
        ).fetchone()["n"]

    return {
        "by_status": by_status,
        "by_kind": by_kind,
        "this_week": week["this_week"],
        "last_week": week["last_week"],
        "daily": [{"day": r["day"].isoformat(), "count": r["n"]} for r in daily],
        "by_course": by_course,
        "median_pickup_seconds": pickup["median_seconds"],
        "picked_up_count": pickup["n"],
        "unassigned_open": unassigned_open,
    }


def _get_ticket(conn, ticket_id: int) -> dict:
    row = conn.execute(
        f"""SELECT {TICKET_COLUMNS}, s.display_name AS updated_by
            FROM {TICKET_FROM} LEFT JOIN supervisors s ON s.id = t.updated_by
            WHERE t.id = %s""",
        (ticket_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not_found")
    return row


@app.get("/api/admin/tickets/{ticket_id}")
def get_ticket(ticket_id: int, _: dict = Depends(auth.current_supervisor)):
    with pool.connection() as conn:
        return _get_ticket(conn, ticket_id)


@app.get("/api/admin/tickets/{ticket_id}/events")
def ticket_events(ticket_id: int, _: dict = Depends(auth.current_supervisor)):
    with pool.connection() as conn:
        _get_ticket(conn, ticket_id)  # 404 if missing
        return conn.execute(
            """SELECT e.id, e.field, e.old_value, e.new_value, e.created_at,
                      s.display_name AS supervisor_name,
                      oa.display_name AS old_assignee, na.display_name AS new_assignee
               FROM ticket_events e
               LEFT JOIN supervisors s ON s.id = e.supervisor_id
               LEFT JOIN supervisors oa ON e.field = 'assigned_to' AND oa.id::text = e.old_value
               LEFT JOIN supervisors na ON e.field = 'assigned_to' AND na.id::text = e.new_value
               WHERE e.ticket_id = %s
               ORDER BY e.created_at DESC, e.id DESC""",
            (ticket_id,),
        ).fetchall()


class TicketUpdate(BaseModel):
    status: Status | None = None
    note: str | None = None
    assigned_to: int | None = None  # null unassigns; leave the field out to keep the current assignee


@app.patch("/api/admin/tickets/{ticket_id}")
def update_ticket(ticket_id: int, body: TicketUpdate, supervisor: dict = Depends(auth.current_supervisor)):
    if body.note is not None and len(body.note) > 5000:
        return JSONResponse({"errors": {"note": "too_long"}}, status_code=422)

    with pool.connection() as conn, conn.transaction():
        current = conn.execute(
            "SELECT status, note, assigned_to FROM tickets WHERE id = %s FOR UPDATE", (ticket_id,)
        ).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="not_found")

        changes = {}
        if body.status is not None and body.status != current["status"]:
            changes["status"] = body.status
        if body.note is not None and body.note != current["note"]:
            changes["note"] = body.note
        if "assigned_to" in body.model_fields_set and body.assigned_to != current["assigned_to"]:
            if body.assigned_to is not None:
                ok = conn.execute(
                    "SELECT 1 FROM supervisors WHERE id = %s AND is_active", (body.assigned_to,)
                ).fetchone()
                if not ok:
                    return JSONResponse({"errors": {"assigned_to": "invalid"}}, status_code=422)
            changes["assigned_to"] = body.assigned_to

        if changes:
            sets = ", ".join(f"{field} = %s" for field in changes)
            conn.execute(
                f"UPDATE tickets SET {sets}, updated_at = now(), updated_by = %s WHERE id = %s",
                list(changes.values()) + [supervisor["id"], ticket_id],
            )
            for field, new in changes.items():
                old = current[field]
                # Notes can be long; the timeline only needs to know they changed
                conn.execute(
                    """INSERT INTO ticket_events (ticket_id, supervisor_id, field, old_value, new_value)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (ticket_id, supervisor["id"], field,
                     None if field == "note" or old is None else str(old),
                     None if field == "note" or new is None else str(new)),
                )
        return _get_ticket(conn, ticket_id)


# ---------- Supervisor management ----------

@app.get("/api/admin/supervisors/options")
def supervisor_options(_: dict = Depends(auth.current_supervisor)):
    """Active supervisors, for the assign dropdown."""
    with pool.connection() as conn:
        return conn.execute(
            "SELECT id, display_name FROM supervisors WHERE is_active ORDER BY display_name"
        ).fetchall()


@app.get("/api/admin/supervisors")
def list_supervisors(_: dict = Depends(auth.require_admin)):
    with pool.connection() as conn:
        return conn.execute(
            """SELECT s.id, s.username, s.display_name, s.role, s.is_active, s.created_at,
                      count(t.id) FILTER (WHERE t.status <> 'done') AS open_tickets
               FROM supervisors s LEFT JOIN tickets t ON t.assigned_to = s.id
               GROUP BY s.id ORDER BY s.is_active DESC, s.created_at"""
        ).fetchall()


class SupervisorIn(BaseModel):
    username: str
    display_name: str
    password: str
    role: Role = "supervisor"


@app.post("/api/admin/supervisors", status_code=201)
def create_supervisor(body: SupervisorIn, _: dict = Depends(auth.require_admin)):
    username = body.username.strip().lower()
    display_name = body.display_name.strip()
    errors = {}
    if not USERNAME_PATTERN.match(username):
        errors["username"] = "invalid"
    if not 2 <= len(display_name) <= 50:
        errors["display_name"] = "invalid"
    if len(body.password) < 8:
        errors["password"] = "too_short"
    if errors:
        return JSONResponse({"errors": errors}, status_code=422)

    with pool.connection() as conn:
        row = conn.execute(
            """INSERT INTO supervisors (username, display_name, password_hash, role) VALUES (%s, %s, %s, %s)
               ON CONFLICT (username) DO NOTHING RETURNING id""",
            (username, display_name, auth.hash_password(body.password), body.role),
        ).fetchone()
    if not row:
        return JSONResponse({"errors": {"username": "taken"}}, status_code=422)
    return {"id": row["id"]}


class SupervisorUpdate(BaseModel):
    display_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = None


@app.patch("/api/admin/supervisors/{supervisor_id}")
def update_supervisor(supervisor_id: int, body: SupervisorUpdate, admin: dict = Depends(auth.require_admin)):
    # An admin can't lock themselves out
    if supervisor_id == admin["id"] and (body.is_active is False or body.role == "supervisor"):
        return JSONResponse({"errors": {"self": "cannot_demote_self"}}, status_code=422)
    if body.display_name is not None and not 2 <= len(body.display_name.strip()) <= 50:
        return JSONResponse({"errors": {"display_name": "invalid"}}, status_code=422)
    if body.password is not None and len(body.password) < 8:
        return JSONResponse({"errors": {"password": "too_short"}}, status_code=422)

    changes = {}
    if body.display_name is not None:
        changes["display_name"] = body.display_name.strip()
    if body.role is not None:
        changes["role"] = body.role
    if body.is_active is not None:
        changes["is_active"] = body.is_active
    if body.password is not None:
        changes["password_hash"] = auth.hash_password(body.password)

    with pool.connection() as conn, conn.transaction():
        exists = conn.execute("SELECT 1 FROM supervisors WHERE id = %s", (supervisor_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="not_found")
        if changes:
            sets = ", ".join(f"{field} = %s" for field in changes)
            conn.execute(f"UPDATE supervisors SET {sets} WHERE id = %s", list(changes.values()) + [supervisor_id])
        # A disabled account or a reset password signs the person out everywhere
        if body.is_active is False or body.password is not None:
            auth.delete_sessions_for(conn, supervisor_id)
    return {"ok": True}


# ---------- Course schedules ----------

MAX_SESSIONS = 40


def _schedule(conn, slug: str) -> dict:
    """Sessions of a course with their state, and where the course is today (Tehran calendar day)."""
    rows = conn.execute(
        "SELECT starts_at, title FROM course_sessions WHERE course_slug = %s ORDER BY starts_at",
        (slug,),
    ).fetchall()
    today = datetime.now(TEHRAN).date()
    sessions = []
    for number, row in enumerate(rows, start=1):
        day = row["starts_at"].astimezone(TEHRAN).date()
        state = "done" if day < today else "today" if day == today else "upcoming"
        sessions.append({"number": number, "starts_at": row["starts_at"], "title": row["title"], "state": state})

    total = len(sessions)
    upcoming = [s for s in sessions if s["state"] != "done"]
    next_at = upcoming[0]["starts_at"] if upcoming else None
    if not sessions:
        status = {"state": "none", "current": 0, "total": 0, "next_at": None}
    elif sessions[0]["state"] == "upcoming":
        status = {"state": "upcoming", "current": 0, "total": total, "next_at": next_at}
    elif not upcoming:
        status = {"state": "finished", "current": total, "total": total, "next_at": None}
    else:
        today_session = next((s for s in sessions if s["state"] == "today"), None)
        current = today_session["number"] if today_session else total - len(upcoming)
        later = [s for s in sessions if s["state"] == "upcoming"]
        status = {"state": "running", "current": current, "total": total,
                  "next_at": later[0]["starts_at"] if later else None}
    return {"status": status, "sessions": sessions}


@app.get("/api/courses/{slug}/schedule")
def course_schedule(slug: str):
    if slug not in COURSES:
        raise HTTPException(status_code=404, detail="not_found")
    with pool.connection() as conn:
        return _schedule(conn, slug)


@app.get("/api/admin/schedules")
def list_schedules(_: dict = Depends(auth.require_admin)):
    with pool.connection() as conn:
        return [{"slug": slug, "title": course["title"], **_schedule(conn, slug)} for slug, course in COURSES.items()]


class SessionIn(BaseModel):
    starts_at: datetime
    title: str = ""


class SessionsIn(BaseModel):
    sessions: list[SessionIn]


@app.put("/api/admin/courses/{slug}/sessions")
def replace_sessions(slug: str, body: SessionsIn, _: dict = Depends(auth.require_admin)):
    errors = {}
    if slug not in COURSES:
        errors["course"] = "invalid"
    if len(body.sessions) > MAX_SESSIONS:
        errors["sessions"] = "too_many"
    if any(s.starts_at.tzinfo is None for s in body.sessions):
        errors["starts_at"] = "timezone_required"
    if any(len(s.title.strip()) > 100 for s in body.sessions):
        errors["title"] = "too_long"
    if errors:
        return JSONResponse({"errors": errors}, status_code=422)

    with pool.connection() as conn, conn.transaction():
        conn.execute("DELETE FROM course_sessions WHERE course_slug = %s", (slug,))
        for s in body.sessions:
            conn.execute(
                "INSERT INTO course_sessions (course_slug, starts_at, title) VALUES (%s, %s, %s)",
                (slug, s.starts_at, s.title.strip()),
            )
        return _schedule(conn, slug)


# ---------- Static site (form, course pages, panel) ----------
# Only these paths are public; anything else in the project (.env, server/) is never served.

SITE_DIR = Path(os.environ.get("SITE_DIR", "/site"))
PUBLIC_PAGES = ("index.html", "course-request.html")
PUBLIC_DIRS = ("assets", "courses", "instructors", "panel")


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(SITE_DIR / "index.html")


for _page in PUBLIC_PAGES:
    app.add_api_route(f"/{_page}", lambda p=_page: FileResponse(SITE_DIR / p), methods=["GET", "HEAD"], include_in_schema=False)

for _dir in PUBLIC_DIRS:
    app.mount(f"/{_dir}", StaticFiles(directory=SITE_DIR / _dir, html=True), name=_dir)
