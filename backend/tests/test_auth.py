"""Authentication, JWT session, and IAM demo-user tests."""

from datetime import timedelta
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from tests.conftest_helpers import create_test_session, validate_schema
from app import dependencies, schemas
from app.routers import auth


class TestAuthRouter(unittest.TestCase):
    def setUp(self):
        self.db = create_test_session()

    def tearDown(self):
        self.db.close()

    def test_password_hash_and_verify(self):
        hashed = auth.get_password_hash("s3cretPass!")
        self.assertNotEqual(hashed, "s3cretPass!")
        self.assertTrue(auth.verify_password("s3cretPass!", hashed))
        self.assertFalse(auth.verify_password("wrong", hashed))

    def test_demo_login_creates_and_reuses_demo_user(self):
        first = auth.demo_login(db=self.db)
        second = auth.demo_login(db=self.db)
        self.assertEqual(first["user"]["username"], "admin@route53demo.com")
        self.assertEqual(first["user"]["id"], second["user"]["id"])
        self.assertEqual(first["token_type"], "bearer")

        me = auth.read_current_user(
            current_user=dependencies.get_current_user(token=first["access_token"], db=self.db)
        )
        self.assertEqual(me["username"], "admin@route53demo.com")
        self.assertEqual(me["account_id"], "1793-0234-9211")

    def test_register_and_duplicate_rejected(self):
        created = auth.register(schemas.UserCreate(username="alice", password="password123"), db=self.db)
        validated = validate_schema(schemas.UserRead, created)
        self.assertEqual(validated.username, "alice")
        self.assertTrue(validated.is_active)

        with self.assertRaises(HTTPException) as ctx:
            auth.register(schemas.UserCreate(username="alice", password="password123"), db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_login_json_and_oauth_form_and_demo_alias(self):
        demo_alias = auth.login_json(schemas.UserCreate(username="demo", password="AdminDemo123!"), db=self.db)
        self.assertEqual(demo_alias["user"]["username"], "admin@route53demo.com")

        auth.register(schemas.UserCreate(username="bob", password="password123"), db=self.db)

        json_res = auth.login_json(schemas.UserCreate(username="bob", password="password123"), db=self.db)
        self.assertEqual(json_res["user"]["username"], "bob")

        form_res = auth.login(
            form_data=OAuth2PasswordRequestForm(username="bob", password="password123", scope=""),
            db=self.db,
        )
        self.assertEqual(form_res["user"]["username"], "bob")

        with self.assertRaises(HTTPException) as ctx:
            auth.login_json(schemas.UserCreate(username="bob", password="badpassword"), db=self.db)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_invalid_or_expired_jwt_rejected(self):
        with self.assertRaises(HTTPException) as invalid_ctx:
            dependencies.get_current_user(token="not-a-valid-jwt", db=self.db)
        self.assertEqual(invalid_ctx.exception.status_code, 401)

        expired = auth.create_access_token({"sub": "999"}, expires_delta=timedelta(minutes=-5))
        with self.assertRaises(HTTPException) as exp_ctx:
            dependencies.get_current_user(token=expired, db=self.db)
        self.assertEqual(exp_ctx.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
