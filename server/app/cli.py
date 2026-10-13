"""Supervisor management.

    python -m app.cli create-supervisor <username> [--name "Display name"]
"""
import argparse
import getpass
import sys

from .auth import hash_password
from .db import init_schema, pool


def create_supervisor(username: str, display_name: str, role: str) -> None:
    password = getpass.getpass("Password: ")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")
    if password != getpass.getpass("Repeat password: "):
        sys.exit("Passwords do not match.")

    with pool.connection() as conn:
        row = conn.execute(
            """INSERT INTO supervisors (username, display_name, password_hash, role) VALUES (%s, %s, %s, %s)
               ON CONFLICT (username) DO NOTHING RETURNING id""",
            (username, display_name, hash_password(password), role),
        ).fetchone()
    if not row:
        sys.exit(f"Supervisor '{username}' already exists.")
    print(f"Created {role} '{username}' (id {row['id']}).")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-supervisor")
    create.add_argument("username")
    create.add_argument("--name", help="display name shown in the panel (defaults to username)")
    create.add_argument("--admin", action="store_true", help="can manage other supervisors in the panel")
    args = parser.parse_args()

    pool.open()
    init_schema()
    if args.command == "create-supervisor":
        create_supervisor(args.username.strip().lower(), args.name or args.username, "admin" if args.admin else "supervisor")
    pool.close()


if __name__ == "__main__":
    main()
