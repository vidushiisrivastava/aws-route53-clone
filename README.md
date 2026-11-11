# AWS Route 53 Clone

A full-stack clone of the **Amazon Route 53 Management Console** built with **Next.js (TypeScript)**, **AWS Cloudscape Design System**, **FastAPI**, and **SQLite**. It recreates the dark-mode AWS Route 53 console look, navigation workflows, Hosted Zone & DNS Record management, routing policies, health checks, traffic policies, resolver endpoints/rules, profiles, mocked AWS IAM authentication, BIND zone file import/export, bulk actions, keyboard shortcuts, and Cloudscape Flashbar notifications.

---

## Features

### Core Requirements
- **Mocked AWS IAM Authentication & Session Persistence**
  - Dark-mode AWS IAM Sign-In & Registration page (`/login`) with 12-digit Account ID (`1793-0234-9211`), username/password auth, and **1-Click Demo Sign-In (`Vidushi`)**.
  - JWT Bearer token persistence in `localStorage` with automatic `Authorization` header injection and `401 Unauthorized` session handling.
  - Top console account menu with active IAM identity details and **Sign out**.
- **Hosted Zones CRUD (SQLite-backed)**
  - View, search, filter by zone type (`Public` / `Private`), paginate, create, edit description, and delete hosted zones.
  - Automatic generation of 4 Route 53 authoritative name servers (`NS`) and `SOA` apex record upon zone creation.
- **DNS Records CRUD (SQLite-backed)**
  - Supports **A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA, SOA** record types.
  - Search by name/type/value, filter by record type dropdown, pagination, Alias toggle, TTL presets, Health Check association, and routing policies (`Simple`, `Weighted`, `Latency`, `Failover`, `Geolocation`, `Multivalue`).
  - Protects required apex `NS` and `SOA` records from accidental deletion.
- **Authentic AWS Route 53 Console UI & UX**
  - Cloudscape Design System (`@cloudscape-design/components` + `@cloudscape-design/global-styles`) in AWS dark mode (`awsui-dark-mode`).
  - Official Route 53 Overview landing page (`/`), Cloudscape `AppLayout`, `SideNavigation`, `BreadcrumbGroup`, `Flashbar` notifications, confirmation modals, and AWS console top/bottom bars.
- **Additional Functional Route 53 Sections (Beyond Placeholders)**
  - **Dashboard** (`/dashboard`): Summary metrics across hosted zones, records, health checks, and traffic policies.
  - **Health Checks** (`/health-checks`): Create, run live endpoint checks, and delete health checks.
  - **Traffic Policies & Policy Records** (`/traffic-policies`, `/policy-records`): Create versioned traffic flow documents and bind policy records to hosted zones.
  - **Resolver & Profiles** (`/resolver`, `/profiles`): Manage inbound/outbound VPC resolver endpoints, forwarding rules, and Route 53 profiles.

### Bonus Features Implemented
- **Import DNS records from BIND zone files** (`$ORIGIN`, `$TTL`, file upload or paste) directly from the Hosted Zones list, the Create Hosted Zone flow, or inside any zone via `POST /zones/{zone_id}/records/import-bind`.
- **Export Hosted Zones as BIND (`.zone`) or JSON (`.json`)** (single or multi-zone bulk export) via `GET /zones/{zone_id}/export?format=bind|json`.
- **Dark Mode & Light Mode toggle** persisted in `localStorage` (defaults to AWS Dark Mode, accessible from the top console bar, settings menu, or `Alt+T`).
- **Keyboard Shortcuts** (`Alt+S` global search, `Alt+H` hosted zones, `Alt+D` dashboard, `Alt+N` create zone, `Alt+C` health checks, `Alt+T` theme toggle, `?` shortcuts help modal).
- **Bulk Operations**: Multi-select checkboxes for bulk delete (`POST /zones/bulk-delete` and `POST /zones/{zone_id}/records/bulk-delete`), bulk export (BIND/JSON), and bulk edit TTL (`POST /zones/{zone_id}/records/bulk-ttl`).

---

