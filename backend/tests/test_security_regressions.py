"""Offline API regressions: two communities, scoped admins, residents and outsiders.

Run: pytest backend/tests/test_security_regressions.py
All database/provider calls are isolated; never uses a deployment or real credentials.
"""
import asyncio
import importlib
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import bcrypt
import httpx
import jwt
import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.update(MONGO_URL="mongodb://localhost:27017", DB_NAME="security_regression_tests", JWT_SECRET="local-test-key-at-least-32-bytes-long")
with patch("motor.motor_asyncio.AsyncIOMotorClient", AsyncMongoMockClient):
    server = importlib.import_module("server")


def run(coro):
    return asyncio.run(coro)


@pytest.fixture()
def api():
    for name in run(server.db.list_collection_names()):
        run(server.db[name].delete_many({}))
    server.login_rate_limiter._attempts.clear()
    server.register_rate_limiter._attempts.clear()
    server.recovery_rate_limiter._attempts.clear()
    now = datetime.utcnow()
    password = bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()
    for name in ["admin-a", "admin-b", "resident-a", "resident-b", "outsider", "pending-a", "security-a"]:
        run(server.db.users.insert_one({"id": name, "username": name, "email": f"{name}@example.test",
            "password": password, "created_at": now, "is_hoa_admin": name.startswith("admin-"),
            "community_terms_accepted_at": now, "disclaimer_accepted": True}))
    for prop in ["a", "b"]:
        run(server.db.community_properties.insert_one({"id": prop, "name": f"Community {prop}", "address": prop, "is_active": True, "created_at": now}))
        run(server.db.property_admin_assignments.insert_one({"id": f"admin-{prop}", "property_id": prop, "admin_user_id": f"admin-{prop}"}))
        run(server.db.property_memberships.insert_one({"id": f"member-{prop}", "user_id": f"resident-{prop}", "property_id": prop, "status": "active", "role": "resident"}))
        run(server.db.community_posts.insert_one({"id": f"post-{prop}", "property_id": prop, "user_id": f"resident-{prop}",
            "user_name": f"resident-{prop}", "title": "Hello", "content": "Welcome", "category": "general",
            "moderation_status": "approved", "created_at": now, "comments_count": 0, "likes_count": 0}))
        for collection in ["visitors", "complaints", "amenities", "amenity_bookings", "documents", "meetings"]:
            run(server.db[collection].insert_one({"id": f"{collection}-{prop}", "property_id": prop,
                "status": "approved", "user_id": f"resident-{prop}", "host_user_id": f"resident-{prop}",
                "date": now + timedelta(days=1), "created_at": now}))
    run(server.db.property_memberships.insert_one({"id": "pending-a", "property_id": "a", "user_id": "pending-a", "status": "pending", "role": "resident"}))
    run(server.db.property_memberships.insert_one({"id": "security-a", "property_id": "a", "user_id": "security-a", "status": "active", "role": "security"}))
    tokens = {}
    for user in run(server.db.users.find({}).to_list(length=None)):
        tokens[user["id"]] = run(server.issue_auth_token(user)).access_token
    return TestClient(server.app), tokens


def headers(tokens, user):
    return {"Authorization": f"Bearer {tokens[user]}"}


@pytest.mark.parametrize("path", [
    "/properties/a", "/properties/a/members", "/properties/a/visitors",
    "/properties/a/amenities", "/properties/a/amenity-bookings", "/properties/a/complaints",
    "/properties/a/hoa-documents", "/properties/a/hoa-documents/documents-a",
    "/properties/a/meetings", "/meetings/meetings-a/rsvps", "/properties/a/community/posts",
    "/community/posts/post-a", "/community/posts/post-a/comments",
    "/admin/properties/a/moderation",
])
@pytest.mark.parametrize("user", ["resident-b", "admin-b", "outsider", "pending-a"])
def test_other_community_reads_are_denied(api, path, user):
    client, tokens = api
    assert client.get(f"/api{path}", headers=headers(tokens, user)).status_code == 403


