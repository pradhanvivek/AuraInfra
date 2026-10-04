"""
Backend tests for newly merged auth/security features:
- DELETE /api/auth/account (password confirm, JWT required, cascades)
- GET /api/admin/stats (admin-only via get_current_admin_user)
- Login sliding-window rate limiting (30/300s)
- Registration still works with is_admin=false default
- Login for demo_user still works
"""
import os
import time
import uuid
import subprocess
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
FRONTEND_ENV = Path("/app/frontend/.env")
load_dotenv(FRONTEND_ENV)

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL or os.environ.get("RUN_LIVE_TESTS") != "1":
    pytest.skip("Live integration tests require RUN_LIVE_TESTS=1 and an isolated test deployment", allow_module_level=True)

API = f"{BASE_URL}/api"

DEMO_USER = "demo_user"
DEMO_PASS = "Test@1234"


def _unique_suffix():
    return uuid.uuid4().hex[:10]


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"demo_user login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


# ---------- Registration & login basics ----------

class TestRegistrationAndLogin:
    def test_demo_user_login_returns_jwt(self, demo_token):
        # 3 parts JWT
        assert demo_token.count(".") == 2

    def test_register_new_user_not_admin(self):
        suffix = _unique_suffix()
        username = f"TEST_reg_{suffix}"
        payload = {"username": username, "email": f"{username}@test.local", "password": "Test@1234"}
        r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["username"] == username
        token = data["access_token"]

        # Confirm not admin by hitting /admin/stats -> should be 403
        stats = requests.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert stats.status_code == 403, f"Expected 403 for non-admin, got {stats.status_code}: {stats.text}"
        assert "admin" in stats.json().get("detail", "").lower()

        # Cleanup: delete this newly created account
        d = requests.request(
            "DELETE",
            f"{API}/auth/account",
            json={"password": "Test@1234"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert d.status_code == 200, d.text


# ---------- Admin stats access control ----------

class TestAdminStatsAccess:
    def test_demo_user_forbidden(self, demo_token):
        r = requests.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
        assert r.status_code == 403
        assert "admin" in r.json().get("detail", "").lower()

    def test_no_auth_returns_401_or_403(self):
        r = requests.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_granted_admin_can_access(self):
        # Register a throwaway user and grant admin via manage_admin.py
        suffix = _unique_suffix()
        username = f"TEST_admin_{suffix}"
        reg = requests.post(
            f"{API}/auth/register",
            json={"username": username, "email": f"{username}@test.local", "password": "Test@1234"},
            timeout=15,
        )
        assert reg.status_code == 200, reg.text
        token = reg.json()["access_token"]

        # Without grant -> 403
        r0 = requests.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r0.status_code == 403

        # Grant admin
        proc = subprocess.run(
            ["python", "/app/backend/manage_admin.py", "grant", username],
            capture_output=True, text=True, cwd="/app/backend", timeout=30,
        )
        assert proc.returncode == 0, f"manage_admin grant failed: {proc.stdout} {proc.stderr}"

        # Now should be 200
        r1 = requests.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r1.status_code == 200, r1.text
        body = r1.json()
        for k in ("total_users", "total_assets", "assets_by_category", "users"):
            assert k in body

        # Cleanup: delete throwaway user account (also removes admin)
        d = requests.request(
            "DELETE",
            f"{API}/auth/account",
            json={"password": "Test@1234"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert d.status_code == 200, d.text

    def test_super_admin_can_access(self):
        """Register a user, promote them to is_super_admin=true directly in DB, verify 200."""
        suffix = _unique_suffix()
        username = f"TEST_super_{suffix}"
        reg = requests.post(
            f"{API}/auth/register",
            json={"username": username, "email": f"{username}@test.local", "password": "Test@1234"},
            timeout=15,
        )
        assert reg.status_code == 200, reg.text
        token = reg.json()["access_token"]

        # Set is_super_admin=true via a small helper script (use pymongo sync)
        script = (
            "import os;from pymongo import MongoClient;"
            "from dotenv import load_dotenv;from pathlib import Path;"
            "load_dotenv(Path('/app/backend/.env'));"
            "c=MongoClient(os.environ['MONGO_URL']);db=c[os.environ['DB_NAME']];"
            f"r=db.users.update_one({{'username':'{username}'}},"
            "{'$set':{'is_super_admin':True}});"
            "print('matched', r.matched_count, 'modified', r.modified_count)"
        )
        proc = subprocess.run(["python", "-c", script], capture_output=True, text=True, timeout=30)
        assert proc.returncode == 0, proc.stderr
        assert "matched 1" in proc.stdout, proc.stdout

        r1 = requests.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r1.status_code == 200, r1.text

        # Cleanup
        d = requests.request(
            "DELETE",
            f"{API}/auth/account",
            json={"password": "Test@1234"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert d.status_code == 200, d.text


# ---------- Delete account endpoint ----------

class TestDeleteAccount:
    def test_delete_requires_auth(self):
        r = requests.request("DELETE", f"{API}/auth/account", json={"password": "x"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_delete_wrong_password_401(self):
        suffix = _unique_suffix()
        username = f"TEST_del_wp_{suffix}"
        reg = requests.post(
            f"{API}/auth/register",
            json={"username": username, "email": f"{username}@test.local", "password": "Test@1234"},
            timeout=15,
        )
        assert reg.status_code == 200, reg.text
        token = reg.json()["access_token"]

        r = requests.request(
            "DELETE",
            f"{API}/auth/account",
            json={"password": "WRONG"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 401, r.text

        # cleanup - real delete
        d = requests.request(
            "DELETE",
            f"{API}/auth/account",
            json={"password": "Test@1234"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert d.status_code == 200

    def test_delete_success_and_login_denied(self):
        suffix = _unique_suffix()
        username = f"TEST_del_ok_{suffix}"
        password = "Test@1234"
        reg = requests.post(
            f"{API}/auth/register",
            json={"username": username, "email": f"{username}@test.local", "password": password},
            timeout=15,
        )
        assert reg.status_code == 200, reg.text
        token = reg.json()["access_token"]

        # Delete
        d = requests.request(
            "DELETE",
            f"{API}/auth/account",
            json={"password": password},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert d.status_code == 200, d.text
        assert "delete" in d.json().get("message", "").lower()

        # Subsequent login must fail
        login = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=15)
        assert login.status_code == 401, f"Expected 401 after deletion, got {login.status_code}"


# ---------- Rate limiting ----------

class TestRateLimiting:
    def test_login_burst_triggers_429(self):
        """
        Fire many wrong-password logins for a dedicated throwaway username so
        we don't lock out demo_user for other tests. Limit is 30/300s.
        Also, get_client_ip uses X-Forwarded-For so we spoof a unique IP to
        keep this isolated from other IP-scoped tests.
        """
        burst_username = f"TEST_rl_{_unique_suffix()}"
        spoof_ip = f"10.99.{int(time.time()) % 250}.{int(time.time()/60) % 250}"
        headers = {"X-Forwarded-For": spoof_ip}

        got_429 = False
        last_status = None
        for i in range(45):
            r = requests.post(
                f"{API}/auth/login",
                json={"username": burst_username, "password": "wrong"},
                headers=headers,
                timeout=15,
            )
            last_status = r.status_code
            if r.status_code == 429:
                got_429 = True
                detail = r.json().get("detail", "")
                assert "too many" in detail.lower() or "many attempts" in detail.lower(), detail
                break
        assert got_429, f"Never received 429 after 45 attempts; last status={last_status}"
