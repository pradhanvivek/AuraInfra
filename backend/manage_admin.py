"""
Grant or revoke admin access for a user.

This is intentionally NOT exposed as an API endpoint — admin status should
only be changed by someone with direct access to the server/database, not
by any authenticated app user. Run manually:

    python manage_admin.py grant <username>
    python manage_admin.py revoke <username>
    python manage_admin.py list
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


async def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("grant", "revoke", "list"):
        print(__doc__)
        sys.exit(1)

    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'test_database')]

    action = sys.argv[1]

    if action == "list":
        async for user in db.users.find({"is_admin": True}, {"_id": 0, "username": 1, "id": 1}):
            print(f"{user['username']} ({user['id']})")
        return

    if len(sys.argv) < 3:
        print("Usage: python manage_admin.py [grant|revoke] <username>")
        sys.exit(1)

    username = sys.argv[2]
    is_admin = action == "grant"
    result = await db.users.update_one(
        {"username": username},
        {"$set": {"is_admin": is_admin}}
    )
    if result.matched_count == 0:
        print(f"No user found with username '{username}'")
        sys.exit(1)

    print(f"{'Granted' if is_admin else 'Revoked'} admin access for '{username}'")


if __name__ == "__main__":
    asyncio.run(main())
