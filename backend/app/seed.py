"""Idempotent SQLite database seeder for the AWS Route 53 Clone."""

from datetime import datetime, timezone
import json
from typing import Any

from sqlalchemy.orm import Session

from . import models
from .routers.auth import get_password_hash
from .routers.zones import generate_aws_nameservers

DEMO_ACCOUNTS: list[dict[str, str]] = [
    {"username": "Vidushi", "password": "demo1234", "role": "1-Click Demo IAM User"},
    {"username": "admin@route53demo.com", "password": "AdminDemo123!", "role": "Administrator"},
    {"username": "devops@route53demo.com", "password": "DevopsDemo123!", "role": "DevOps Engineer"},
    {"username": "viewer@route53demo.com", "password": "ViewerDemo123!", "role": "Read-Only Viewer"},
]

# 28 realistic hosted zones (Public + Private) distributed across demo accounts
SEED_ZONES: list[dict[str, Any]] = [
    # Vidushi (10 zones)
    {"owner": "Vidushi", "name": "cloudscale-prod.io", "zone_type": "Public", "comment": "Primary production web & API domain"},
    {"owner": "Vidushi", "name": "api-gateway.dev", "zone_type": "Public", "comment": "Developer API gateway endpoints"},
    {"owner": "Vidushi", "name": "shopfront-cdn.com", "zone_type": "Public", "comment": "Global e-commerce storefront & CloudFront aliases"},
    {"owner": "Vidushi", "name": "telemetry-ingest.net", "zone_type": "Public", "comment": "Multi-region observability collectors"},
    {"owner": "Vidushi", "name": "auth-identity.org", "zone_type": "Public", "comment": "SSO & OAuth2 identity provider zone"},
    {"owner": "Vidushi", "name": "media-assets.co", "zone_type": "Public", "comment": "Static media and image CDN distribution"},
    {"owner": "Vidushi", "name": "corp.internal", "zone_type": "Private", "vpc_id": "vpc-0a1b2c3d4e5f67890", "vpc_region": "us-east-1", "comment": "Corporate internal service discovery"},
    {"owner": "Vidushi", "name": "mesh.prod.local", "zone_type": "Private", "vpc_id": "vpc-0a1b2c3d4e5f67890", "vpc_region": "us-east-1", "comment": "Kubernetes service mesh internal DNS"},
    {"owner": "Vidushi", "name": "rds-clusters.internal", "zone_type": "Private", "vpc_id": "vpc-0f9e8d7c6b5a43210", "vpc_region": "us-west-2", "comment": "Private Aurora & PostgreSQL endpoints"},
    {"owner": "Vidushi", "name": "statuspage-live.io", "zone_type": "Public", "comment": "Customer-facing uptime and status portal"},
    # admin@route53demo.com (8 zones)
    {"owner": "admin@route53demo.com", "name": "enterprise-core.com", "zone_type": "Public", "comment": "Enterprise root domain and mail routing"},
    {"owner": "admin@route53demo.com", "name": "payments-edge.io", "zone_type": "Public", "comment": "PCI-compliant payment processing edge"},
    {"owner": "admin@route53demo.com", "name": "portal-sso.net", "zone_type": "Public", "comment": "Workforce SSO & SAML federation"},
    {"owner": "admin@route53demo.com", "name": "docs-platform.org", "zone_type": "Public", "comment": "Developer documentation & changelog"},
    {"owner": "admin@route53demo.com", "name": "analytics-lake.io", "zone_type": "Public", "comment": "Customer BI & reporting endpoints"},
    {"owner": "admin@route53demo.com", "name": "billing-vpc.internal", "zone_type": "Private", "vpc_id": "vpc-01122334455667788", "vpc_region": "us-east-1", "comment": "Isolated billing microservice VPC zone"},
    {"owner": "admin@route53demo.com", "name": "vault-secrets.internal", "zone_type": "Private", "vpc_id": "vpc-01122334455667788", "vpc_region": "eu-west-1", "comment": "HashiCorp Vault private cluster DNS"},
    {"owner": "admin@route53demo.com", "name": "partner-b2b.com", "zone_type": "Public", "comment": "B2B partner webhook & EDI endpoints"},
    # devops@route53demo.com (6 zones)
    {"owner": "devops@route53demo.com", "name": "ci-runners.dev", "zone_type": "Public", "comment": "GitHub Actions & build artifact mirrors"},
    {"owner": "devops@route53demo.com", "name": "staging-app.io", "zone_type": "Public", "comment": "Pre-production staging environment"},
    {"owner": "devops@route53demo.com", "name": "k8s-ingress.net", "zone_type": "Public", "comment": "EKS ingress controller wildcard zone"},
    {"owner": "devops@route53demo.com", "name": "observability.internal", "zone_type": "Private", "vpc_id": "vpc-09988776655443322", "vpc_region": "us-west-2", "comment": "Prometheus, Grafana & Jaeger internal DNS"},
    {"owner": "devops@route53demo.com", "name": "kafka-brokers.internal", "zone_type": "Private", "vpc_id": "vpc-09988776655443322", "vpc_region": "us-west-2", "comment": "MSK Kafka bootstrap & broker records"},
    {"owner": "devops@route53demo.com", "name": "terraform-state.org", "zone_type": "Public", "comment": "Remote state & module registry endpoints"},
    # viewer@route53demo.com (4 zones)
    {"owner": "viewer@route53demo.com", "name": "sandbox-demo.io", "zone_type": "Public", "comment": "Read-only sandbox showcase domain"},
    {"owner": "viewer@route53demo.com", "name": "marketing-site.com", "zone_type": "Public", "comment": "Public marketing landing pages"},
    {"owner": "viewer@route53demo.com", "name": "audit-logs.internal", "zone_type": "Private", "vpc_id": "vpc-0abcdef1234567890", "vpc_region": "us-east-1", "comment": "Centralized audit archive private zone"},
    {"owner": "viewer@route53demo.com", "name": "qa-preview.dev", "zone_type": "Public", "comment": "Automated PR preview environments"},
]

