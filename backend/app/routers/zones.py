from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List
import random
import re

from .. import models, schemas, database
from ..dependencies import get_current_user

router = APIRouter(prefix="/zones", tags=["hosted_zones"])

DOMAIN_NAME_RE = re.compile(
    r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$"
)


def validate_domain_name(raw_name: str) -> str:
    """Normalize trailing dot and validate DNS domain name syntax."""
    clean_name = (raw_name or "").strip().rstrip(".")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Domain name cannot be empty.")
    if len(clean_name) > 253 or not DOMAIN_NAME_RE.match(clean_name):
        raise HTTPException(
            status_code=400,
            detail="Enter a valid domain name (e.g. example.com).",
        )
    return clean_name


def generate_aws_nameservers(seed: int) -> List[str]:
    rng = random.Random(seed)
    tlds = ["com", "net", "org", "co.uk"]
    ns_list = []
    for tld in tlds:
        n1 = rng.randint(100, 2048)
        n2 = rng.randint(10, 63)
        ns_list.append(f"ns-{n1}.awsdns-{n2}.{tld}.")
    return ns_list


def serialize_zone(zone: models.HostedZone) -> dict:
    ns_records = [
        r for r in zone.records
        if r.type == "NS" and r.name.rstrip(".") == zone.name.rstrip(".")
    ]
    if ns_records:
        nameservers = [line.strip() for line in ns_records[0].value.splitlines() if line.strip()]
    else:
        nameservers = generate_aws_nameservers(zone.id)

    return {
        "id": zone.id,
        "name": zone.name,
        "comment": zone.comment,
        "type": zone.zone_type or "Public",
        "zone_type": zone.zone_type or "Public",
        "vpc_id": zone.vpc_id,
        "vpc_region": zone.vpc_region,
        "record_count": len(zone.records),
        "nameservers": nameservers,
        "created_at": zone.created_at,
        "owner_id": zone.owner_id,
    }


def resolve_owned_zone(
    zone_ref: str, current_user: models.User, db: Session
) -> models.HostedZone:
    """Resolve a hosted zone by numeric ID or domain name owned by the current user."""
    ref = zone_ref.strip().rstrip(".")
    query = db.query(models.HostedZone).filter(models.HostedZone.owner_id == current_user.id)
    if ref.isdigit():
        zone = query.filter(models.HostedZone.id == int(ref)).first()
    else:
        zone = (
            query.filter(models.HostedZone.name == ref)
            .order_by(models.HostedZone.id.desc())
            .first()
        )
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    return zone


