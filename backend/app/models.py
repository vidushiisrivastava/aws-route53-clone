from datetime import datetime
import enum

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    zones = relationship("HostedZone", back_populates="owner")


class HostedZone(Base):
    __tablename__ = "hosted_zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    comment = Column(String, nullable=True)
    zone_type = Column(String, default="Public", nullable=False)  # Public | Private
    vpc_id = Column(String, nullable=True)
    vpc_region = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="zones")

    records = relationship("DnsRecord", back_populates="zone", cascade="all, delete-orphan")


class RecordType(str, enum.Enum):
    A = "A"
    AAAA = "AAAA"
    CNAME = "CNAME"
    TXT = "TXT"
    MX = "MX"
    NS = "NS"
    SOA = "SOA"
    PTR = "PTR"
    SRV = "SRV"
    CAA = "CAA"


class DnsRecord(Base):
    __tablename__ = "dns_records"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    ttl = Column(Integer, default=300)
    value = Column(String, nullable=False)
    routing_policy = Column(String, default="Simple", nullable=False)
    weight = Column(Integer, nullable=True)
    region = Column(String, nullable=True)
    failover = Column(String, nullable=True)
    health_check_id = Column(Integer, nullable=True)
    set_identifier = Column(String, nullable=True)
    is_alias = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    zone_id = Column(Integer, ForeignKey("hosted_zones.id"))
    zone = relationship("HostedZone", back_populates="records")


class HealthCheck(Base):
    __tablename__ = "health_checks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    protocol = Column(String, default="HTTPS", nullable=False)  # HTTP | HTTPS | TCP
    endpoint = Column(String, nullable=False)
    port = Column(Integer, default=443, nullable=False)
    resource_path = Column(String, default="/", nullable=True)
    request_interval = Column(Integer, default=30, nullable=False)
    failure_threshold = Column(Integer, default=3, nullable=False)
    status = Column(String, default="Checking", nullable=False)  # Healthy | Unhealthy | Checking
    status_reason = Column(String, nullable=True)
    last_checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TrafficPolicy(Base):
    __tablename__ = "traffic_policies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    dns_type = Column(String, default="A", nullable=False)
    comment = Column(String, nullable=True)
    document = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PolicyRecord(Base):
    __tablename__ = "policy_records"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, default="A", nullable=False)
    ttl = Column(Integer, default=60, nullable=False)
    hosted_zone_id = Column(Integer, ForeignKey("hosted_zones.id"), nullable=True)
    hosted_zone_name = Column(String, nullable=False)
    traffic_policy_id = Column(Integer, ForeignKey("traffic_policies.id"), nullable=True)
    traffic_policy_name = Column(String, nullable=False)
    traffic_policy_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ResolverEndpoint(Base):
    __tablename__ = "resolver_endpoints"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    direction = Column(String, default="OUTBOUND", nullable=False)  # INBOUND | OUTBOUND
    vpc_id = Column(String, default="vpc-0a1b2c3d4e5f67890", nullable=False)
    ip_addresses = Column(String, default="10.0.1.10, 10.0.2.10", nullable=False)
    status = Column(String, default="OPERATIONAL", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ResolverRule(Base):
    __tablename__ = "resolver_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rule_type = Column(String, default="FORWARD", nullable=False)
    domain_name = Column(String, nullable=False)
    target_ip = Column(String, nullable=False)
    vpc_id = Column(String, default="vpc-0a1b2c3d4e5f67890", nullable=False)
    status = Column(String, default="COMPLETE", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Route53Profile(Base):
    __tablename__ = "route53_profiles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="COMPLETE", nullable=False)
    vpc_associations = Column(Text, default="", nullable=False)  # comma-separated VPC IDs
    resource_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