@pytest.mark.parametrize("method,path,payload", [
    ("put", "/visitors/visitors-a/approve", {"status": "approved"}),
    ("post", "/visitors/visitors-a/check-in", {}),
    ("post", "/visitors/visitors-a/check-out", {}),
    ("put", "/complaints/complaints-a", {"status": "resolved"}),
    ("put", "/amenity-bookings/amenity_bookings-a", {"status": "approved"}),
    ("post", "/community/posts/post-a/like", {}),
    ("post", "/meetings/rsvp", {"meeting_id": "meetings-a", "status": "attending"}),
    ("post", "/amenities/book", {"amenity_id": "amenities-a", "booking_date": "2026-10-03T12:00:00", "start_time": "12:00", "end_time": "13:00"}),
])
@pytest.mark.parametrize("user", ["resident-b", "admin-b", "outsider", "pending-a"])
def test_other_community_mutations_are_denied(api, method, path, payload, user):
    client, tokens = api
    assert getattr(client, method)(f"/api{path}", headers=headers(tokens, user), json=payload).status_code == 403


@pytest.mark.parametrize("user,expected", [("admin-a", 200), ("security-a", 200), ("resident-a", 403)])
def test_visitor_approval_requires_security_or_admin(api, user, expected):
    client, tokens = api
    assert client.put("/api/visitors/visitors-a/approve", headers=headers(tokens, user), json={"status": "approved"}).status_code == expected


def test_assignment_revocation_takes_effect_without_new_login(api):
    client, tokens = api
    assert client.get("/api/properties/a/members", headers=headers(tokens, "admin-a")).status_code == 200
    run(server.db.property_admin_assignments.delete_many({"admin_user_id": "admin-a"}))
    assert client.get("/api/properties/a/members", headers=headers(tokens, "admin-a")).status_code == 403


@pytest.mark.parametrize("path,payload", [
    ("/properties/a/community/posts", {"property_id": "b", "title": "Hello", "content": "Hello"}),
    ("/properties/a/visitors", {"property_id": "b", "visitor_name": "Guest", "visitor_phone": "123", "purpose": "Visit", "expected_date": "2026-10-03T12:00:00"}),
    ("/properties/a/complaints", {"property_id": "b", "category": "other", "subject": "Test", "description": "Test"}),
    ("/community/posts/post-a/comments", {"post_id": "post-b", "content": "Hello"}),
])
def test_url_body_scope_mismatch_is_rejected(api, path, payload):
    client, tokens = api
    assert client.post(f"/api{path}", headers=headers(tokens, "resident-a"), json=payload).status_code == 400


def test_registration_requests_membership_without_granting_access(api):
    client, _ = api
    response = client.post("/api/auth/register", json={"username": "new-user", "email": "new@example.test", "password": "Password123!", "property_ids": ["a"]})
    assert response.status_code == 200
    auth = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/properties/a/community/posts", headers=auth).status_code == 403
    assert client.get("/api/users/properties", headers=auth).json() == []
    assert client.get("/api/user/approval-status/a", headers=auth).json()["status"] == "pending"


def test_community_approval_is_scoped_and_idempotent(api):
    client, tokens = api
    pending = {"property_id": "a", "requested_role": "resident", "documents": [], "document_names": []}
    for _ in range(2):
        assert client.post("/api/user/request-property-approval", headers=headers(tokens, "outsider"), json=pending).status_code == 200
    approval = run(server.db.pending_user_approvals.find_one({"user_id": "outsider"}))
    payload = {"approval_id": approval["id"], "action": "approve"}
    assert client.post("/api/admin/properties/b/approve-user", headers=headers(tokens, "admin-b"), json=payload).status_code == 404
    assert client.post("/api/admin/properties/a/approve-user", headers=headers(tokens, "admin-a"), json=payload).status_code == 200
    assert client.post("/api/admin/properties/a/approve-user", headers=headers(tokens, "admin-a"), json=payload).status_code == 409
    assert client.get("/api/users/properties", headers=headers(tokens, "outsider")).json()[0]["id"] == "a"
    assert client.get("/api/properties/a/community/posts", headers=headers(tokens, "outsider")).status_code == 200


