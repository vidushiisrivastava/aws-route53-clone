from datetime import datetime, timezone
import ipaddress
import socket
import urllib.request
import urllib.error
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, database
from ..dependencies import get_current_user, get_owned_resource

router = APIRouter(prefix="/health-checks", tags=["health_checks"])


def _ensure_public_host(hostname: str, port: int) -> None:
    """Reject loopback, private, link-local, and reserved targets to prevent SSRF."""
    if not hostname:
        raise ValueError("Empty endpoint hostname")
    try:
        addr_infos = socket.getaddrinfo(hostname, port or 80, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"DNS resolution failed for '{hostname}'") from exc

    for info in addr_infos:
        ip_str = info[4][0].split("%")[0]
        ip_obj = ipaddress.ip_address(ip_str)
        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
            or ip_obj.is_unspecified
        ):
            raise ValueError(f"Blocked internal/private target IP: {ip_obj}")


def probe_endpoint(protocol: str, endpoint: str, port: int, resource_path: str = "/") -> tuple[str, str]:
    """Perform a live lightweight health probe against a public endpoint."""
    proto = protocol.upper()
    clean_host = endpoint.strip()
    if clean_host.startswith("http://"):
        clean_host = clean_host[len("http://"):]
    elif clean_host.startswith("https://"):
        clean_host = clean_host[len("https://"):]
    clean_host = clean_host.split("/")[0].split(":")[0]

    try:
        _ensure_public_host(clean_host, port)
        if proto in ("HTTP", "HTTPS"):
            path = resource_path or "/"
            if not path.startswith("/"):
                path = "/" + path
            default_port = 443 if proto == "HTTPS" else 80
            port_part = f":{port}" if port and port != default_port else ""
            url = f"{proto.lower()}://{clean_host}{port_part}{path}"
            req = urllib.request.Request(url, method="GET", headers={"User-Agent": "AWS-Route53-HealthChecker/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                code = resp.getcode()
                if 200 <= code < 400:
                    return "Healthy", f"Success: HTTP Status Code {code}"
                return "Unhealthy", f"Failure: HTTP Status Code {code}"
        else:
            with socket.create_connection((clean_host, port or 80), timeout=3):
                return "Healthy", f"Success: TCP connection established on port {port or 80}"
    except ValueError as e:
        return "Unhealthy", f"Blocked: {str(e)[:120]}"
    except urllib.error.HTTPError as e:
        if 200 <= e.code < 400:
            return "Healthy", f"Success: HTTP Status Code {e.code}"
        return "Unhealthy", f"Failure: HTTP Status Code {e.code}"
    except Exception as e:
        return "Unhealthy", f"Connection failed: {str(e)[:120]}"


@router.get("", response_model=List[schemas.HealthCheckRead], include_in_schema=False)
@router.get("/", response_model=List[schemas.HealthCheckRead])
def list_health_checks(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.HealthCheck)
        .filter((models.HealthCheck.owner_id == current_user.id) | (models.HealthCheck.owner_id.is_(None)))
        .order_by(models.HealthCheck.id.desc())
        .all()
    )


@router.post("", response_model=schemas.HealthCheckRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=schemas.HealthCheckRead, status_code=status.HTTP_201_CREATED)
def create_health_check(
    payload: schemas.HealthCheckCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    proto = payload.protocol.upper()
    port = payload.port or (443 if proto == "HTTPS" else 80)
    hc_status, reason = probe_endpoint(proto, payload.endpoint, port, payload.resource_path or "/")

    hc = models.HealthCheck(
        name=(payload.name or "").strip() or payload.endpoint.strip(),
        protocol=proto,
        endpoint=payload.endpoint.strip(),
        port=port,
        resource_path=payload.resource_path or "/",
        request_interval=payload.request_interval,
        failure_threshold=payload.failure_threshold,
        status=hc_status,
        status_reason=reason,
        last_checked_at=datetime.now(timezone.utc),
        owner_id=current_user.id,
    )
    db.add(hc)
    db.commit()
    db.refresh(hc)
    return hc


@router.get("/{hc_id}", response_model=schemas.HealthCheckRead)
def get_health_check(
    hc_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    return get_owned_resource(db, models.HealthCheck, hc_id, current_user, "Health check not found")


@router.post("/{hc_id}/check", response_model=schemas.HealthCheckRead)
def run_health_check(
    hc_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    hc = get_owned_resource(db, models.HealthCheck, hc_id, current_user, "Health check not found")
    hc_status, reason = probe_endpoint(hc.protocol, hc.endpoint, hc.port, hc.resource_path or "/")
    hc.status = hc_status
    hc.status_reason = reason
    hc.last_checked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(hc)
    return hc


@router.delete("/{hc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_health_check(
    hc_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    hc = get_owned_resource(db, models.HealthCheck, hc_id, current_user, "Health check not found")
    db.delete(hc)
    db.commit()
    return
