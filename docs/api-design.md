# API Design & Endpoint Reference

All backend endpoints are served by **FastAPI** (`http://localhost:8000`) with interactive OpenAPI/Swagger documentation available at `/docs`.

---

## Architectural Rationale & RESTful Conventions

1. **Resource-Oriented URL Hierarchy**:
   - DNS records are strictly nested under their parent hosted zone (`/zones/{zone_id}/records/`), reflecting Route 53's ownership and cascade-delete boundary.
   - Dual lookup via numeric ID or domain name (`resolve_owned_zone`) lets the frontend use human-readable URLs (`/hosted-zones/example.com`) while falling back to unambiguous numeric IDs when duplicate domain names exist.
2. **Trailing-Slash Consistency (Zero-Redirect Collection Routes)**:
   - FastAPI collection routers register both `""` (`include_in_schema=False`) and `"/"` so clients calling `/zones` or `/zones/` never hit `307 Temporary Redirect` responses that could strip `Authorization` headers across HTTP/HTTPS proxies.
3. **Standard HTTP Status Codes & Pydantic v2 Validation**:
   - `200 OK` for reads/updates/actions, `201 Created` for resource creation, `204 No Content` for deletions.
   - `400 Bad Request` for domain-level business rule violations (invalid DNS syntax, duplicate IAM username, deleting apex `NS`/`SOA` records, empty BIND file).
   - `401 Unauthorized` for missing, invalid, or expired JWT Bearer tokens.
   - `404 Not Found` for non-existent or non-owned resource IDs.
   - `422 Unprocessable Entity` for Pydantic schema/type errors (e.g., invalid `RecordType`, `ttl <= 0`, password shorter than 6 characters).
4. **Action Sub-Resources for Non-CRUD Operations**:
   - Bulk operations (`POST /zones/bulk-delete`, `POST /zones/{zone_id}/records/bulk-delete`, `POST /zones/{zone_id}/records/bulk-ttl`), BIND import (`POST .../import-bind`), live health probing (`POST /health-checks/{hc_id}/check`), and policy versioning (`POST /traffic-policies/{policy_id}/version`) are modeled as explicit POST action sub-resources rather than overloading PATCH/PUT semantics.

---

## System Health

| Method | Route | Auth | Description | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | No | Service root health check | `200` |
| `GET` | `/health` | No | Health probe endpoint returning `{"status": "ok", "service": "AWS Route53 Clone API"}` | `200` |

---

## Authentication (`/auth`)

Authentication uses **JWT Bearer tokens** (`HS256`, 7-day expiry) with `bcrypt` password hashing.

| Method | Route | Auth | Request Body | Response | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | No | `UserCreate` (`username`, `password >= 6 chars`) | `UserRead` | `201`, `400` (duplicate), `422` |
| `POST` | `/auth/login` | No | OAuth2 Form (`username`, `password`) | `{ access_token, token_type, user }` | `200`, `401` |
| `POST` | `/auth/login-json` | No | `UserCreate` (`username`, `password`) | `{ access_token, token_type, user }` | `200`, `401` |
| `POST` | `/auth/demo` | No | None (auto-seeds/reuses user `Vidushi`) | `{ access_token, token_type, user }` | `200` |
| `GET` | `/auth/me` | Bearer | — | `{ id, username, account_id, is_active, created_at }` | `200`, `401` |

---

## Hosted Zones (`/zones`)

All `/zones` endpoints require a valid `Authorization: Bearer <token>` header and scope queries to `owner_id == current_user.id`.

| Method | Route | Request Body / Params | Response | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/zones/` | Query: `skip=0`, `limit=100` | `List[HostedZoneRead]` | `200`, `401` |
| `POST` | `/zones/` | `HostedZoneCreate` (`name`, `comment?`, `zone_type?`, `vpc_id?`, `vpc_region?`) | `HostedZoneRead` (with 4 `NS` + `SOA` created) | `201`, `400` (invalid domain), `401`, `422` |
| `GET` | `/zones/{zone_id}` | Path: numeric ID or domain name | `HostedZoneRead` | `200`, `401`, `404` |
| `PUT` | `/zones/{zone_id}` | `HostedZoneUpdate` (`name?`, `comment?`) | `HostedZoneRead` (renames child records & policy records if domain changes) | `200`, `400` (invalid domain), `401`, `404` |
| `DELETE` | `/zones/{zone_id}` | Path: numeric ID or domain name | Empty body (cascade-deletes all child DNS records) | `204`, `401`, `404` |
| `POST` | `/zones/bulk-delete` | `BulkDeleteRequest` (`{ ids: int[] }`) | `{ deleted: int }` | `200`, `401`, `422` |
| `GET` | `/zones/{zone_id}/export` | Query: `format=bind\|json` | Plain-text BIND `.zone` or JSON export | `200`, `401`, `404`, `422` |

---

## DNS Records (`/zones/{zone_id}/records`)

All `/zones/{zone_id}/records` endpoints require `Authorization: Bearer <token>` and verify zone ownership via `resolve_owned_zone()`.

| Method | Route | Request Body / Params | Response | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/zones/{zone_id}/records/` | Query: `skip=0`, `limit=200` | `List[DnsRecordRead]` | `200`, `401`, `404` |
| `POST` | `/zones/{zone_id}/records/` | `DnsRecordCreate` (`name`, `type`, `ttl > 0`, `value`, routing fields) | `DnsRecordRead` (FQDN normalized) | `201`, `401`, `404`, `422` |
| `GET` | `/zones/{zone_id}/records/{record_id}` | Path: `zone_id`, `record_id` | `DnsRecordRead` | `200`, `401`, `404` |
| `PUT` | `/zones/{zone_id}/records/{record_id}` | `DnsRecordUpdate` | `DnsRecordRead` | `200`, `401`, `404`, `422` |
| `DELETE` | `/zones/{zone_id}/records/{record_id}` | Path: `zone_id`, `record_id` | Empty body (blocks apex `NS`/`SOA`) | `204`, `400` (apex NS/SOA), `401`, `404` |
| `POST` | `/zones/{zone_id}/records/import-bind` | `BindImportRequest` (`{ zone_file: str }`) | `{ imported: int }` | `200`, `400` (no valid records), `401`, `404` |
| `POST` | `/zones/{zone_id}/records/bulk-delete` | `BulkDeleteRequest` (`{ ids: int[] }`) | `{ deleted: int, skipped_system: int }` | `200`, `401`, `404`, `422` |
| `POST` | `/zones/{zone_id}/records/bulk-ttl` | `BulkTtlUpdateRequest` (`{ ids: int[], ttl >= 1 }`) | `{ updated: int, ttl: int }` | `200`, `401`, `404`, `422` |

