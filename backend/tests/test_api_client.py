"""End-to-end API integration tests using pytest + FastAPI TestClient + isolated SQLite."""

from fastapi.testclient import TestClient


class TestAuthEndpoints:
    def test_register_login_me_and_duplicate_username(self, client: TestClient):
        # Register new IAM user
        res = client.post(
            "/auth/register",
            json={"username": "cloudadmin", "password": "password123"},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["username"] == "cloudadmin"
        assert body["is_active"] is True

        # Duplicate username returns 400
        dup = client.post(
            "/auth/register",
            json={"username": "cloudadmin", "password": "password123"},
        )
        assert dup.status_code == 400
        assert "already exists" in dup.json()["detail"].lower()

        # Short password rejected by Pydantic validation (422)
        short_pw = client.post(
            "/auth/register",
            json={"username": "shortpw", "password": "123"},
        )
        assert short_pw.status_code == 422

        # JSON login succeeds
        login_json = client.post(
            "/auth/login-json",
            json={"username": "cloudadmin", "password": "password123"},
        )
        assert login_json.status_code == 200
        token = login_json.json()["access_token"]
        assert login_json.json()["token_type"] == "bearer"
        assert login_json.json()["user"]["username"] == "cloudadmin"

        # OAuth2 password form login succeeds
        login_form = client.post(
            "/auth/login",
            data={"username": "cloudadmin", "password": "password123"},
        )
        assert login_form.status_code == 200
        assert login_form.json()["user"]["username"] == "cloudadmin"

        # /auth/me returns active user profile
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["username"] == "cloudadmin"
        assert me.json()["account_id"] == "1793-0234-9211"

    def test_demo_login_and_auth_failure_cases(self, client: TestClient):
        # Unauthenticated /auth/me fails with 401
        unauth = client.get("/auth/me")
        assert unauth.status_code == 401

        # Invalid Bearer token fails with 401
        bad_token = client.get(
            "/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"}
        )
        assert bad_token.status_code == 401

        # Demo login seeds/reuses admin@route53demo.com
        demo = client.post("/auth/demo")
        assert demo.status_code == 200
        assert demo.json()["user"]["username"] == "admin@route53demo.com"

        # Wrong password fails with 401
        wrong_pw = client.post(
            "/auth/login-json",
            json={"username": "admin@route53demo.com", "password": "wrong-password"},
        )
        assert wrong_pw.status_code == 401