SEED_HEALTH_CHECKS: list[dict[str, Any]] = [
    {"owner": "Vidushi", "name": "prod-api-us-east", "protocol": "HTTPS", "endpoint": "api.cloudscale-prod.io", "port": 443, "resource_path": "/health", "status": "Healthy", "status_reason": "Success: HTTP Status Code 200"},
    {"owner": "Vidushi", "name": "prod-api-eu-west", "protocol": "HTTPS", "endpoint": "eu.cloudscale-prod.io", "port": 443, "resource_path": "/healthz", "status": "Healthy", "status_reason": "Success: HTTP Status Code 200"},
    {"owner": "Vidushi", "name": "legacy-tcp-ingestor", "protocol": "TCP", "endpoint": "ingest.telemetry-ingest.net", "port": 8443, "resource_path": "/", "status": "Unhealthy", "status_reason": "Connection failed: timed out"},
    {"owner": "admin@route53demo.com", "name": "payments-primary-hc", "protocol": "HTTPS", "endpoint": "checkout.payments-edge.io", "port": 443, "resource_path": "/status", "status": "Healthy", "status_reason": "Success: HTTP Status Code 200"},
    {"owner": "devops@route53demo.com", "name": "staging-ingress-hc", "protocol": "HTTP", "endpoint": "staging-app.io", "port": 80, "resource_path": "/ready", "status": "Healthy", "status_reason": "Success: HTTP Status Code 200"},
]

SEED_TRAFFIC_POLICIES: list[dict[str, Any]] = [
    {"owner": "Vidushi", "name": "global-weighted-failover", "dns_type": "A", "comment": "70/30 US-East vs EU-West weighted failover"},
    {"owner": "Vidushi", "name": "geo-cdn-routing", "dns_type": "CNAME", "comment": "Geolocation routing to regional CloudFront edges"},
    {"owner": "admin@route53demo.com", "name": "payments-active-passive", "dns_type": "A", "comment": "Primary/Secondary active-passive DR policy"},
    {"owner": "devops@route53demo.com", "name": "canary-eks-rollout", "dns_type": "A", "comment": "90/10 canary ingress traffic split"},
]


def _build_zone_records(zone: models.HostedZone, nameservers: list[str], idx: int) -> list[models.DnsRecord]:
    """Build apex NS/SOA plus realistic A, AAAA, CNAME, MX, TXT, NS, SRV records."""
    apex = f"{zone.name.rstrip('.')}."
    octet = 10 + (idx % 200)
    records = [
        models.DnsRecord(
            name=apex,
            type="NS",
            ttl=172800,
            value="\n".join(nameservers),
            routing_policy="Simple",
            zone_id=zone.id,
        ),
        models.DnsRecord(
            name=apex,
            type="SOA",
            ttl=900,
            value=f"{nameservers[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
            routing_policy="Simple",
            zone_id=zone.id,
        ),
        models.DnsRecord(
            name=apex,
            type="A",
            ttl=300,
            value=f"203.0.113.{octet}",
            routing_policy="Simple",
            zone_id=zone.id,
        ),
        models.DnsRecord(
            name=apex,
            type="AAAA",
            ttl=300,
            value=f"2001:db8:85a3::{octet:x}",
            routing_policy="Simple",
            zone_id=zone.id,
        ),
        models.DnsRecord(
            name=f"www.{apex}",
            type="CNAME",
            ttl=300,
            value=apex,
            routing_policy="Simple",
            zone_id=zone.id,
        ),
        models.DnsRecord(
            name=apex,
            type="TXT",
            ttl=300,
            value=f'"v=spf1 include:_spf.{zone.name} ~all"',
            routing_policy="Simple",
            zone_id=zone.id,
        ),
    ]

    # Add MX, subdomain NS delegation, SRV, and weighted A records across zones
    if idx % 2 == 0:
        records.append(
            models.DnsRecord(
                name=apex,
                type="MX",
                ttl=3600,
                value=f"10 mail.{apex}\n20 mail2.{apex}",
                routing_policy="Simple",
                zone_id=zone.id,
            )
        )
        records.append(
            models.DnsRecord(
                name=f"api.{apex}",
                type="A",
                ttl=60,
                value=f"198.51.100.{octet}",
                routing_policy="Weighted",
                weight=70,
                set_identifier="us-east-1",
                zone_id=zone.id,
            )
        )
    if idx % 3 == 0:
        records.append(
            models.DnsRecord(
                name=f"_sip._tcp.{apex}",
                type="SRV",
                ttl=300,
                value=f"10 60 5060 sip.{apex}",
                routing_policy="Simple",
                zone_id=zone.id,
            )
        )
        records.append(
            models.DnsRecord(
                name=f"sub.{apex}",
                type="NS",
                ttl=172800,
                value="ns-101.awsdns-12.com.\nns-202.awsdns-24.net.",
                routing_policy="Simple",
                zone_id=zone.id,
            )
        )
    return records


