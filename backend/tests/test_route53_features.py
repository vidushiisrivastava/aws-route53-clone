"""Health checks, traffic policies, policy records, resolver, profiles, and app health tests."""

from pathlib import Path
import sys
from unittest.mock import patch
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from tests.conftest_helpers import create_test_session, validate_list_schema, validate_schema
from app import main, models, schemas
from app.routers import auth, health_checks, resolver, traffic_policies


class TestRoute53Features(unittest.TestCase):
    def setUp(self):
        self.db = create_test_session()
        self.user = models.User(
            username="feature-tester",
            hashed_password=auth.get_password_hash("secret123"),
            is_active=True,
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self):
        self.db.close()

    def test_app_health_endpoint(self):
        res = main.health_check()
        self.assertEqual(res["status"], "ok")

    def test_health_checks_lifecycle_with_mocked_probe(self):
        with patch.object(
            health_checks, "probe_endpoint", return_value=("Healthy", "Success: HTTP Status Code 200")
        ):
            hc = health_checks.create_health_check(
                schemas.HealthCheckCreate(name="api-hc", protocol="HTTPS", endpoint="example.com"),
                db=self.db,
                current_user=self.user,
            )
        validate_schema(schemas.HealthCheckRead, hc)
        self.assertEqual(hc.status, "Healthy")
        self.assertEqual(hc.port, 443)

        with patch.object(
            health_checks, "probe_endpoint", return_value=("Unhealthy", "Failure: HTTP Status Code 503")
        ):
            rechecked = health_checks.run_health_check(hc.id, db=self.db, current_user=self.user)
        self.assertEqual(rechecked.status, "Unhealthy")

        listed = health_checks.list_health_checks(db=self.db, current_user=self.user)
        validate_list_schema(schemas.HealthCheckRead, listed)
        self.assertEqual(len(listed), 1)

        health_checks.delete_health_check(hc.id, db=self.db, current_user=self.user)
        self.assertEqual(health_checks.list_health_checks(db=self.db, current_user=self.user), [])

        with self.assertRaises(HTTPException) as ctx:
            health_checks.delete_health_check(hc.id, db=self.db, current_user=self.user)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_traffic_policies_versioning_and_policy_records(self):
        policy = traffic_policies.create_traffic_policy(
            schemas.TrafficPolicyCreate(name="weighted-failover", dns_type="A", comment="v1"),
            db=self.db,
            current_user=self.user,
        )
        validate_schema(schemas.TrafficPolicyRead, policy)
        self.assertEqual(policy.version, 1)
        self.assertIn("AWSPolicyFormatVersion", policy.document or "")

        v2 = traffic_policies.create_policy_version(
            policy.id, schemas.TrafficPolicyUpdate(comment="v2 updated"), db=self.db, current_user=self.user
        )
        self.assertEqual(v2.version, 2)
        self.assertEqual(v2.comment, "v2 updated")

        pr = traffic_policies.create_policy_record(
            schemas.PolicyRecordCreate(
                name="edge.example.com",
                type="CNAME",
                ttl=60,
                hosted_zone_id=None,
                hosted_zone_name="example.com",
                traffic_policy_id=policy.id,
                traffic_policy_name="ignored",
                traffic_policy_version=1,
            ),
            db=self.db,
            current_user=self.user,
        )
        validate_schema(schemas.PolicyRecordRead, pr)
        self.assertEqual(pr.traffic_policy_version, 2)
        self.assertEqual(pr.type, "A")

        traffic_policies.delete_policy_record(pr.id, db=self.db, current_user=self.user)
        self.assertEqual(traffic_policies.list_policy_records(db=self.db, current_user=self.user), [])

        traffic_policies.delete_traffic_policy(policy.id, db=self.db, current_user=self.user)
        self.assertEqual(traffic_policies.list_traffic_policies(db=self.db, current_user=self.user), [])

    def test_resolver_endpoints_rules_and_profiles(self):
        ep = resolver.create_resolver_endpoint(
            schemas.ResolverEndpointCreate(name="in-ep", direction="inbound", vpc_id="vpc-111"),
            db=self.db,
            current_user=self.user,
        )
        validate_schema(schemas.ResolverEndpointRead, ep)
        self.assertEqual(ep.direction, "INBOUND")
        self.assertEqual(ep.status, "OPERATIONAL")

        rule = resolver.create_resolver_rule(
            schemas.ResolverRuleCreate(
                name="corp-rule", rule_type="forward", domain_name="corp.internal", target_ip="10.0.0.5"
            ),
            db=self.db,
            current_user=self.user,
        )
        validate_schema(schemas.ResolverRuleRead, rule)
        self.assertEqual(rule.rule_type, "FORWARD")

        profile = resolver.create_profile(
            schemas.ProfileCreate(name="prod-profile", vpc_associations="vpc-1, vpc-2 "),
            db=self.db,
            current_user=self.user,
        )
        validate_schema(schemas.ProfileRead, profile)
        self.assertEqual(profile.vpc_associations, "vpc-1, vpc-2")

        updated_profile = resolver.update_profile(
            profile.id, schemas.ProfileUpdate(vpc_associations="vpc-3"), db=self.db, current_user=self.user
        )
        self.assertEqual(updated_profile.vpc_associations, "vpc-3")

        resolver.delete_resolver_endpoint(ep.id, db=self.db, current_user=self.user)
        resolver.delete_resolver_rule(rule.id, db=self.db, current_user=self.user)
        resolver.delete_profile(profile.id, db=self.db, current_user=self.user)

        self.assertEqual(resolver.list_resolver_endpoints(db=self.db, current_user=self.user), [])
        self.assertEqual(resolver.list_resolver_rules(db=self.db, current_user=self.user), [])
        self.assertEqual(resolver.list_profiles(db=self.db, current_user=self.user), [])

    def test_seed_database_populates_and_is_idempotent(self):
        from app.seed import seed_database

        first = seed_database(self.db, only_if_empty=False)
        self.assertEqual(first["users"], 4)
        self.assertEqual(first["zones"], 28)
        self.assertEqual(first["health_checks"], 5)
        self.assertEqual(first["traffic_policies"], 4)
        self.assertGreater(first["records"], 100)

        rec_types = {r.type for r in self.db.query(models.DnsRecord).all()}
        for expected_type in ("A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "SOA"):
            self.assertIn(expected_type, rec_types)

        zone_types = {z.zone_type for z in self.db.query(models.HostedZone).all()}
        self.assertEqual(zone_types, {"Public", "Private"})

        second = seed_database(self.db, only_if_empty=False)
        self.assertEqual(second, {"users": 0, "zones": 0, "records": 0, "health_checks": 0, "traffic_policies": 0})


if __name__ == "__main__":
    unittest.main()
