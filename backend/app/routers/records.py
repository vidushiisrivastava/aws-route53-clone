from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas, database

router = APIRouter(prefix="/zones/{zone_id}/records", tags=["dns_records"])

DEMO_USER_ID = 1

@router.get("/", response_model=List[schemas.DnsRecordRead])
def list_records(zone_id: int, skip: int = 0, limit: int = 20, db: Session = Depends(database.get_db)):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == DEMO_USER_ID).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    records = db.query(models.DnsRecord).filter(models.DnsRecord.zone_id == zone_id).offset(skip).limit(limit).all()
    return records

@router.post("/", response_model=schemas.DnsRecordRead, status_code=status.HTTP_201_CREATED)
def create_record(zone_id: int, record: schemas.DnsRecordCreate, db: Session = Depends(database.get_db)):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == DEMO_USER_ID).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    db_record = models.DnsRecord(**record.model_dump(), zone_id=zone_id)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/{record_id}", response_model=schemas.DnsRecordRead)
def get_record(zone_id: int, record_id: int, db: Session = Depends(database.get_db)):
    record = db.query(models.DnsRecord).filter(models.DnsRecord.id == record_id, models.DnsRecord.zone_id == zone_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.put("/{record_id}", response_model=schemas.DnsRecordRead)
def update_record(zone_id: int, record_id: int, record_in: schemas.DnsRecordUpdate, db: Session = Depends(database.get_db)):
    record = db.query(models.DnsRecord).filter(models.DnsRecord.id == record_id, models.DnsRecord.zone_id == zone_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    for field, value in record_in.model_dump().items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(zone_id: int, record_id: int, db: Session = Depends(database.get_db)):
    record = db.query(models.DnsRecord).filter(models.DnsRecord.id == record_id, models.DnsRecord.zone_id == zone_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()
    return