def seed_database(db: Session, *, only_if_empty: bool = False) -> dict[str, int]:
    """Populate demo users, hosted zones, DNS records, health checks, and traffic policies idempotently."""
    if only_if_empty and db.query(models.HostedZone).count() > 0:
        return {"users": 0, "zones": 0, "records": 0, "health_checks": 0, "traffic_policies": 0}

    counts = {"users": 0, "zones": 0, "records": 0, "health_checks": 0, "traffic_policies": 0}
    users_by_name: dict[str, models.User] = {}

    for acct in DEMO_ACCOUNTS:
        user = db.query(models.User).filter(models.User.username == acct["username"]).first()
        if not user:
            user = models.User(
                username=acct["username"],
                hashed_password=get_password_hash(acct["password"]),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            counts["users"] += 1
        users_by_name[acct["username"]] = user

    for idx, zdata in enumerate(SEED_ZONES, start=1):
        owner = users_by_name[zdata["owner"]]
        existing_zone = (
            db.query(models.HostedZone)
            .filter(models.HostedZone.name == zdata["name"], models.HostedZone.owner_id == owner.id)
            .first()
        )
        if existing_zone:
            continue

        zone = models.HostedZone(
            name=zdata["name"],
            comment=zdata["comment"],
            zone_type=zdata["zone_type"],
            vpc_id=zdata.get("vpc_id"),
            vpc_region=zdata.get("vpc_region"),
            owner_id=owner.id,
        )
        db.add(zone)
        db.commit()
        db.refresh(zone)
        counts["zones"] += 1

        nameservers = generate_aws_nameservers(zone.id)
        recs = _build_zone_records(zone, nameservers, idx)
        db.add_all(recs)
        db.commit()
        counts["records"] += len(recs)

    for hc_data in SEED_HEALTH_CHECKS:
        owner = users_by_name[hc_data["owner"]]
        exists = (
            db.query(models.HealthCheck)
            .filter(models.HealthCheck.name == hc_data["name"], models.HealthCheck.owner_id == owner.id)
            .first()
        )
        if exists:
            continue
        db.add(
            models.HealthCheck(
                name=hc_data["name"],
                protocol=hc_data["protocol"],
                endpoint=hc_data["endpoint"],
                port=hc_data["port"],
                resource_path=hc_data["resource_path"],
                request_interval=30,
                failure_threshold=3,
                status=hc_data["status"],
                status_reason=hc_data["status_reason"],
                last_checked_at=datetime.now(timezone.utc),
                owner_id=owner.id,
            )
        )
        counts["health_checks"] += 1

    for tp_data in SEED_TRAFFIC_POLICIES:
        owner = users_by_name[tp_data["owner"]]
        exists = (
            db.query(models.TrafficPolicy)
            .filter(models.TrafficPolicy.name == tp_data["name"], models.TrafficPolicy.owner_id == owner.id)
            .first()
        )
        if exists:
            continue
        doc = json.dumps(
            {
                "AWSPolicyFormatVersion": "2015-10-01",
                "RecordType": tp_data["dns_type"],
                "StartRule": "weighted_rule",
                "Endpoints": {
                    "primary": {"Type": "value", "Value": "203.0.113.10"},
                    "secondary": {"Type": "value", "Value": "198.51.100.20"},
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
        db.add(
            models.TrafficPolicy(
                name=tp_data["name"],
                version=1,
                dns_type=tp_data["dns_type"],
                comment=tp_data["comment"],
                document=doc,
                owner_id=owner.id,
            )
        )
        counts["traffic_policies"] += 1

    db.commit()
    return counts

