# System Architecture & Database Design

This document describes the High-Level Design (HLD), component interactions, SQLite database schema, schema evolution strategy, and key engineering decisions for the **AWS Route 53 Clone**.

---

## High-Level System Architecture

The application follows a decoupled client–server architecture: a **Next.js (App Router, TypeScript)** console styled with **AWS Cloudscape Design System** communicating over REST/JSON with a **FastAPI** backend backed by **SQLite** via **SQLAlchemy ORM**.

```mermaid
flowchart TB
    subgraph Client["Browser Client (Next.js 16 + Cloudscape UI)"]
        UI["Pages & ConsoleLayout (Dark/Light Mode, Shortcuts, Flashbar)"]
        Shell["ClientShell (Post-Hydration Mount Guard)"]
        ApiClient["Axios Client (JWT Bearer Interceptor & 401 Handler)"]
        Storage["localStorage (r53_access_token, r53_user, r53_dark_mode)"]
        UI --> Shell
        UI --> ApiClient
        ApiClient <--> Storage
    end

    subgraph Backend["FastAPI Backend (Python 3.11+ / Uvicorn)"]
        CORS["CORS Middleware"]
        AuthDep["JWT Auth Dependency (get_current_user)"]
        AuthRouter["Auth Router (/auth)"]
        ZonesRouter["Zones Router (/zones)"]
        RecordsRouter["DNS Records & BIND Router (/zones/{zone_id}/records)"]
        HCRouter["Health Checks Router (/health-checks)"]
        TPRouter["Traffic Policies & Policy Records Router"]
        ResRouter["Resolver & Profiles Router"]
        Prober["Live Endpoint Prober (HTTP/HTTPS urllib + TCP socket)"]

        CORS --> AuthRouter
        CORS --> AuthDep
        AuthDep --> ZonesRouter
        AuthDep --> RecordsRouter
        CORS --> HCRouter
        CORS --> TPRouter
        CORS --> ResRouter
        HCRouter --> Prober
    end

    subgraph Data["Persistence Layer (SQLite)"]
        Migrations["Startup Migrations (run_sqlite_migrations)"]
        ORM["SQLAlchemy ORM Models"]
        DB[("route53.db (SQLite)")]
        Migrations --> ORM
        ORM <--> DB
    end

    Ext["External HTTP / HTTPS / TCP Targets"]

    ApiClient -- "REST / JSON (Bearer JWT)" --> CORS
    AuthRouter --> ORM
    ZonesRouter --> ORM
    RecordsRouter --> ORM
    HCRouter --> ORM
    TPRouter --> ORM
    ResRouter --> ORM
    Prober -- "Live GET / TCP Connect (3s timeout)" --> Ext
```

---

## Core Request & Provisioning Flow

When a user creates a Hosted Zone, the backend persists the zone and automatically provisions the 4 authoritative Route 53 `NS` records and the `SOA` apex record in a single workflow, keeping `record_count` accurate across both the zone details view and the parent Hosted Zones table.

```mermaid
sequenceDiagram
    actor User
    participant NextJS as "Next.js Console"
    participant FastAPI as "FastAPI Backend"
    participant SQLite as "SQLite (route53.db)"

    User->>NextJS: Click "1-Click Demo Sign-In"
    NextJS->>FastAPI: POST /auth/demo
    FastAPI->>SQLite: Query or seed user "Vidushi"
    FastAPI-->>NextJS: 200 OK (JWT access_token + user)
    NextJS->>NextJS: Save JWT in localStorage

    User->>NextJS: Submit Create Hosted Zone ("example.com")
    NextJS->>FastAPI: POST /zones/ (Bearer JWT)
    FastAPI->>FastAPI: validate_domain_name()
    FastAPI->>SQLite: INSERT hosted_zones
    FastAPI->>SQLite: INSERT apex NS (4 nameservers) + SOA records
    FastAPI-->>NextJS: 201 Created (zone with record_count = 2)

    User->>NextJS: Add "www" A Record (203.0.113.10)
    NextJS->>FastAPI: POST /zones/{id}/records/ (Bearer JWT)
    FastAPI->>SQLite: INSERT dns_records (formatted "www.example.com.")
    FastAPI-->>NextJS: 201 Created
    NextJS->>FastAPI: GET /zones/{id} & GET /zones/{id}/records/
    FastAPI-->>NextJS: Updated zone (record_count = 3) & records list
```

---

