import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, database

router = APIRouter(tags=["traffic_management"])


# ---------- Traffic Policies ----------
@router.get("/traffic-policies/", response_model=List[schemas.TrafficPolicyRead])
def list_traffic_policies(db: Session = Depends(database.get_db)):
    return db.query(models.TrafficPolicy).order_by(models.TrafficPolicy.id.desc()).all()


@router.post("/traffic-policies/", response_model=schemas.TrafficPolicyRead, status_code=status.HTTP_201_CREATED)
def create_traffic_policy(payload: schemas.TrafficPolicyCreate, db: Session = Depends(database.get_db)):
    default_doc = json.dumps(
        {
            "AWSPolicyFormatVersion": "2015-10-01",
            "RecordType": payload.dns_type,
            "StartRule": "weighted_rule",
            "Endpoints": {
                "primary": {"Type": "value", "Value": "192.0.2.1"},
                "secondary": {"Type": "value", "Value": "198.51.100.2"},
            },
            "Rules": {
                "weighted_rule": {
                    "RuleType": "weighted",
                    "Items": [
                        {"Weight": "70", "EndpointReference": "primary"},
                        {"Weight": "30", "EndpointReference": "secondary"},
                    ],
                }
            },
        },
        indent=2,
    )
    policy = models.TrafficPolicy(
        name=payload.name.strip(),
        version=1,
        dns_type=payload.dns_type,
        comment=payload.comment or "",
        document=payload.document or default_doc,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.post("/traffic-policies/{policy_id}/version", response_model=schemas.TrafficPolicyRead)
def create_policy_version(policy_id: int, payload: schemas.TrafficPolicyUpdate, db: Session = Depends(database.get_db)):
    policy = db.query(models.TrafficPolicy).filter(models.TrafficPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Traffic policy not found")
    policy.version += 1
    if payload.comment is not None:
        policy.comment = payload.comment
    if payload.document is not None:
        policy.document = payload.document
    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/traffic-policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_traffic_policy(policy_id: int, db: Session = Depends(database.get_db)):
    policy = db.query(models.TrafficPolicy).filter(models.TrafficPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Traffic policy not found")
    db.delete(policy)
    db.commit()
    return


# ---------- Policy Records ----------
@router.get("/policy-records/", response_model=List[schemas.PolicyRecordRead])
def list_policy_records(db: Session = Depends(database.get_db)):
    return db.query(models.PolicyRecord).order_by(models.PolicyRecord.id.desc()).all()


@router.post("/policy-records/", response_model=schemas.PolicyRecordRead, status_code=status.HTTP_201_CREATED)
def create_policy_record(payload: schemas.PolicyRecordCreate, db: Session = Depends(database.get_db)):
    zone_name = payload.hosted_zone_name.strip()
    if payload.hosted_zone_id:
        z = db.query(models.HostedZone).filter(models.HostedZone.id == payload.hosted_zone_id).first()
        if z:
            zone_name = z.name

    policy_name = payload.traffic_policy_name
    policy_version = payload.traffic_policy_version
    rec_type = payload.type
    if payload.traffic_policy_id:
        p = db.query(models.TrafficPolicy).filter(models.TrafficPolicy.id == payload.traffic_policy_id).first()
        if p:
            policy_name = p.name
            policy_version = p.version
            rec_type = p.dns_type

    pr = models.PolicyRecord(
        name=payload.name.strip(),
        type=rec_type,
        ttl=payload.ttl,
        hosted_zone_id=payload.hosted_zone_id,
        hosted_zone_name=zone_name,
        traffic_policy_id=payload.traffic_policy_id,
        traffic_policy_name=policy_name,
        traffic_policy_version=policy_version,
    )
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return pr


@router.delete("/policy-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy_record(record_id: int, db: Session = Depends(database.get_db)):
    pr = db.query(models.PolicyRecord).filter(models.PolicyRecord.id == record_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Policy record not found")
    db.delete(pr)
    db.commit()
    return

