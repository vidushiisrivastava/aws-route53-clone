"""Standalone, idempotent CLI database seeding script for the AWS Route 53 Clone."""

import os
from pathlib import Path
import sys

# Ensure relative sqlite:///./route53.db resolves inside backend/ even when run from repo root
BACKEND_DIR = Path(__file__).resolve().parent
os.chdir(BACKEND_DIR)
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import database  # noqa: E402
from app.main import run_sqlite_migrations  # noqa: E402
from app.seed import DEMO_ACCOUNTS, seed_database  # noqa: E402


def main() -> None:
    run_sqlite_migrations()
    db = database.SessionLocal()
    try:
        counts = seed_database(db, only_if_empty=False)
    finally:
        db.close()

    print(
        "[OK] Database seeded (idempotent): "
        f"+{counts['users']} users, +{counts['zones']} zones, "
        f"+{counts['records']} records, +{counts['health_checks']} health checks, "
        f"+{counts['traffic_policies']} traffic policies."
    )
    print("Demo accounts:")
    for acct in DEMO_ACCOUNTS:
        print(f"  - {acct['username']} / {acct['password']} ({acct['role']})")


if __name__ == "__main__":
    main()

