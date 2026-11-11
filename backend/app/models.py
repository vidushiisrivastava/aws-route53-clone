from datetime import datetime
from typing import List, Optional

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
import enum
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
    created_at = Column(DateTime, default=datetime.utcnow)

    zone_id = Column(Integer, ForeignKey("hosted_zones.id"))
    zone = relationship("HostedZone", back_populates="records")