def test_logout_and_deletion_revoke_tokens(api):
    client, tokens = api
    assert client.post("/api/auth/logout", headers=headers(tokens, "outsider")).status_code == 200
    assert client.get("/api/auth/profile", headers=headers(tokens, "outsider")).status_code == 401
    auth = headers(tokens, "resident-a")
    assert client.request("DELETE", "/api/auth/account", headers=auth, json={"password": "wrong"}).status_code == 401
    assert client.request("DELETE", "/api/auth/account", headers=auth, json={"password": "Password123!"}).status_code == 200
    assert client.get("/api/auth/profile", headers=auth).status_code == 401
    assert client.post("/api/properties", headers=auth, json={"name": "Test", "address": "Test"}).status_code == 401
    assert run(server.db.users.find_one({"id": "resident-a"})) is None
    assert run(server.db.community_posts.find_one({"id": "post-b"})) is not None


def test_google_exchange_issues_app_jwt_and_rejects_replay(api, monkeypatch):
    client, _ = api
    class Provider:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs):
            return httpx.Response(200, json={"email": "google@example.test", "session_token": "external-provider-session"})
    monkeypatch.setattr(server.httpx, "AsyncClient", Provider)
    response = client.post("/api/auth/session", headers={"X-Session-ID": "provider-one-time-session"})
    assert response.status_code == 200
    auth = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert jwt.decode(response.json()["access_token"], server.JWT_SECRET, algorithms=["HS256"])["jti"]
    assert client.get("/api/auth/profile", headers=auth).status_code == 200
    assert client.get("/api/auth/profile", headers={"Authorization": "Bearer external-provider-session"}).status_code == 401
    assert client.post("/api/auth/session", headers={"X-Session-ID": "provider-one-time-session"}).status_code == 401
    assert client.request("DELETE", "/api/auth/account", headers=auth, json={}).status_code == 200
    assert client.get("/api/auth/profile", headers=auth).status_code == 401


def test_old_social_session_cannot_delete(api):
    client, _ = api
    user = server.new_social_user("google", "social@example.test")
    run(server.db.users.insert_one(user))
    token = run(server.issue_auth_token(user, "google")).access_token
    claims = server.verify_token(token)
    run(server.db.user_sessions.update_one({"jti": claims["jti"]}, {"$set": {"authenticated_at": datetime.utcnow() - timedelta(minutes=10)}}))
    assert client.request("DELETE", "/api/auth/account", headers={"Authorization": f"Bearer {token}"}, json={}).status_code == 401
    assert run(server.db.users.find_one({"id": user["id"]})) is not None


def test_deletion_cleans_descendants_and_anonymizes_shared_accounting(api):
    client, tokens = api
    run(server.db.community_comments.insert_one({"id": "orphan", "post_id": "post-a", "user_id": "resident-b", "moderation_status": "approved"}))
    run(server.db.pending_user_approvals.insert_one({"id": "proof", "user_id": "resident-a", "documents": ["sensitive"]}))
    run(server.db.payment_transactions.insert_one({"id": "payment", "user_id": "resident-a", "amount": 100, "metadata": {"user_id": "resident-a"}, "stripe_session_id": "sensitive"}))
    assert client.request("DELETE", "/api/auth/account", headers=headers(tokens, "resident-a"), json={"password": "Password123!"}).status_code == 200
    assert run(server.db.community_comments.find_one({"id": "orphan"})) is None
    assert run(server.db.pending_user_approvals.find_one({"id": "proof"})) is None
    payment = run(server.db.payment_transactions.find_one({"id": "payment"}))
    assert payment["user_id"] == "deleted" and payment["metadata"] == {} and "stripe_session_id" not in payment
    assert payment["amount"] == 100


def test_failed_cleanup_disables_account_and_retries(api, monkeypatch):
    client, tokens = api
    original = server.clean_account
    async def fail(*args): raise RuntimeError("temporary database error")
    monkeypatch.setattr(server, "clean_account", fail)
    response = client.request("DELETE", "/api/auth/account", headers=headers(tokens, "resident-a"), json={"password": "Password123!"})
    assert response.status_code == 202
    assert client.get("/api/auth/profile", headers=headers(tokens, "resident-a")).status_code == 401
    job = run(server.db.account_deletions.find_one({"id": response.json()["request_id"]}))
    assert job["status"] == "pending"
    monkeypatch.setattr(server, "clean_account", original)
    run(server.process_deletion(job))
    assert run(server.db.users.find_one({"id": "resident-a"})) is None