## Architecture Overview

```text
aws-route53-clone/
├── backend/                     # FastAPI REST API + SQLite ORM
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, SQLite schema auto-migrations & router wiring
│   │   ├── database.py          # SQLAlchemy engine (sqlite:///./route53.db) & get_db dependency
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── schemas.py           # Pydantic v2 request/response schemas
│   │   ├── dependencies.py      # JWT Bearer authentication (get_current_user)
│   │   └── routers/
│   │       ├── auth.py          # /auth (register, login, login-json, demo, me)
│   │       ├── zones.py         # /zones (CRUD, bulk-delete, BIND/JSON export)
│   │       ├── records.py       # /zones/{zone_id}/records (CRUD, BIND import, bulk-delete)
│   │       ├── health_checks.py # /health-checks (CRUD + check execution)
│   │       ├── traffic_policies.py # /traffic-policies & /policy-records
│   │       └── resolver.py      # /resolver/endpoints, /resolver/rules, /profiles
│   └── requirements.txt
└── frontend/                    # Next.js 16 (App Router, TypeScript) + Cloudscape UI
    └── app/
        ├── layout.tsx           # Global Cloudscape dark styles
        ├── globals.css          # Dark console header/footer/hero theme styling
        ├── lib/api.ts           # Axios client, JWT interceptors, session & Flashbar helpers
        ├── components/ConsoleLayout.tsx # Top AWS bar, SideNavigation, Flashbar, shortcuts, theme
        ├── login/page.tsx       # Mocked AWS IAM Sign-In / Register + Demo button
        ├── page.tsx             # Route 53 Overview landing page
        ├── dashboard/page.tsx   # Route 53 Dashboard
        ├── hosted-zones/
        │   ├── page.tsx         # Hosted zones table (multi-select, filter, edit, bulk-delete, export)
        │   ├── create/page.tsx  # Create public/private hosted zone wizard
        │   └── [zoneId]/page.tsx# Hosted zone details & DNS records CRUD + BIND import/export
        ├── health-checks/page.tsx
        ├── traffic-policies/page.tsx
        ├── policy-records/page.tsx
        ├── resolver/page.tsx
        └── profiles/page.tsx
```

---

## Database Schema (SQLite: `backend/route53.db`)

Managed via SQLAlchemy ORM (`backend/app/models.py`) with lightweight startup column migrations (`run_sqlite_migrations()` in `backend/app/main.py`):

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `users` | Mocked IAM user accounts | `id`, `username` (unique), `hashed_password` (bcrypt), `is_active`, `created_at` |
| `hosted_zones` | Public/Private hosted zones | `id`, `name`, `comment`, `zone_type` (`Public`/`Private`), `vpc_id`, `vpc_region`, `owner_id` (FK -> `users.id`), `created_at` |
| `dns_records` | DNS records within a zone | `id`, `name`, `type`, `ttl`, `value`, `routing_policy`, `weight`, `region`, `failover`, `health_check_id`, `set_identifier`, `is_alias`, `zone_id` (FK -> `hosted_zones.id`), `created_at` |
| `health_checks` | Endpoint health monitors | `id`, `name`, `protocol`, `endpoint`, `port`, `resource_path`, `request_interval`, `failure_threshold`, `status`, `status_reason`, `last_checked_at`, `created_at` |
| `traffic_policies` | Versioned traffic flow JSON policies | `id`, `name`, `version`, `dns_type`, `comment`, `document`, `created_at` |
| `policy_records` | Zone-linked traffic policy records | `id`, `name`, `type`, `ttl`, `hosted_zone_id`, `hosted_zone_name`, `traffic_policy_id`, `traffic_policy_name`, `traffic_policy_version`, `created_at` |
| `resolver_endpoints` | Inbound/Outbound VPC endpoints | `id`, `name`, `direction`, `vpc_id`, `ip_addresses`, `status`, `created_at` |
| `resolver_rules` | Forwarding DNS rules | `id`, `name`, `rule_type`, `domain_name`, `target_ip`, `vpc_id`, `status`, `created_at` |
| `route53_profiles` | Reusable VPC DNS profiles | `id`, `name`, `description`, `status`, `vpc_associations`, `resource_count`, `created_at` |

