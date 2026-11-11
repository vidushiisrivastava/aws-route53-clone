from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas, database

router = APIRouter(prefix="/zones", tags=["hosted_zones"])

DEMO_USER_ID = 1  # All zones belong to the demo user

def get_or_create_demo_user(db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.id == DEMO_USER_ID).first()
    if not user:
        import bcrypt
        hashed = bcrypt.hashpw(b"demo1234", bcrypt.gensalt()).decode()
        user = models.User(username="demo", hashed_password=hashed, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.get("/", response_model=List[schemas.HostedZoneRead])
def list_zones(skip: int = 0, limit: int = 20, db: Session = Depends(database.get_db)):
    get_or_create_demo_user(db)
    zones = db.query(models.HostedZone).filter(models.HostedZone.owner_id == DEMO_USER_ID).offset(skip).limit(limit).all()
    return zones

@router.post("/", response_model=schemas.HostedZoneRead, status_code=status.HTTP_201_CREATED)
def create_zone(zone: schemas.HostedZoneCreate, db: Session = Depends(database.get_db)):
    get_or_create_demo_user(db)
    db_zone = models.HostedZone(**zone.model_dump(), owner_id=DEMO_USER_ID)
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return db_zone

@router.get("/{zone_id}", response_model=schemas.HostedZoneRead)
def get_zone(zone_id: int, db: Session = Depends(database.get_db)):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == DEMO_USER_ID).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    return zone

@router.put("/{zone_id}", response_model=schemas.HostedZoneRead)
def update_zone(zone_id: int, zone_in: schemas.HostedZoneUpdate, db: Session = Depends(database.get_db)):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == DEMO_USER_ID).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    for field, value in zone_in.model_dump().items():
        setattr(zone, field, value)
    db.commit()
    db.refresh(zone)
    return zone

@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(zone_id: int, db: Session = Depends(database.get_db)):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id, models.HostedZone.owner_id == DEMO_USER_ID).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    db.delete(zone)
    db.commit()
    return