---

## Health Checks (`/health-checks`)

| Method | Route | Request Body | Response | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health-checks/` | — | `List[HealthCheckRead]` | `200` |
| `POST` | `/health-checks/` | `HealthCheckCreate` (`protocol`, `endpoint`, `port?`, `resource_path?`, etc.) | `HealthCheckRead` (runs initial live probe) | `201`, `422` |
| `GET` | `/health-checks/{hc_id}` | — | `HealthCheckRead` | `200`, `404` |
| `POST` | `/health-checks/{hc_id}/check` | — | `HealthCheckRead` (re-runs live probe & updates status) | `200`, `404` |
| `DELETE` | `/health-checks/{hc_id}` | — | Empty body | `204`, `404` |

---

## Traffic Policies & Policy Records

| Method | Route | Request Body | Response | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/traffic-policies/` | — | `List[TrafficPolicyRead]` | `200` |
| `POST` | `/traffic-policies/` | `TrafficPolicyCreate` (`name`, `dns_type`, `comment?`, `document?`) | `TrafficPolicyRead` (`version=1`) | `201`, `422` |
| `GET` | `/traffic-policies/{policy_id}` | — | `TrafficPolicyRead` | `200`, `404` |
| `POST` | `/traffic-policies/{policy_id}/version` | `TrafficPolicyUpdate` (`comment?`, `document?`) | `TrafficPolicyRead` (`version += 1`) | `200`, `404` |
| `DELETE` | `/traffic-policies/{policy_id}` | — | Empty body | `204`, `404` |
| `GET` | `/policy-records/` | — | `List[PolicyRecordRead]` | `200` |
| `POST` | `/policy-records/` | `PolicyRecordCreate` | `PolicyRecordRead` | `201`, `422` |
| `GET` | `/policy-records/{record_id}` | — | `PolicyRecordRead` | `200`, `404` |
| `DELETE` | `/policy-records/{record_id}` | — | Empty body | `204`, `404` |

---

## Resolver & Profiles

| Method | Route | Request Body | Response | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/resolver/endpoints/` | — | `List[ResolverEndpointRead]` | `200` |
| `POST` | `/resolver/endpoints/` | `ResolverEndpointCreate` (`name`, `direction`, `vpc_id`, `ip_addresses?`) | `ResolverEndpointRead` | `201`, `422` |
| `GET` | `/resolver/endpoints/{ep_id}` | — | `ResolverEndpointRead` | `200`, `404` |
| `DELETE` | `/resolver/endpoints/{ep_id}` | — | Empty body | `204`, `404` |
| `GET` | `/resolver/rules/` | — | `List[ResolverRuleRead]` | `200` |
| `POST` | `/resolver/rules/` | `ResolverRuleCreate` (`name`, `rule_type`, `domain_name`, `target_ip`, `vpc_id`) | `ResolverRuleRead` | `201`, `422` |
| `GET` | `/resolver/rules/{rule_id}` | — | `ResolverRuleRead` | `200`, `404` |
| `DELETE` | `/resolver/rules/{rule_id}` | — | Empty body | `204`, `404` |
| `GET` | `/profiles/` | — | `List[ProfileRead]` | `200` |
| `POST` | `/profiles/` | `ProfileCreate` (`name`, `description?`, `vpc_associations?`) | `ProfileRead` | `201`, `422` |
| `GET` | `/profiles/{profile_id}` | — | `ProfileRead` | `200`, `404` |
| `PUT` | `/profiles/{profile_id}` | `ProfileUpdate` (`description?`, `vpc_associations?`) | `ProfileRead` | `200`, `404` |
| `DELETE` | `/profiles/{profile_id}` | — | Empty body | `204`, `404` |