---

## API Overview

Interactive Swagger / OpenAPI docs are available at `http://localhost:8000/docs` when running the backend.

### Authentication (`/auth`)
- `POST /auth/register` — Register a new mocked IAM user
- `POST /auth/login` — OAuth2 password form login (returns JWT Bearer token)
- `POST /auth/login-json` — JSON login (`username`, `password` -> JWT + user metadata)
- `POST /auth/demo` — Sign in with seeded demo IAM user (`Vidushi`)
- `GET /auth/me` — Get current authenticated IAM user profile

### Hosted Zones (`/zones`) *(Requires Bearer Token)*
- `GET /zones/` — List hosted zones owned by current user
- `POST /zones/` — Create hosted zone (auto-generates `NS` and `SOA` apex records)
- `GET /zones/{zone_id}` — Get hosted zone details + name servers
- `PUT /zones/{zone_id}` — Update hosted zone description/comment
- `DELETE /zones/{zone_id}` — Delete hosted zone and cascade-delete its records
- `POST /zones/bulk-delete` — Delete multiple hosted zones (`{ "ids": [...] }`)
- `GET /zones/{zone_id}/export?format=bind|json` — Export zone as BIND `.zone` text or JSON

### DNS Records (`/zones/{zone_id}/records`) *(Requires Bearer Token)*
- `GET /zones/{zone_id}/records/` — List all records in a hosted zone
- `POST /zones/{zone_id}/records/` — Create DNS record (`A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA`)
- `GET /zones/{zone_id}/records/{record_id}` — Get single DNS record
- `PUT /zones/{zone_id}/records/{record_id}` — Update DNS record
- `DELETE /zones/{zone_id}/records/{record_id}` — Delete record (blocks apex `NS`/`SOA`)
- `POST /zones/{zone_id}/records/import-bind` — Import BIND zone file (`{ "zone_file": "..." }`)
- `POST /zones/{zone_id}/records/bulk-delete` — Bulk delete records while skipping apex `NS`/`SOA`
- `POST /zones/{zone_id}/records/bulk-ttl` — Bulk update TTL for multiple selected records

### Supporting Route 53 Services
- **Health Checks**: `GET /health-checks/`, `POST /health-checks/`, `POST /health-checks/{hc_id}/check`, `DELETE /health-checks/{hc_id}`
- **Traffic Management**: `GET /traffic-policies/`, `POST /traffic-policies/`, `POST /traffic-policies/{policy_id}/version`, `DELETE /traffic-policies/{policy_id}`, `GET /policy-records/`, `POST /policy-records/`, `DELETE /policy-records/{record_id}`
- **Resolver & Profiles**: `GET /resolver/endpoints/`, `POST /resolver/endpoints/`, `DELETE /resolver/endpoints/{ep_id}`, `GET /resolver/rules/`, `POST /resolver/rules/`, `DELETE /resolver/rules/{rule_id}`, `GET /profiles/`, `POST /profiles/`, `PUT /profiles/{profile_id}`, `DELETE /profiles/{profile_id}`

---

## Setup Instructions

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

### 1. Start the Backend (FastAPI + SQLite)

```bash
cd backend
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API base URL: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

### 2. Start the Frontend (Next.js + Cloudscape)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

- Web Console URL: `http://localhost:3000`
- Optional environment variable: set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local` when deploying to a remote backend.

---

## Demo & Credentials

- **Overview Page**: `http://localhost:3000`
- **IAM Sign-In Page**: `http://localhost:3000/login`
- **Demo Credentials**: Click **1-Click Demo Sign-In (Vidushi)** or enter username `Vidushi` / password `demo1234`.
- **Hosted Working Demo**: Deploy `backend/` (e.g., Railway / Render) and `frontend/` (e.g., Vercel with `NEXT_PUBLIC_API_URL` pointing to the deployed FastAPI URL), then add the live URL here before submission.