def test_moderation_publication_reporting_and_blocking(api):
    client, tokens = api
    resident = headers(tokens, "resident-a"); admin = headers(tokens, "admin-a")
    response = client.post("/api/properties/a/community/posts", headers=resident,
        json={"property_id": "a", "title": "New post", "content": "Needs review"})
    assert response.status_code == 200
    post_id = response.json()["id"]
    assert response.json()["moderation_status"] == "pending"
    assert client.get(f"/api/community/posts/{post_id}", headers=resident).status_code == 404
    payload = {"content_type": "post", "content_id": post_id, "action": "approve"}
    assert client.post("/api/admin/properties/b/moderation", headers=headers(tokens, "admin-b"), json=payload).status_code == 404
    assert client.post("/api/admin/properties/a/moderation", headers=admin, json=payload).status_code == 200
    assert client.get(f"/api/community/posts/{post_id}", headers=resident).status_code == 200
    assert client.post("/api/properties/a/community/reports", headers=resident,
        json={"content_type": "post", "content_id": post_id, "reason": "Inappropriate content"}).status_code == 200
    assert len(client.get("/api/admin/properties/a/moderation", headers=admin).json()["reports"]) == 1
    run(server.db.property_memberships.insert_one({"id": "second-resident", "user_id": "outsider", "property_id": "a", "status": "active"}))
    other = headers(tokens, "outsider")
    assert client.post("/api/properties/a/community/blocks/resident-a", headers=other).status_code == 200
    assert client.get(f"/api/community/posts/{post_id}", headers=other).status_code == 404
    assert client.post(f"/api/community/posts/{post_id}/like", headers=other, json={}).status_code == 404
    payload["action"] = "remove"
    assert client.post("/api/admin/properties/a/moderation", headers=admin, json=payload).status_code == 200
    assert client.get(f"/api/community/posts/{post_id}", headers=resident).status_code == 404


def test_comment_requires_terms_and_review(api):
    client, tokens = api
    auth = headers(tokens, "resident-a")
    run(server.db.users.update_one({"id": "resident-a"}, {"$unset": {"community_terms_accepted_at": ""}}))
    payload = {"post_id": "post-a", "content": "Hello"}
    assert client.post("/api/community/posts/post-a/comments", headers=auth, json=payload).status_code == 403
    assert client.post("/api/community/accept-standards", headers=auth).status_code == 200
    response = client.post("/api/community/posts/post-a/comments", headers=auth, json=payload)
    assert response.status_code == 200 and response.json()["moderation_status"] == "pending"
    assert client.get("/api/community/posts/post-a/comments", headers=auth).json() == []
    assert client.post("/api/admin/properties/a/moderation", headers=headers(tokens, "admin-a"),
        json={"content_type": "comment", "content_id": response.json()["id"], "action": "approve"}).status_code == 200
    assert len(client.get("/api/community/posts/post-a/comments", headers=auth).json()) == 1


def test_legacy_auto_approved_membership_does_not_grant_access(api):
    client, tokens = api
    run(server.db.property_memberships.update_one({"user_id": "pending-a"}, {"$set": {"status": "approved", "role": "owner"}}))
    assert client.get("/api/properties/a/community/posts", headers=headers(tokens, "pending-a")).status_code == 403


def test_resident_claiming_owner_role_is_not_an_admin(api):
    client, tokens = api
    run(server.db.property_memberships.update_one({"user_id": "resident-a"}, {"$set": {"role": "owner"}}))
    assert client.get("/api/properties/a/members", headers=headers(tokens, "resident-a")).status_code == 403


def test_visitor_list_is_scoped_to_host_for_residents(api):
    client, tokens = api
    run(server.db.visitors.insert_one({"id": "private-guest", "property_id": "a", "host_user_id": "admin-a", "visitor_phone": "private"}))
    resident_rows = client.get("/api/properties/a/visitors", headers=headers(tokens, "resident-a")).json()
    assert all(row["host_user_id"] == "resident-a" for row in resident_rows)
    assert len(client.get("/api/properties/a/visitors", headers=headers(tokens, "security-a")).json()) == 2