class TestHostedZonesEndpoints:
    def test_hosted_zones_crud_and_record_count_accuracy(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        # Initially empty
        empty = client.get("/zones/", headers=auth_headers)
        assert empty.status_code == 200
        assert empty.json() == []

        # Create public hosted zone (trailing dot normalized, 2 default records NS + SOA)
        created = client.post(
            "/zones/",
            json={
                "name": "app.example.com.",
                "comment": "Initial comment",
                "type": "Public",
                "zone_type": "Public",
            },
            headers=auth_headers,
        )
        assert created.status_code == 201
        zone = created.json()
        zone_id = zone["id"]
        assert zone["name"] == "app.example.com"
        assert zone["comment"] == "Initial comment"
        assert zone["zone_type"] == "Public"
        assert zone["record_count"] == 2
        assert len(zone["nameservers"]) == 4

        # List and get by ID + domain name
        listed = client.get("/zones/", headers=auth_headers)
        assert listed.status_code == 200
        assert len(listed.json()) == 1
        assert listed.json()[0]["record_count"] == 2

        by_id = client.get(f"/zones/{zone_id}", headers=auth_headers)
        by_name = client.get("/zones/app.example.com", headers=auth_headers)
        assert by_id.status_code == 200
        assert by_name.status_code == 200
        assert by_id.json()["id"] == by_name.json()["id"]

        # Update description and domain name
        updated = client.put(
            f"/zones/{zone_id}",
            json={"name": "renamed.example.com", "comment": "Updated comment"},
            headers=auth_headers,
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "renamed.example.com"
        assert updated.json()["comment"] == "Updated comment"
        assert updated.json()["record_count"] == 2

        # Export JSON & BIND
        exp_json = client.get(f"/zones/{zone_id}/export?format=json", headers=auth_headers)
        assert exp_json.status_code == 200
        assert exp_json.json()["hosted_zone"]["name"] == "renamed.example.com"
        assert len(exp_json.json()["records"]) == 2

        exp_bind = client.get(f"/zones/{zone_id}/export?format=bind", headers=auth_headers)
        assert exp_bind.status_code == 200
        assert "$ORIGIN renamed.example.com." in exp_bind.text

        # Delete zone
        deleted = client.delete(f"/zones/{zone_id}", headers=auth_headers)
        assert deleted.status_code == 204
        assert client.get(f"/zones/{zone_id}", headers=auth_headers).status_code == 404
        assert client.get("/zones/", headers=auth_headers).json() == []

    def test_zone_edge_cases_invalid_domains_duplicates_and_nonexistent_ids(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        # Unauthenticated access blocked
        assert client.get("/zones/").status_code == 401

        # Invalid domains return 400
        for bad_domain in ["", "   ", ".", "invalid domain!", "-bad.com", "foo..bar", "bad!.org"]:
            res = client.post(
                "/zones/",
                json={"name": bad_domain, "comment": "should fail"},
                headers=auth_headers,
            )
            assert res.status_code == 400, f"Expected 400 for invalid domain {bad_domain!r}, got {res.status_code}"

        # Duplicate hosted zone names are allowed (like Route 53) with distinct IDs
        z1 = client.post("/zones/", json={"name": "dup.example.com", "comment": "First"}, headers=auth_headers)
        z2 = client.post("/zones/", json={"name": "dup.example.com", "comment": "Second"}, headers=auth_headers)
        assert z1.status_code == 201
        assert z2.status_code == 201
        assert z1.json()["id"] != z2.json()["id"]
        assert z1.json()["nameservers"] != z2.json()["nameservers"]

        # Updating a zone with an invalid domain returns 400
        bad_put = client.put(
            f"/zones/{z1.json()['id']}",
            json={"name": "invalid domain!"},
            headers=auth_headers,
        )
        assert bad_put.status_code == 400

        # Non-existent zone IDs return 404 across get, update, delete, export
        assert client.get("/zones/999999", headers=auth_headers).status_code == 404
        assert client.put("/zones/999999", json={"comment": "x"}, headers=auth_headers).status_code == 404
        assert client.delete("/zones/999999", headers=auth_headers).status_code == 404
        assert client.get("/zones/999999/export?format=json", headers=auth_headers).status_code == 404

        # Bulk delete removes both duplicate zones
        bulk = client.post(
            "/zones/bulk-delete",
            json={"ids": [z1.json()["id"], z2.json()["id"]]},
            headers=auth_headers,
        )
        assert bulk.status_code == 200
        assert bulk.json()["deleted"] == 2
        assert client.get("/zones/", headers=auth_headers).json() == []


class TestDnsRecordsEndpoints:
    def test_records_crud_and_zone_record_count_accuracy(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        zone = client.post(
            "/zones/",
            json={"name": "records.example.com", "comment": "Records test"},
            headers=auth_headers,
        ).json()
        zone_id = zone["id"]
        assert zone["record_count"] == 2

        # Create A, CNAME, and TXT records and verify parent zone record_count increments accurately
        rec_a = client.post(
            f"/zones/{zone_id}/records/",
            json={"name": "www", "type": "A", "ttl": 300, "value": "192.0.2.10"},
            headers=auth_headers,
        )
        assert rec_a.status_code == 201
        assert rec_a.json()["name"] == "www.records.example.com."
        assert client.get(f"/zones/{zone_id}", headers=auth_headers).json()["record_count"] == 3

        rec_cname = client.post(
            f"/zones/{zone_id}/records/",
            json={
                "name": "api",
                "type": "CNAME",
                "ttl": 60,
                "value": "www.records.example.com.",
                "routing_policy": "Weighted",
                "weight": 70,
                "set_identifier": "api-weighted-1",
            },
            headers=auth_headers,
        )
        assert rec_cname.status_code == 201
        assert client.get(f"/zones/{zone_id}", headers=auth_headers).json()["record_count"] == 4

        rec_txt = client.post(
            f"/zones/{zone_id}/records/",
            json={"name": "@", "type": "TXT", "ttl": 300, "value": '"v=spf1 ~all"'},
            headers=auth_headers,
        )
        assert rec_txt.status_code == 201
        assert rec_txt.json()["name"] == "records.example.com."
        assert client.get(f"/zones/{zone_id}", headers=auth_headers).json()["record_count"] == 5

        # Read single & list records
        rec_a_id = rec_a.json()["id"]
        fetched = client.get(f"/zones/{zone_id}/records/{rec_a_id}", headers=auth_headers)
        assert fetched.status_code == 200
        assert fetched.json()["value"] == "192.0.2.10"

        listed = client.get(f"/zones/{zone_id}/records/", headers=auth_headers)
        assert listed.status_code == 200
        assert len(listed.json()) == 5

        # Update record
        updated = client.put(
            f"/zones/{zone_id}/records/{rec_a_id}",
            json={"name": "www", "type": "A", "ttl": 3600, "value": "192.0.2.99"},
            headers=auth_headers,
        )
        assert updated.status_code == 200
        assert updated.json()["value"] == "192.0.2.99"
        assert updated.json()["ttl"] == 3600

        # Bulk TTL update
        bulk_ttl = client.post(
            f"/zones/{zone_id}/records/bulk-ttl",
            json={"ids": [rec_a_id, rec_cname.json()["id"]], "ttl": 900},
            headers=auth_headers,
        )
        assert bulk_ttl.status_code == 200
        assert bulk_ttl.json()["updated"] == 2
        assert client.get(f"/zones/{zone_id}/records/{rec_a_id}", headers=auth_headers).json()["ttl"] == 900

        # Delete one custom record -> record_count becomes 4
        del_one = client.delete(f"/zones/{zone_id}/records/{rec_txt.json()['id']}", headers=auth_headers)
        assert del_one.status_code == 204
        assert client.get(f"/zones/{zone_id}", headers=auth_headers).json()["record_count"] == 4

        # Bulk delete remaining records including apex NS/SOA -> system records preserved, count becomes 2
        all_ids = [r["id"] for r in client.get(f"/zones/{zone_id}/records/", headers=auth_headers).json()]
        bulk_del = client.post(
            f"/zones/{zone_id}/records/bulk-delete",
            json={"ids": all_ids},
            headers=auth_headers,
        )
        assert bulk_del.status_code == 200
        assert bulk_del.json()["deleted"] == 2
        assert bulk_del.json()["skipped_system"] == 2
        assert client.get(f"/zones/{zone_id}", headers=auth_headers).json()["record_count"] == 2

    def test_records_edge_cases_and_nonexistent_ids(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        zone = client.post(
            "/zones/",
            json={"name": "edge.example.com"},
            headers=auth_headers,
        ).json()
        zone_id = zone["id"]

        # Non-existent zone ID returns 404 for records endpoints
        assert client.get("/zones/999999/records/", headers=auth_headers).status_code == 404
        assert (
            client.post(
                "/zones/999999/records/",
                json={"name": "www", "type": "A", "ttl": 300, "value": "1.2.3.4"},
                headers=auth_headers,
            ).status_code
            == 404
        )

        # Non-existent record ID returns 404
        assert client.get(f"/zones/{zone_id}/records/999999", headers=auth_headers).status_code == 404
        assert (
            client.put(
                f"/zones/{zone_id}/records/999999",
                json={"name": "www", "type": "A", "ttl": 300, "value": "1.2.3.4"},
                headers=auth_headers,
            ).status_code
            == 404
        )
        assert client.delete(f"/zones/{zone_id}/records/999999", headers=auth_headers).status_code == 404

        # Invalid record type or non-positive TTL rejected by Pydantic (422)
        bad_type = client.post(
            f"/zones/{zone_id}/records/",
            json={"name": "www", "type": "INVALID", "ttl": 300, "value": "1.2.3.4"},
            headers=auth_headers,
        )
        assert bad_type.status_code == 422

        bad_ttl = client.post(
            f"/zones/{zone_id}/records/",
            json={"name": "www", "type": "A", "ttl": 0, "value": "1.2.3.4"},
            headers=auth_headers,
        )
        assert bad_ttl.status_code == 422

        # Apex NS and SOA cannot be deleted individually (400)
        recs = client.get(f"/zones/{zone_id}/records/", headers=auth_headers).json()
        soa_rec = next(r for r in recs if r["type"] == "SOA")
        ns_rec = next(r for r in recs if r["type"] == "NS")
        assert client.delete(f"/zones/{zone_id}/records/{soa_rec['id']}", headers=auth_headers).status_code == 400
        assert client.delete(f"/zones/{zone_id}/records/{ns_rec['id']}", headers=auth_headers).status_code == 400

        # Empty BIND import returns 400
        bad_bind = client.post(
            f"/zones/{zone_id}/records/import-bind",
            json={"zone_file": "; comments only\n\n"},
            headers=auth_headers,
        )
        assert bad_bind.status_code == 400

        # Invalid A / AAAA / MX values rejected by Pydantic (422)
        bad_a = client.post(
            f"/zones/{zone_id}/records/",
            json={"name": "bad-a", "type": "A", "ttl": 300, "value": "not-an-ipv4"},
            headers=auth_headers,
        )
        assert bad_a.status_code == 422

        bad_aaaa = client.post(
            f"/zones/{zone_id}/records/",
            json={"name": "bad-aaaa", "type": "AAAA", "ttl": 300, "value": "192.0.2.1"},
            headers=auth_headers,
        )
        assert bad_aaaa.status_code == 422

        bad_mx = client.post(
            f"/zones/{zone_id}/records/",
            json={"name": "@", "type": "MX", "ttl": 300, "value": "mail.example.com."},
            headers=auth_headers,
        )
        assert bad_mx.status_code == 422


class TestSecurityAndSimulationApi:
    def test_supporting_services_require_auth_and_isolate_users(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        assert client.get("/health-checks/").status_code == 401
        assert client.get("/traffic-policies/").status_code == 401
        assert client.get("/policy-records/").status_code == 401
        assert client.get("/resolver/endpoints/").status_code == 401
        assert client.get("/resolver/rules/").status_code == 401
        assert client.get("/profiles/").status_code == 401

        # Create a health check as user A (mocking SSRF-protected probe to avoid network)
        from app.routers import health_checks
        from unittest.mock import patch

        with patch.object(
            health_checks, "probe_endpoint", return_value=("Healthy", "Success: HTTP Status Code 200")
        ):
            hc_res = client.post(
                "/health-checks/",
                json={"name": "user-a-hc", "protocol": "HTTPS", "endpoint": "example.com"},
                headers=auth_headers,
            )
        assert hc_res.status_code == 201
        hc_id = hc_res.json()["id"]

        # Register user B and verify user B cannot read or delete user A's health check
        client.post("/auth/register", json={"username": "user-b", "password": "password123"})
        b_token = client.post(
            "/auth/login-json", json={"username": "user-b", "password": "password123"}
        ).json()["access_token"]
        b_headers = {"Authorization": f"Bearer {b_token}"}

        assert client.get(f"/health-checks/{hc_id}", headers=b_headers).status_code == 404
        assert client.delete(f"/health-checks/{hc_id}", headers=b_headers).status_code == 404

    def test_ssrf_blocks_loopback_and_metadata_targets(self):
        from app.routers.health_checks import probe_endpoint

        status_127, reason_127 = probe_endpoint("HTTP", "127.0.0.1", 80, "/")
        assert status_127 == "Unhealthy"
        assert "Blocked" in reason_127

        status_meta, reason_meta = probe_endpoint("HTTP", "169.254.169.254", 80, "/latest/meta-data/")
        assert status_meta == "Unhealthy"
        assert "Blocked" in reason_meta

    def test_dns_query_simulation_endpoint(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        zone = client.post(
            "/zones/",
            json={"name": "sim.example.com"},
            headers=auth_headers,
        ).json()
        zone_id = zone["id"]

        client.post(
            f"/zones/{zone_id}/records/",
            json={
                "name": "app",
                "type": "A",
                "ttl": 60,
                "value": "203.0.113.10",
                "routing_policy": "Weighted",
                "weight": 20,
                "set_identifier": "canary",
            },
            headers=auth_headers,
        )
        client.post(
            f"/zones/{zone_id}/records/",
            json={
                "name": "app",
                "type": "A",
                "ttl": 60,
                "value": "203.0.113.20",
                "routing_policy": "Weighted",
                "weight": 80,
                "set_identifier": "primary",
            },
            headers=auth_headers,
        )

        sim = client.get(
            f"/zones/{zone_id}/simulate?name=app&type=A",
            headers=auth_headers,
        )
        assert sim.status_code == 200
        body = sim.json()
        assert body["query_name"] == "app.sim.example.com."
        assert body["response_code"] == "NOERROR"
        assert body["routing_policy"] == "Weighted"
        assert body["answers"] == ["203.0.113.20"]

        nx = client.get(
            f"/zones/{zone_id}/simulate?name=missing&type=A",
            headers=auth_headers,
        )
        assert nx.status_code == 200
        assert nx.json()["response_code"] == "NXDOMAIN"
        assert nx.json()["answers"] == []

