from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict
from .models import RecordType

# ---------- User ----------
class UserCreate(BaseModel):
    username: str = Field(..., max_length=50)
    password: str = Field(..., min_length=6)

class UserRead(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ---------- Hosted Zone ----------
class HostedZoneBase(BaseModel):
    name: str = Field(..., description="The domain name of the hosted zone")
    comment: Optional[str] = None

class HostedZoneCreate(HostedZoneBase):
    pass

class HostedZoneUpdate(HostedZoneBase):
    pass

class HostedZoneRead(HostedZoneBase):
    id: int
    created_at: datetime
    owner_id: int
    model_config = ConfigDict(from_attributes=True)

# ---------- DNS Record ----------
class DnsRecordBase(BaseModel):
    name: str = Field(..., description="Record name relative to the zone")
    type: RecordType
    ttl: int = Field(300, gt=0)
    value: str = Field(..., description="Record value (IP, target, etc.)")
    model_config = ConfigDict(arbitrary_types_allowed=True, from_attributes=True)

class DnsRecordCreate(DnsRecordBase):
    pass

class DnsRecordUpdate(DnsRecordBase):
    pass

class DnsRecordRead(DnsRecordBase):
    id: int
    created_at: datetime
    zone_id: int
    model_config = ConfigDict(arbitrary_types_allowed=True, from_attributes=True)
