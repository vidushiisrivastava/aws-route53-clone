"""FastAPI entry point for the AWS Route53 clone backend."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .routers import auth, zones, records, health_checks, traffic_policies, resolver
from . import models, database


def run_sqlite_migrations():
    """Safely add new columns to existing SQLite tables and backfill NS/SOA records."""
    models.Base.metadata.create_all(bind=database.engine)

    migrations = {
        "hosted_zones": [
            ("zone_type", "VARCHAR DEFAULT 'Public' NOT NULL"),
            ("vpc_id", "VARCHAR"),
            ("vpc_region", "VARCHAR"),
        ],
        "dns_records": [
            ("routing_policy", "VARCHAR DEFAULT 'Simple' NOT NULL"),
            ("weight", "INTEGER"),
            ("region", "VARCHAR"),
            ("failover", "VARCHAR"),
            ("health_check_id", "INTEGER"),
            ("set_identifier", "VARCHAR"),
            ("is_alias", "BOOLEAN DEFAULT 0"),
        ],
    }

    with database.engine.begin() as conn:
        for table, cols in migrations.items():
            existing = {
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            }
            for col_name, col_def in cols:
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))

    # Backfill default NS and SOA records on existing zones that lack them
    db = database.SessionLocal()
    try:
        all_zones = db.query(models.HostedZone).all()
        for z in all_zones:
            if len(z.records) == 0:
                nameservers = zones.generate_aws_nameservers(z.id)
                apex_name = f"{z.name.rstrip('.')}."
                db.add_all([
                    models.DnsRecord(
                        name=apex_name,
                        type="NS",
                        ttl=172800,
                        value="\n".join(nameservers),
                        routing_policy="Simple",
                        zone_id=z.id,
                    ),
                    models.DnsRecord(
                        name=apex_name,
                        type="SOA",
                        ttl=900,
                        value=f"{nameservers[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
                        routing_policy="Simple",
                        zone_id=z.id,
                    ),
                ])
        db.commit()
    finally:
        db.close()


run_sqlite_migrations()

app = FastAPI(title="AWS Route53 Clone API")

# Allow localhost and hosted frontend origins via CORS_ORIGINS env var
raw_origins = os.getenv("CORS_ORIGINS", "").strip()
cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()] if raw_origins else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AWS Route53 Clone API"}


app.include_router(auth.router)
app.include_router(zones.router)
app.include_router(records.router)
app.include_router(health_checks.router)
app.include_router(traffic_policies.router)
app.include_router(resolver.router)
