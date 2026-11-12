"""Hosted zones and DNS records backend tests."""

import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from tests.conftest_helpers import (
    create_authenticated_user,
    create_test_session,
    validate_list_schema,
    validate_schema,
)
from app import models, schemas
from app.routers import records, traffic_policies, zones


class TestZonesAndRecords(unittest.TestCase):
    def setUp(self):
        self.db = create_test_session()
        self.user, _ = create_authenticated_user(self.db, username="alice", password="secret123")
        self.other_user, _ = create_authenticated_user(self.db, username="mallory", password="secret123")

    def tearDown(self):
        self.db.close()

    def test_create_public_and_private_zones_and_default_records(self):
        pub = zones.create_zone(
            schemas.HostedZoneCreate(name="example.com.", comment="Public zone"),
            db=self.db,
            current_user=self.user,
        )
        validate_schema(schemas.HostedZoneRead, pub)
        self.assertEqual(pub["name"], "example.com")
        self.assertEqual(pub["type"], "Public")
        self.assertEqual(pub["zone_type"], "Public")
        self.assertEqual(pub["record_count"], 2)
        self.assertEqual(len(pub["nameservers"]), 4)

        priv = zones.create_zone(
            schemas.HostedZoneCreate(
                name="internal.local",
                comment="Private VPC zone",
                type="Public",
                zone_type="Private",
                vpc_id="vpc-12345678",
                vpc_region="ap-south-1",
            ),
            db=self.db,
            current_user=self.user,
        )
        validate_schema(schemas.HostedZoneRead, priv)
        self.assertEqual(priv["type"], "Private")
        self.assertEqual(priv["zone_type"], "Private")
        self.assertEqual(priv["vpc_id"], "vpc-12345678")
        self.assertEqual(priv["vpc_region"], "ap-south-1")

        # Validates NS + SOA Pydantic schemas including SOA in RecordType
        priv_records = records.list_records("internal.local", db=self.db, current_user=self.user)
        validated_recs = validate_list_schema(schemas.DnsRecordRead, priv_records)
        self.assertEqual({r.type for r in validated_recs}, {models.RecordType.NS, models.RecordType.SOA})

    def test_zone_resolution_by_id_or_domain_and_owner_isolation(self):
        created = zones.create_zone(
            schemas.HostedZoneCreate(name="lookup.org"),
            db=self.db,
            current_user=self.user,
        )
        by_id = zones.get_zone(str(created["id"]), db=self.db, current_user=self.user)
        by_name = zones.get_zone("lookup.org.", db=self.db, current_user=self.user)
        self.assertEqual(by_id["id"], by_name["id"])

        with self.assertRaises(HTTPException) as ctx:
            zones.get_zone("lookup.org", db=self.db, current_user=self.other_user)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_rename_zone_updates_records_and_policy_records(self):
        z = zones.create_zone(
            schemas.HostedZoneCreate(name="oldsite.com", comment="Initial"),
            db=self.db,
            current_user=self.user,
        )
        records.create_record(
            "oldsite.com",
            schemas.DnsRecordCreate(name="www", type=models.RecordType.A, ttl=300, value="192.0.2.1"),
            db=self.db,
            current_user=self.user,
        )
        policy = traffic_policies.create_traffic_policy(
            schemas.TrafficPolicyCreate(name="tp1", dns_type="A"),
            db=self.db,
        )
        traffic_policies.create_policy_record(
            schemas.PolicyRecordCreate(
                name="app.oldsite.com",
                type="A",
                ttl=60,
                hosted_zone_id=z["id"],
                hosted_zone_name="oldsite.com",
                traffic_policy_id=policy.id,
                traffic_policy_name=policy.name,
                traffic_policy_version=policy.version,
            ),
            db=self.db,
        )

        with self.assertRaises(HTTPException) as empty_ctx:
            zones.update_zone("oldsite.com", schemas.HostedZoneUpdate(name="  "), db=self.db, current_user=self.user)
        self.assertEqual(empty_ctx.exception.status_code, 400)

        updated = zones.update_zone(
            "oldsite.com",
            schemas.HostedZoneUpdate(name="newsite.com.", comment="Updated desc"),
            db=self.db,
            current_user=self.user,
        )
        self.assertEqual(updated["name"], "newsite.com")
        self.assertEqual(updated["comment"], "Updated desc")

        recs = records.list_records("newsite.com", db=self.db, current_user=self.user)
        rec_names = {r["name"] for r in recs}
        self.assertIn("newsite.com.", rec_names)
        self.assertIn("www.newsite.com.", rec_names)

        prs = traffic_policies.list_policy_records(db=self.db)
        self.assertEqual(prs[0].hosted_zone_name, "newsite.com")

    def test_record_crud_system_protection_bind_import_export_and_bulk_ops(self):
        z = zones.create_zone(schemas.HostedZoneCreate(name="records.dev"), db=self.db, current_user=self.user)
        zid = str(z["id"])

        # Subdomain normalization & routing policy creation
        r1 = records.create_record(
            "records.dev",
            schemas.DnsRecordCreate(
                name="api",
                type=models.RecordType.A,
                ttl=60,
                value="203.0.113.10",
                routing_policy="Weighted",
                weight=80,
                set_identifier="primary-api",
            ),
            db=self.db,
            current_user=self.user,
        )
        self.assertEqual(r1["name"], "api.records.dev.")
        self.assertEqual(r1["weight"], 80)

        fetched = records.get_record("records.dev", r1["id"], db=self.db, current_user=self.user)
        self.assertEqual(fetched["value"], "203.0.113.10")

        edited = records.update_record(
            zid,
            r1["id"],
            schemas.DnsRecordUpdate(
                name="@",
                type=models.RecordType.A,
                ttl=120,
                value="203.0.113.20",
                routing_policy="Simple",
            ),
            db=self.db,
            current_user=self.user,
        )
        self.assertEqual(edited["name"], "records.dev.")
        self.assertEqual(edited["ttl"], 120)

        # BIND import
        bind_txt = """
        $ORIGIN records.dev.
        $TTL 300
        @ IN NS ns1.ignored.com.
        @ IN A 1.2.3.4
        cdn 600 IN CNAME d111.cloudfront.net.
        mail IN MX 10 mail.records.dev.
        @ IN TXT "v=spf1 ~all"
        """
        imp = records.import_bind_records("records.dev", schemas.BindImportRequest(zone_file=bind_txt), db=self.db, current_user=self.user)
        self.assertEqual(imp["imported"], 4)

        with self.assertRaises(HTTPException) as bad_bind:
            records.import_bind_records(zid, schemas.BindImportRequest(zone_file="; comment only"), db=self.db, current_user=self.user)
        self.assertEqual(bad_bind.exception.status_code, 400)

        # Export BIND and JSON
        exp_bind = zones.export_zone("records.dev", format="bind", db=self.db, current_user=self.user)
        self.assertIn("$ORIGIN records.dev.", exp_bind.body.decode())
        exp_json = json.loads(zones.export_zone(zid, format="json", db=self.db, current_user=self.user).body.decode())
        self.assertEqual(exp_json["hosted_zone"]["name"], "records.dev")
        self.assertGreaterEqual(len(exp_json["records"]), 7)

        all_recs = records.list_records(zid, db=self.db, current_user=self.user)
        all_ids = [r["id"] for r in all_recs]

        # Bulk TTL update
        ttl_res = records.bulk_update_record_ttl(
            "records.dev", schemas.BulkTtlUpdateRequest(ids=all_ids, ttl=900), db=self.db, current_user=self.user
        )
        self.assertEqual(ttl_res["updated"], len(all_ids))

        # System NS/SOA cannot be deleted individually or via bulk delete
        ns_rec = next(r for r in all_recs if r["type"] == "NS")
        with self.assertRaises(HTTPException) as sys_del:
            records.delete_record(zid, ns_rec["id"], db=self.db, current_user=self.user)
        self.assertEqual(sys_del.exception.status_code, 400)

        bulk_del = records.bulk_delete_records(zid, schemas.BulkDeleteRequest(ids=all_ids), db=self.db, current_user=self.user)
        self.assertEqual(bulk_del["deleted"], 5)
        self.assertEqual(bulk_del["skipped_system"], 2)

        # Delete zone
        zones.delete_zone("records.dev", db=self.db, current_user=self.user)
        self.assertEqual(zones.list_zones(db=self.db, current_user=self.user), [])

    def test_no_trailing_slash_routes_registered(self):
        zone_paths = {(r.path, tuple(sorted(r.methods))) for r in zones.router.routes}
        rec_paths = {(r.path, tuple(sorted(r.methods))) for r in records.router.routes}
        self.assertIn(("/zones", ("GET",)), zone_paths)
        self.assertIn(("/zones", ("POST",)), zone_paths)
        self.assertIn(("/zones/{zone_id}/records", ("GET",)), rec_paths)
        self.assertIn(("/zones/{zone_id}/records", ("POST",)), rec_paths)


if __name__ == "__main__":
    unittest.main()
