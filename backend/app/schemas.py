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
    zone_type: str = Field("Public", description="Public or Private")
    vpc_id: Optional[str] = None
    vpc_region: Optional[str] = None


class HostedZoneCreate(BaseModel):
    name: str = Field(..., description="The domain name of the hosted zone")
    comment: Optional[str] = None
    type: Optional[str] = "Public"
    zone_type: Optional[str] = None
    vpc_id: Optional[str] = None
    vpc_region: Optional[str] = None


class HostedZoneUpdate(BaseModel):
    name: Optional[str] = None
    comment: Optional[str] = None


class HostedZoneRead(BaseModel):
    id: int
    name: str
    comment: Optional[str] = None
    type: str = "Public"
    zone_type: str = "Public"
    vpc_id: Optional[str] = None
    vpc_region: Optional[str] = None
    record_count: int = 0
    nameservers: List[str] = []
    created_at: datetime
    owner_id: int
    model_config = ConfigDict(from_attributes=True)


# ---------- DNS Record ----------
class DnsRecordBase(BaseModel):
    name: str = Field(..., description="Record name relative to the zone")
    type: RecordType
    ttl: int = Field(300, gt=0)
    value: str = Field(..., description="Record value (IP, target, etc.)")
    routing_policy: str = "Simple"
    weight: Optional[int] = None
    region: Optional[str] = None
    failover: Optional[str] = None
    health_check_id: Optional[int] = None
    set_identifier: Optional[str] = None
    is_alias: bool = False
    model_config = ConfigDict(arbitrary_types_allowed=True, from_attributes=True)


class DnsRecordCreate(DnsRecordBase):
    pass


class DnsRecordUpdate(DnsRecordBase):
    pass


class DnsRecordRead(DnsRecordBase):
    id: int
    created_at: datetime
    zone_id: int
    values: str = ""
    model_config = ConfigDict(arbitrary_types_allowed=True, from_attributes=True)


# ---------- Health Check ----------
class HealthCheckCreate(BaseModel):
    name: Optional[str] = ""
    protocol: str = "HTTPS"
    endpoint: str
    port: Optional[int] = None
    resource_path: Optional[str] = "/"
    request_interval: int = 30
    failure_threshold: int = 3


class HealthCheckRead(BaseModel):
    id: int
    name: str
    protocol: str
    endpoint: str
    port: int
    resource_path: Optional[str] = "/"
    request_interval: int
    failure_threshold: int
    status: str
    status_reason: Optional[str] = None
    last_checked_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------- Traffic Policy ----------
class TrafficPolicyCreate(BaseModel):
    name: str
    dns_type: str = "A"
    comment: Optional[str] = ""
    document: Optional[str] = None


class TrafficPolicyUpdate(BaseModel):
    comment: Optional[str] = None
    document: Optional[str] = None


class TrafficPolicyRead(BaseModel):
    id: int
    name: str
    version: int
    dns_type: str
    comment: Optional[str] = ""
    document: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------- Policy Record ----------
class PolicyRecordCreate(BaseModel):
    name: str
    type: str = "A"
    ttl: int = 60
    hosted_zone_id: Optional[int] = None
    hosted_zone_name: str
    traffic_policy_id: Optional[int] = None
    traffic_policy_name: str = "Default"
    traffic_policy_version: int = 1


class PolicyRecordRead(BaseModel):
    id: int
    name: str
    type: str
    ttl: int
    hosted_zone_id: Optional[int] = None
    hosted_zone_name: str
    traffic_policy_id: Optional[int] = None
    traffic_policy_name: str
    traffic_policy_version: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------- Resolver ----------
class ResolverEndpointCreate(BaseModel):
    name: str
    direction: str = "OUTBOUND"
    vpc_id: str = "vpc-0a1b2c3d4e5f67890"
    ip_addresses: Optional[str] = None


class ResolverEndpointRead(BaseModel):
    id: int
    name: str
    direction: str
    vpc_id: str
    ip_addresses: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ResolverRuleCreate(BaseModel):
    name: str
    rule_type: str = "FORWARD"
    domain_name: str
    target_ip: str = "192.168.1.1"
    vpc_id: str = "vpc-0a1b2c3d4e5f67890"


class ResolverRuleRead(BaseModel):
    id: int
    name: str
    rule_type: str
    domain_name: str
    target_ip: str
    vpc_id: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------- Profiles ----------
class ProfileCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    vpc_associations: Optional[str] = ""


class ProfileUpdate(BaseModel):
    description: Optional[str] = None
    vpc_associations: Optional[str] = None


class ProfileRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    status: str
    vpc_associations: str
    resource_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------- Bonus: BIND Import & Bulk Operations ----------
class BindImportRequest(BaseModel):
    zone_file: str = Field(..., description="BIND zone file text")


class BulkDeleteRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)


class BulkTtlUpdateRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)
    ttl: int = Field(..., ge=1, le=2147483647)