@router.get("", response_model=List[schemas.HostedZoneRead], include_in_schema=False)
@router.get("/", response_model=List[schemas.HostedZoneRead])
def list_zones(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zones = (
        db.query(models.HostedZone)
        .filter(models.HostedZone.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [serialize_zone(z) for z in zones]


@router.post("", response_model=schemas.HostedZoneRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=schemas.HostedZoneRead, status_code=status.HTTP_201_CREATED)
def create_zone(
    zone: schemas.HostedZoneCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    clean_name = validate_domain_name(zone.name)
    z_type = (
        "Private"
        if (zone.zone_type or "").lower() == "private" or (zone.type or "").lower() == "private"
        else "Public"
    )

    db_zone = models.HostedZone(
        name=clean_name,
        comment=zone.comment,
        zone_type=z_type,
        vpc_id=zone.vpc_id if z_type == "Private" else None,
        vpc_region=zone.vpc_region if z_type == "Private" else None,
        owner_id=current_user.id,
    )
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)

    # Automatically create default NS and SOA records like AWS Route 53
    nameservers = generate_aws_nameservers(db_zone.id)
    apex_name = f"{clean_name}."

    ns_record = models.DnsRecord(
        name=apex_name,
        type="NS",
        ttl=172800,
        value="\n".join(nameservers),
        routing_policy="Simple",
        zone_id=db_zone.id,
    )
    soa_record = models.DnsRecord(
        name=apex_name,
        type="SOA",
        ttl=900,
        value=f"{nameservers[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
        routing_policy="Simple",
        zone_id=db_zone.id,
    )
    db.add_all([ns_record, soa_record])
    db.commit()
    db.refresh(db_zone)

    return serialize_zone(db_zone)


@router.get("/{zone_id}", response_model=schemas.HostedZoneRead)
def get_zone(
    zone_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)
    return serialize_zone(zone)


@router.put("/{zone_id}", response_model=schemas.HostedZoneRead)
def update_zone(
    zone_id: str,
    zone_in: schemas.HostedZoneUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)
    if zone_in.name is not None:
        new_name = validate_domain_name(zone_in.name)
        old_name = zone.name.strip().rstrip(".")
        if new_name != old_name:
            old_apex = f"{old_name}."
            new_apex = f"{new_name}."
            old_suffix = f".{old_name}."
            for rec in zone.records:
                rec_name = (rec.name or "").strip()
                if rec_name == old_apex or rec_name == old_name:
                    rec.name = new_apex
                elif rec_name.endswith(old_suffix):
                    rec.name = f"{rec_name[:-len(old_suffix)]}.{new_name}."
            policy_recs = (
                db.query(models.PolicyRecord)
                .filter(models.PolicyRecord.hosted_zone_id == zone.id)
                .all()
            )
            for pr in policy_recs:
                pr.hosted_zone_name = new_name
            zone.name = new_name
    if zone_in.comment is not None:
        zone.comment = zone_in.comment
    db.commit()
    db.refresh(zone)
    return serialize_zone(zone)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(
    zone_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)
    db.delete(zone)
    db.commit()
    return


@router.post("/bulk-delete")
def bulk_delete_zones(
    payload: schemas.BulkDeleteRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zones = (
        db.query(models.HostedZone)
        .filter(
            models.HostedZone.id.in_(payload.ids),
            models.HostedZone.owner_id == current_user.id,
        )
        .all()
    )
    deleted_count = 0
    for z in zones:
        db.delete(z)
        deleted_count += 1
    db.commit()
    return {"deleted": deleted_count}


@router.get("/{zone_id}/export")
def export_zone(
    zone_id: str,
    format: str = Query("bind", pattern="^(bind|json)$"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)

    if format == "json":
        return JSONResponse(
            content={
                "hosted_zone": {
                    "id": zone.id,
                    "name": zone.name,
                    "type": zone.zone_type,
                    "comment": zone.comment,
                },
                "records": [
                    {
                        "name": r.name,
                        "type": r.type,
                        "ttl": r.ttl,
                        "value": r.value,
                        "routing_policy": r.routing_policy,
                        "is_alias": bool(r.is_alias),
                    }
                    for r in zone.records
                ],
            }
        )

    origin = f"{zone.name.rstrip('.')}."
    lines = [
        f"; Exported from AWS Route 53 Clone",
        f"$ORIGIN {origin}",
        f"$TTL 300",
        "",
    ]
    for r in zone.records:
        for val_line in r.value.splitlines():
            v = val_line.strip()
            if not v:
                continue
            lines.append(f"{r.name:<35} {r.ttl:<8} IN {r.type:<8} {v}")

    return PlainTextResponse("\n".join(lines))


@router.get("/{zone_id}/simulate")
def simulate_dns_query(
    zone_id: str,
    name: str = Query(..., description="Record name or '@' for zone apex"),
    type: str = Query("A", description="DNS record type (A, AAAA, CNAME, TXT, MX, etc.)"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Simulate Route 53 DNS resolution for a record name and type, factoring in routing policies & health checks."""
    zone = resolve_owned_zone(zone_id, current_user, db)
    clean_zone = zone.name.strip().rstrip(".")
    clean_sub = name.strip().rstrip(".")
    if not clean_sub or clean_sub == "@" or clean_sub == clean_zone:
        fqdn = f"{clean_zone}."
    elif clean_sub.endswith(f".{clean_zone}"):
        fqdn = f"{clean_sub}."
    else:
        fqdn = f"{clean_sub}.{clean_zone}."

    qtype = type.strip().upper()
    candidates = [
        r for r in zone.records
        if r.name.lower() == fqdn.lower() and r.type.upper() == qtype
    ]
    if not candidates:
        return {
            "query_name": fqdn,
            "query_type": qtype,
            "response_code": "NXDOMAIN",
            "routing_policy": None,
            "ttl": None,
            "answers": [],
            "evaluated_records": [],
        }

    hc_ids = {r.health_check_id for r in candidates if r.health_check_id}
    hc_map = {}
    if hc_ids:
        for hc in db.query(models.HealthCheck).filter(models.HealthCheck.id.in_(hc_ids)).all():
            hc_map[hc.id] = hc.status

    evaluated = []
    healthy_candidates = []
    for r in candidates:
        hc_status = hc_map.get(r.health_check_id, "Healthy" if not r.health_check_id else "Unknown")
        is_healthy = hc_status != "Unhealthy"
        evaluated.append({
            "id": r.id,
            "routing_policy": r.routing_policy or "Simple",
            "weight": r.weight,
            "failover": r.failover,
            "health_check_status": hc_status if r.health_check_id else None,
            "selected": False,
            "value": r.value,
        })
        if is_healthy:
            healthy_candidates.append((r, evaluated[-1]))

    pool = healthy_candidates or [(r, ev) for r, ev in zip(candidates, evaluated)]
    policy = pool[0][0].routing_policy or "Simple"
    if policy == "Failover":
        pool.sort(key=lambda pair: 0 if (pair[0].failover or "").upper() == "PRIMARY" else 1)
        chosen = [pool[0]]
    elif policy == "Weighted":
        pool.sort(key=lambda pair: pair[0].weight or 0, reverse=True)
        chosen = [pool[0]]
    else:
        chosen = [pool[0]]

    answers: list[str] = []
    for rec, ev in chosen:
        ev["selected"] = True
        answers.extend([line.strip() for line in rec.value.splitlines() if line.strip()])

    return {
        "query_name": fqdn,
        "query_type": qtype,
        "response_code": "NOERROR",
        "routing_policy": policy,
        "ttl": chosen[0][0].ttl,
        "answers": answers,
        "evaluated_records": evaluated,
    }
