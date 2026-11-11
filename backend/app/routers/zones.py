from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List
import random

from .. import models, schemas, database
from ..dependencies import get_current_user

router = APIRouter(prefix="/zones", tags=["hosted_zones"])


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


@router.post("/", response_model=schemas.HostedZoneRead, status_code=status.HTTP_201_CREATED)
def create_zone(
    zone: schemas.HostedZoneCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    clean_name = zone.name.strip().rstrip(".")
    z_type = zone.zone_type or zone.type or "Public"
    z_type = "Private" if z_type.lower() == "private" else "Public"

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
    zone_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = (
        db.query(models.HostedZone)
        .filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == current_user.id)
        .first()
    )
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    return serialize_zone(zone)


@router.put("/{zone_id}", response_model=schemas.HostedZoneRead)
def update_zone(
    zone_id: int,
    zone_in: schemas.HostedZoneUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = (
        db.query(models.HostedZone)
        .filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == current_user.id)
        .first()
    )
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    if zone_in.comment is not None:
        zone.comment = zone_in.comment
    db.commit()
    db.refresh(zone)
    return serialize_zone(zone)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(
    zone_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = (
        db.query(models.HostedZone)
        .filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == current_user.id)
        .first()
    )
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
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
    zone_id: int,
    format: str = Query("bind", pattern="^(bind|json)$"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = (
        db.query(models.HostedZone)
        .filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == current_user.id)
        .first()
    )
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

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