def test_content_edit_requires_new_review(api):
    client, tokens = api
    auth = headers(tokens, "resident-a")
    assert client.put("/api/community/posts/post-a", headers=auth, json={"content": "Changed content"}).status_code == 200
    assert client.get("/api/community/posts/post-a", headers=auth).status_code == 404
    assert client.put("/api/community/posts/post-a", headers=auth, json={"is_pinned": True}).status_code == 403


def test_ai_consent_is_required_and_can_be_revoked(api):
    client, tokens = api
    auth = headers(tokens, "resident-a")
    assert client.post("/api/scan-asset", headers=auth, json={"image": "placeholder"}).status_code == 403
    assert client.post("/api/auth/ai-consent", headers=auth, json={"accepted": True}).status_code == 200
    assert client.get("/api/auth/profile", headers=auth).json()["ai_consent_at"]
    assert client.post("/api/auth/ai-consent", headers=auth, json={"accepted": False}).status_code == 200
    assert client.post("/api/scan-asset", headers=auth, json={"image": "placeholder"}).status_code == 403


def test_disabled_account_and_database_deleted_account_tokens_are_rejected(api):
    client, tokens = api
    run(server.db.users.update_one({"id": "resident-a"}, {"$set": {"disabled": True}}))
    assert client.get("/api/auth/profile", headers=headers(tokens, "resident-a")).status_code == 401
    run(server.db.users.delete_one({"id": "resident-b"}))
    assert client.get("/api/auth/profile", headers=headers(tokens, "resident-b")).status_code == 401


def test_apple_signed_identity_and_nonce_replay(api, monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import rsa
    client, _ = api
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    class Keys:
        def __init__(self, *args, **kwargs): pass
        def get_signing_key_from_jwt(self, token): return SimpleNamespace(key=key.public_key())
    monkeypatch.setattr(server.jwt, "PyJWKClient", Keys)
    async def exchange(*args): return "encrypted-provider-refresh-token"
    async def revoke(*args): pass
    monkeypatch.setattr(server, "exchange_apple_code", exchange)
    monkeypatch.setattr(server, "revoke_apple_token", revoke)
    nonce = client.post("/api/auth/apple/challenge").json()["nonce"]
    claims = {"iss": "https://appleid.apple.com", "aud": "com.aurainfra.ai", "sub": "apple-identity-a",
        "nonce": nonce, "iat": datetime.utcnow(), "exp": datetime.utcnow() + timedelta(minutes=5), "email": "apple@example.test"}
    payload = {"identity_token": jwt.encode(claims, key, algorithm="RS256"), "nonce": nonce, "authorization_code": "single-use-code"}
    response = client.post("/api/auth/apple", json=payload)
    assert response.status_code == 200
    assert client.post("/api/auth/apple", json=payload).status_code == 401
    auth = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/auth/profile", headers=auth).json()["has_password"] is False
    assert client.request("DELETE", "/api/auth/account", headers=auth, json={}).status_code == 200


@pytest.mark.parametrize("invalid", ["nonce", "audience", "issuer", "signature", "expired"])
def test_apple_rejects_invalid_signed_credentials(api, monkeypatch, invalid):
    from cryptography.hazmat.primitives.asymmetric import rsa
    client, _ = api
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    class Keys:
        def __init__(self, *args, **kwargs): pass
        def get_signing_key_from_jwt(self, token): return SimpleNamespace(key=key.public_key())
    monkeypatch.setattr(server.jwt, "PyJWKClient", Keys)
    nonce = client.post("/api/auth/apple/challenge").json()["nonce"]
    claims = {"iss": "https://appleid.apple.com", "aud": "com.aurainfra.ai", "sub": "apple-identity-a",
        "nonce": nonce, "iat": datetime.utcnow() - timedelta(seconds=10), "exp": datetime.utcnow() + timedelta(minutes=5)}
    signing_key = key
    if invalid == "nonce": claims["nonce"] = "wrong-nonce"
    if invalid == "audience": claims["aud"] = "another-app"
    if invalid == "issuer": claims["iss"] = "https://attacker.example"
    if invalid == "signature": signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    if invalid == "expired": claims["exp"] = datetime.utcnow() - timedelta(seconds=5)
    response = client.post("/api/auth/apple", json={"identity_token": jwt.encode(claims, signing_key, algorithm="RS256"), "nonce": nonce, "authorization_code": "code"})
    assert response.status_code == 401
    assert run(server.db.users.find_one({"auth_provider": "apple"})) is None


def test_google_does_not_link_to_password_account_by_email(api, monkeypatch):
    client, _ = api
    class Provider:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs):
            return httpx.Response(200, json={"email": "resident-a@example.test", "session_token": "external-provider-session"})
    monkeypatch.setattr(server.httpx, "AsyncClient", Provider)
    assert client.post("/api/auth/session", headers={"X-Session-ID": "collision-session"}).status_code == 409


