from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, database

router = APIRouter(tags=["resolver_and_profiles"])


# ---------- Resolver Endpoints ----------
@router.get("/resolver/endpoints/", response_model=List[schemas.ResolverEndpointRead])
def list_resolver_endpoints(db: Session = Depends(database.get_db)):
    return db.query(models.ResolverEndpoint).order_by(models.ResolverEndpoint.id.desc()).all()


@router.post("/resolver/endpoints/", response_model=schemas.ResolverEndpointRead, status_code=status.HTTP_201_CREATED)
def create_resolver_endpoint(payload: schemas.ResolverEndpointCreate, db: Session = Depends(database.get_db)):
    ep = models.ResolverEndpoint(
        name=payload.name.strip(),
        direction=payload.direction.upper(),
        vpc_id=payload.vpc_id.strip() or "vpc-0a1b2c3d4e5f67890",
        ip_addresses=(payload.ip_addresses or "10.0.1.10, 10.0.2.10").strip(),
        status="OPERATIONAL",
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


@router.delete("/resolver/endpoints/{ep_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resolver_endpoint(ep_id: int, db: Session = Depends(database.get_db)):
    ep = db.query(models.ResolverEndpoint).filter(models.ResolverEndpoint.id == ep_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Resolver endpoint not found")
    db.delete(ep)
    db.commit()
    return


# ---------- Resolver Rules ----------
@router.get("/resolver/rules/", response_model=List[schemas.ResolverRuleRead])
def list_resolver_rules(db: Session = Depends(database.get_db)):
    return db.query(models.ResolverRule).order_by(models.ResolverRule.id.desc()).all()


@router.post("/resolver/rules/", response_model=schemas.ResolverRuleRead, status_code=status.HTTP_201_CREATED)
def create_resolver_rule(payload: schemas.ResolverRuleCreate, db: Session = Depends(database.get_db)):
    rule = models.ResolverRule(
        name=payload.name.strip(),
        rule_type=payload.rule_type.upper(),
        domain_name=payload.domain_name.strip(),
        target_ip=payload.target_ip.strip() or "192.168.1.1",
        vpc_id=payload.vpc_id.strip() or "vpc-0a1b2c3d4e5f67890",
        status="COMPLETE",
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/resolver/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resolver_rule(rule_id: int, db: Session = Depends(database.get_db)):
    rule = db.query(models.ResolverRule).filter(models.ResolverRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Resolver rule not found")
    db.delete(rule)
    db.commit()
    return


# ---------- Profiles ----------
@router.get("/profiles/", response_model=List[schemas.ProfileRead])
def list_profiles(db: Session = Depends(database.get_db)):
    return db.query(models.Route53Profile).order_by(models.Route53Profile.id.desc()).all()


@router.post("/profiles/", response_model=schemas.ProfileRead, status_code=status.HTTP_201_CREATED)
def create_profile(payload: schemas.ProfileCreate, db: Session = Depends(database.get_db)):
    vpcs = [v.strip() for v in (payload.vpc_associations or "").split(",") if v.strip()]
    profile = models.Route53Profile(
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        status="COMPLETE",
        vpc_associations=", ".join(vpcs),
        resource_count=0,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/profiles/{profile_id}", response_model=schemas.ProfileRead)
def update_profile(profile_id: int, payload: schemas.ProfileUpdate, db: Session = Depends(database.get_db)):
    profile = db.query(models.Route53Profile).filter(models.Route53Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if payload.description is not None:
        profile.description = payload.description
    if payload.vpc_associations is not None:
        vpcs = [v.strip() for v in payload.vpc_associations.split(",") if v.strip()]
        profile.vpc_associations = ", ".join(vpcs)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: int, db: Session = Depends(database.get_db)):
    profile = db.query(models.Route53Profile).filter(models.Route53Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()
    return

