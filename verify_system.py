import os
import requests

BASE_URL = os.getenv("ERVIS_BASE_URL", "http://localhost:8000")
TEST_EMAIL = os.getenv("ERVIS_TEST_EMAIL")
TEST_USER = os.getenv("ERVIS_TEST_USER")
TEST_PASS = os.getenv("ERVIS_TEST_PASS")


def _require_test_env():
    missing = []
    if not TEST_EMAIL:
        missing.append("ERVIS_TEST_EMAIL")
    if not TEST_USER:
        missing.append("ERVIS_TEST_USER")
    if not TEST_PASS:
        missing.append("ERVIS_TEST_PASS")

    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )

def verify_all():
    _require_test_env()
    print(f"🚀 Starting System Verification for {BASE_URL}")
    
    # 1. Register
    print(f"📝 1. Testing Registration for {TEST_EMAIL}...")
    reg_data = {
        "username": TEST_USER,
        "email": TEST_EMAIL,
        "password": TEST_PASS
    }
    try:
        r = requests.post(f"{BASE_URL}/api/auth/register", json=reg_data)
        if r.status_code == 200:
            print("✅ Registration successful!")
        elif r.status_code == 400 and "already registered" in r.text.lower():
            print("ℹ️ User already registered, proceeding to login test.")
        else:
            print(f"❌ Registration failed: {r.status_code} - {r.text}")
            return
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return

    # 2. Login
    print("🔑 2. Testing Login...")
    login_data = {
        "username": TEST_EMAIL, # uses email for login
        "password": TEST_PASS
    }
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", data=login_data)
        if r.status_code == 200:
            token_data = r.json()
            token = token_data["access_token"]
            user_id = token_data["user_id"]
            print(f"✅ Login successful! User ID: {user_id}")
        else:
            print(f"❌ Login failed: {r.status_code} - {r.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return

    # 3. Chat
    print("💬 3. Testing Chat Assistant...")
    headers = {"Authorization": f"Bearer {token}"}
    chat_data = {
        "user_id": user_id,
        "message": "Merhaba, nasılsın?"
    }
    try:
        r = requests.post(f"{BASE_URL}/api/chat", json=chat_data, headers=headers)
        if r.status_code == 200:
            resp = r.json()
            print(f"✅ Chat successful! Assistant reply: {resp['message']}")
            print(f"🤖 Model used: {resp.get('model_used', 'unknown')}")
        else:
            print(f"❌ Chat failed: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"❌ Chat error: {e}")

if __name__ == "__main__":
    verify_all()