def test_expired_application_token_is_rejected(api):
    client, tokens = api
    claims = server.verify_token(tokens["resident-a"])
    claims["exp"] = datetime.utcnow() - timedelta(seconds=1)
    expired = jwt.encode(claims, server.JWT_SECRET, algorithm="HS256")
    assert client.get("/api/auth/profile", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_suspended_member_loses_access_and_content_is_hidden(api):
    client, tokens = api
    assert client.post("/api/admin/properties/a/community/suspend/resident-a", headers=headers(tokens, "admin-a")).status_code == 200
    assert client.get("/api/properties/a/community/posts", headers=headers(tokens, "resident-a")).status_code == 403
    assert client.get("/api/community/posts/post-a", headers=headers(tokens, "admin-a")).status_code == 404


def test_forged_forwarded_ip_is_not_trusted_by_default(api):
    client, _ = api
    for i in range(31):
        response = client.post("/api/auth/login", headers={"X-Forwarded-For": f"10.0.0.{i}"},
            json={"username": f"nonexistent-{i}", "password": "wrong-password"})
    assert response.status_code == 429


def test_checkout_denies_untrusted_callback_before_payment_provider_call(api):
    client, tokens = api
    response = client.post("/api/payments/hoa/create-checkout", headers=headers(tokens, "resident-a"),
        json={"charge_id": "any-charge", "origin_url": "https://attacker.example"})
    assert response.status_code == 400


def test_interrupted_approval_retries_same_decision_only(api, monkeypatch):
    client, tokens = api
    pending = {"property_id": "a", "requested_role": "resident", "documents": [], "document_names": []}
    client.post("/api/user/request-property-approval", headers=headers(tokens, "outsider"), json=pending)
    approval = run(server.db.pending_user_approvals.find_one({"user_id": "outsider"}))
    run(server.db.pending_user_approvals.update_one({"id": approval["id"]},
        {"$set": {"status": "approved", "membership_applied": False}}))
    auth = headers(tokens, "admin-a")
    assert client.post("/api/admin/properties/a/approve-user", headers=auth,
        json={"approval_id": approval["id"], "action": "reject"}).status_code == 409
    assert client.get("/api/properties/a/community/posts", headers=headers(tokens, "outsider")).status_code == 403
    assert client.post("/api/admin/properties/a/approve-user", headers=auth,
        json={"approval_id": approval["id"], "action": "approve"}).status_code == 200
    assert client.get("/api/properties/a/community/posts", headers=headers(tokens, "outsider")).status_code == 200


@pytest.fixture()
def recovery_mail(monkeypatch):
    sent = []
    monkeypatch.setattr(server, "recovery_configured", lambda: True)
    async def send(email, code):
        sent.append((email, code))
    monkeypatch.setattr(server, "send_reset_code", send)
    return sent


def test_password_recovery_single_use_and_revokes_sessions(api, recovery_mail):
    client, tokens = api
    response = client.post("/api/auth/forgot-password", json={"email": " RESIDENT-A@example.test "})
    assert response.status_code == 200
    email, code = recovery_mail[0]
    saved = run(server.db.password_resets.find_one({"email": email}))
    assert "code" not in saved and code not in str(saved)
    payload = {"email": email, "code": code, "password": "NewPassword123!"}
    assert client.post("/api/auth/reset-password", json=payload).status_code == 200
    assert client.get("/api/auth/profile", headers=headers(tokens, "resident-a")).status_code == 401
    # A racing sign-in that read the old account version cannot revive access.
    stale = run(server.db.users.find_one({"id": "resident-a"}))
    stale["credential_version"] = 0
    auth = run(server.issue_auth_token(stale))
    assert client.get("/api/auth/profile", headers={"Authorization": f"Bearer {auth.access_token}"}).status_code == 401
    assert client.post("/api/auth/reset-password", json=payload).status_code == 400
    assert client.post("/api/auth/login", json={"username": "resident-a", "password": "Password123!"}).status_code == 401
    login = client.post("/api/auth/login", json={"username": "resident-a", "password": "NewPassword123!"})
    assert login.status_code == 200
    assert client.get("/api/auth/profile", headers={"Authorization": f"Bearer {login.json()['access_token']}"}).status_code == 200


def test_password_recovery_limits_guesses_and_expires(api, recovery_mail):
    client, _ = api
    email = "resident-a@example.test"
    client.post("/api/auth/forgot-password", json={"email": email})
    code = recovery_mail[0][1]
    wrong = "00000000" if code != "00000000" else "11111111"
    for _ in range(5):
        assert client.post("/api/auth/reset-password", json={"email": email, "code": wrong, "password": "NewPassword123!"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"email": email, "code": code, "password": "NewPassword123!"}).status_code == 400
    client.post("/api/auth/forgot-password", json={"email": email})
    run(server.db.password_resets.update_one({"email": email}, {"$set": {"expires_at": datetime.utcnow() - timedelta(seconds=1)}}))
    assert client.post("/api/auth/reset-password", json={"email": email, "code": recovery_mail[-1][1], "password": "NewPassword123!"}).status_code == 400


def test_password_recovery_does_not_reveal_or_convert_accounts(api, recovery_mail):
    client, _ = api
    run(server.db.users.insert_one({"id": "social", "email": "social@example.test", "auth_provider": "google", "password": None}))
    responses = []
    for email in ["unknown@example.test", "social@example.test", "resident-a@example.test"]:
        responses.append(client.post("/api/auth/forgot-password", json={"email": email}).json())
    assert responses[0] == responses[1] == responses[2]
    assert len(recovery_mail) == 1
    assert client.post("/api/auth/reset-password", json={"email": "social@example.test", "code": recovery_mail[0][1], "password": "NewPassword123!"}).status_code == 400


def test_password_recovery_resend_invalidates_code_and_rate_limits(api, recovery_mail):
    client, _ = api
    email = "resident-a@example.test"
    with patch.object(server.secrets, "randbelow", side_effect=[12345678, 87654321, 11223344]):
        for _ in range(3):
            assert client.post("/api/auth/forgot-password", json={"email": email}).status_code == 200
    assert client.post("/api/auth/forgot-password", json={"email": email}).status_code == 429
    assert client.post("/api/auth/reset-password", json={"email": email, "code": recovery_mail[0][1], "password": "NewPassword123!"}).status_code == 400


def test_password_recovery_mail_failure_leaks_no_identity_or_code(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr(server, "recovery_configured", lambda: True)
    async def fail(*args):
        raise RuntimeError("private SMTP failure")
    monkeypatch.setattr(server, "send_reset_code", fail)
    response = client.post("/api/auth/forgot-password", json={"email": "resident-a@example.test"})
    assert response.status_code == 200 and "SMTP" not in response.text
    assert run(server.db.password_resets.count_documents({})) == 0


def test_password_recovery_cannot_reenable_deleted_account(api, recovery_mail):
    client, _ = api
    email = "resident-a@example.test"
    client.post("/api/auth/forgot-password", json={"email": email})
    run(server.db.users.update_one({"id": "resident-a"}, {"$set": {"deletion_pending": True}}))
    assert client.post("/api/auth/reset-password", json={"email": email, "code": recovery_mail[0][1], "password": "NewPassword123!"}).status_code == 400


def test_validation_errors_never_echo_private_input(api):
    client, _ = api
    response = client.post('/api/auth/reset-password', json={
        'email': 'resident-a@example.test', 'code': 'private-reset-value', 'password': 'secret-password'})
    assert response.status_code == 422
    assert 'private-reset-value' not in response.text and 'secret-password' not in response.text
    assert all('input' not in error and 'ctx' not in error for error in response.json()['detail'])
