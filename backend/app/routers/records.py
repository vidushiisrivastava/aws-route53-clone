import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, database
from ..dependencies import get_current_user
from .zones import resolve_owned_zone

router = APIRouter(prefix="/zones/{zone_id}/records", tags=["dns_records"])

ALLOWED_RECORD_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX", "NS", "SOA", "PTR", "SRV", "CAA"}


def format_record_name(raw_name: str, zone_name: str) -> str:
    clean_zone = zone_name.strip().rstrip(".")
    clean_sub = raw_name.strip().rstrip(".")
    if not clean_sub or clean_sub == "@" or clean_sub == clean_zone:
        return f"{clean_zone}."
    if clean_sub.endswith(f".{clean_zone}"):
        return f"{clean_sub}."
    return f"{clean_sub}.{clean_zone}."


def serialize_record(r: models.DnsRecord) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "type": r.type,
        "ttl": r.ttl,
        "value": r.value,
        "values": r.value,
        "routing_policy": r.routing_policy or "Simple",
        "weight": r.weight,
        "region": r.region,
        "failover": r.failover,
        "health_check_id": r.health_check_id,
        "set_identifier": r.set_identifier,
        "is_alias": bool(r.is_alias),
        "created_at": r.created_at,
        "zone_id": r.zone_id,
    }


def parse_bind_zone_file(zone_file: str, zone_name: str) -> list[dict]:
    """Parse standard BIND zone file records ($TTL, $ORIGIN, and RR lines)."""
    default_ttl = 300
    parsed: list[dict] = []
    last_name = "@"

    for raw_line in zone_file.splitlines():
        line = raw_line.split(";")[0].strip()
        if not line:
            continue
        if line.upper().startswith("$ORIGIN"):
            continue
        if line.upper().startswith("$TTL"):
            parts = line.split()
            if len(parts) >= 2 and parts[1].isdigit():
                default_ttl = int(parts[1])
            continue

        # Tokenize keeping quoted strings together (for TXT records)
        tokens = re.findall(r'"[^"]*"|\S+', line)
        if not tokens:
            continue

        idx = 0
        # If line starts with IN or TTL or type, reuse previous name
        first_upper = tokens[0].upper()
        if first_upper in ("IN",) or first_upper in ALLOWED_RECORD_TYPES or tokens[0].isdigit():
            rec_name = last_name
        else:
            rec_name = tokens[0]
            last_name = rec_name
            idx = 1

        ttl = default_ttl
        while idx < len(tokens):
            tok_upper = tokens[idx].upper()
            if tokens[idx].isdigit() and idx + 1 < len(tokens) and (
                tokens[idx + 1].upper() == "IN" or tokens[idx + 1].upper() in ALLOWED_RECORD_TYPES
            ):
                ttl = int(tokens[idx])
                idx += 1
            elif tok_upper == "IN":
                idx += 1
            else:
                break

        if idx >= len(tokens):
            continue
        rec_type = tokens[idx].upper()
        if rec_type not in ALLOWED_RECORD_TYPES:
            continue
        idx += 1
        rec_value = " ".join(tokens[idx:]).strip()
        if not rec_value:
            continue

        parsed.append({
            "name": format_record_name(rec_name, zone_name),
            "type": rec_type,
            "ttl": ttl,
            "value": rec_value,
        })

    return parsed


@router.get("", response_model=List[schemas.DnsRecordRead], include_in_schema=False)
@router.get("/", response_model=List[schemas.DnsRecordRead])
def list_records(
    zone_id: str,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)
    records = (
        db.query(models.DnsRecord)
        .filter(models.DnsRecord.zone_id == zone.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [serialize_record(r) for r in records]


@router.post("", response_model=schemas.DnsRecordRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=schemas.DnsRecordRead, status_code=status.HTTP_201_CREATED)
def create_record(
    zone_id: str,
    record: schemas.DnsRecordCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)

    full_name = format_record_name(record.name, zone.name)
    data = record.model_dump()
    data["name"] = full_name
    data["type"] = record.type.value if hasattr(record.type, "value") else str(record.type)

    db_record = models.DnsRecord(**data, zone_id=zone.id)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return serialize_record(db_record)


@router.post("/import-bind")
def import_bind_records(
    zone_id: str,
    payload: schemas.BindImportRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)

    parsed_items = parse_bind_zone_file(payload.zone_file, zone.name)
    if not parsed_items:
        raise HTTPException(
            status_code=400,
            detail="No valid DNS records found in the BIND zone file.",
        )

    created = []
    apex = f"{zone.name.rstrip('.')}."
    for item in parsed_items:
        # Skip duplicate SOA/NS at apex
        if item["name"] == apex and item["type"] in ("SOA", "NS"):
            continue
        rec = models.DnsRecord(
            name=item["name"],
            type=item["type"],
            ttl=item["ttl"],
            value=item["value"],
            routing_policy="Simple",
            zone_id=zone.id,
        )
        db.add(rec)
        created.append(rec)

    db.commit()
    return {"imported": len(created)}


@router.post("/bulk-delete")
def bulk_delete_records(
    zone_id: str,
    payload: schemas.BulkDeleteRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)

    records = (
        db.query(models.DnsRecord)
        .filter(models.DnsRecord.zone_id == zone.id, models.DnsRecord.id.in_(payload.ids))
        .all()
    )
    deleted_count = 0
    skipped_system = 0
    for r in records:
        if r.type == "SOA" or (r.type == "NS" and r.name.rstrip(".") == zone.name.rstrip(".")):
            skipped_system += 1
            continue
        db.delete(r)
        deleted_count += 1
    db.commit()
    return {"deleted": deleted_count, "skipped_system": skipped_system}


@router.post("/bulk-ttl")
def bulk_update_record_ttl(
    zone_id: str,
    payload: schemas.BulkTtlUpdateRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)

    records = (
        db.query(models.DnsRecord)
        .filter(models.DnsRecord.zone_id == zone.id, models.DnsRecord.id.in_(payload.ids))
        .all()
    )
    for r in records:
        r.ttl = payload.ttl
    db.commit()
    return {"updated": len(records), "ttl": payload.ttl}


@router.get("/{record_id}", response_model=schemas.DnsRecordRead)
def get_record(
    zone_id: str,
    record_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)
    record = (
        db.query(models.DnsRecord)
        .filter(models.DnsRecord.id == record_id, models.DnsRecord.zone_id == zone.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return serialize_record(record)


@router.put("/{record_id}", response_model=schemas.DnsRecordRead)
def update_record(
    zone_id: str,
    record_id: int,
    record_in: schemas.DnsRecordUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)

    record = (
        db.query(models.DnsRecord)
        .filter(models.DnsRecord.id == record_id, models.DnsRecord.zone_id == zone.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    data = record_in.model_dump()
    data["name"] = format_record_name(record_in.name, zone.name)
    data["type"] = record_in.type.value if hasattr(record_in.type, "value") else str(record_in.type)

    for field, value in data.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return serialize_record(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    zone_id: str,
    record_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = resolve_owned_zone(zone_id, current_user, db)

    record = (
        db.query(models.DnsRecord)
        .filter(models.DnsRecord.id == record_id, models.DnsRecord.zone_id == zone.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.type == "SOA" or (record.type == "NS" and record.name.rstrip(".") == zone.name.rstrip(".")):
        raise HTTPException(
            status_code=400,
            detail="Default SOA and apex NS records required by Route 53 cannot be deleted.",
        )

    db.delete(record)
    db.commit()
    return