## SQLite Entity-Relationship Diagram

The database schema is defined in `backend/app/models.py` and stored in `backend/route53.db`.

```mermaid
erDiagram
    users ||--o{ hosted_zones : "owns (owner_id)"
    hosted_zones ||--o{ dns_records : "contains (cascade delete)"
    hosted_zones ||--o{ policy_records : "referenced by"
    traffic_policies ||--o{ policy_records : "bound to"
    health_checks ||--o{ dns_records : "monitored by (optional)"

    users {
        int id PK
        string username UK
        string hashed_password
        boolean is_active
        datetime created_at
    }

    hosted_zones {
        int id PK
        string name
        string comment
        string zone_type
        string vpc_id
        string vpc_region
        int owner_id FK
        datetime created_at
    }

    dns_records {
        int id PK
        string name
        string type
        int ttl
        string value
        string routing_policy
        int weight
        string region
        string failover
        int health_check_id
        string set_identifier
        boolean is_alias
        int zone_id FK
        datetime created_at
    }

    health_checks {
        int id PK
        string name
        string protocol
        string endpoint
        int port
        string resource_path
        int request_interval
        int failure_threshold
        string status
        string status_reason
        datetime last_checked_at
        datetime created_at
    }

    traffic_policies {
        int id PK
        string name
        int version
        string dns_type
        string comment
        text document
        datetime created_at
    }

    policy_records {
        int id PK
        string name
        string type
        int ttl
        int hosted_zone_id FK
        string hosted_zone_name
        int traffic_policy_id FK
        string traffic_policy_name
        int traffic_policy_version
        datetime created_at
    }

    resolver_endpoints {
        int id PK
        string name
        string direction
        string vpc_id
        string ip_addresses
        string status
        datetime created_at
    }

    resolver_rules {
        int id PK
        string name
        string rule_type
        string domain_name
        string target_ip
        string vpc_id
        string status
        datetime created_at
    }

    route53_profiles {
        int id PK
        string name
        string description
        string status
        text vpc_associations
        int resource_count
        datetime created_at
    }
```

---

## Database Evolution & Design Decisions

### 1. Lightweight Startup Schema Migrations (`run_sqlite_migrations`)
Because SQLite does not automatically add new columns when SQLAlchemy models evolve, `backend/app/main.py` runs `run_sqlite_migrations()` on startup:
- Calls `models.Base.metadata.create_all(bind=database.engine)` to create any missing tables.
- Inspects existing columns via `PRAGMA table_info(<table>)` and executes `ALTER TABLE ... ADD COLUMN ...` idempotently for newer columns (`hosted_zones.zone_type`, `vpc_id`, `vpc_region`; `dns_records.routing_policy`, `weight`, `region`, `failover`, `health_check_id`, `set_identifier`, `is_alias`).
- Backfills authoritative `NS` and `SOA` records on any pre-existing hosted zones that have zero records.

### 2. Ownership Isolation & Duplicate Zone Disambiguation
- **Owner-scoped Hosted Zones**: Every hosted zone is linked to `users.id` via `owner_id`. `resolve_owned_zone()` ensures users can only read, modify, or delete their own zones.
- **Duplicate Domain Support**: Matching real AWS Route 53 behavior, `hosted_zones.name` is non-unique so a user can host multiple zones for the same domain (for example, a Public zone and a Private VPC zone). The backend accepts lookup by numeric `id` or domain name, and the frontend `hostedZoneHref()` helper appends `?id=<zone_id>` whenever duplicate domain names exist.

### 3. Client-Side Cloudscape Hydration Guard (`ClientShell`)
Cloudscape Design System generates runtime performance-mark IDs and evaluates viewport hooks during mount. Wrapping the Next.js root layout in `ClientShell` defers rendering the Cloudscape component tree until after client hydration, eliminating React SSR hydration mismatch warnings while preserving dark-mode background continuity (`#0f141a`).

### 4. DNS Record Integrity & BIND Interoperability
- **Apex `NS` / `SOA` Protection**: Both single-record `DELETE` and `POST /records/bulk-delete` protect required apex `NS` and `SOA` records from accidental removal (`400 Bad Request` on single delete; skipped count reported on bulk delete).
- **BIND Zone File Parser & Exporter**: Supports `$ORIGIN`, `$TTL`, quoted `TXT` strings, and standard resource record formats for both importing into existing/new zones and exporting zones as `.zone` or `.json`.

