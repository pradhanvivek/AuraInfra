"""Community permissions. Database assignments/memberships are the authority."""
from fastapi import HTTPException

ACTIVE_MEMBERSHIP_STATES = ["active"]  # legacy auto-approved rows require an administrator review


async def community_role(db, property_id, user_id):
    user = await db.users.find_one({"id": user_id})
    if not user or user.get("disabled") or user.get("deletion_pending"):
        raise HTTPException(status_code=401, detail="Account is unavailable")
    if user.get("is_super_admin"):
        return "admin"
    if await db.properties.find_one({"id": property_id, "user_id": user_id}):
        return "admin"
    if await db.property_admin_assignments.find_one(
        {"property_id": property_id, "admin_user_id": user_id}
    ):
        return "admin"
    membership = await db.property_memberships.find_one({
        "property_id": property_id, "user_id": user_id,
        "status": {"$in": ACTIVE_MEMBERSHIP_STATES},
    })
    if membership:
        # A resident's claimed ownership is never an administrative assignment.
        return "security" if membership.get("role") == "security" else "resident"
    raise HTTPException(status_code=403, detail="Community access required")


async def require_community(db, property_id, user_id, roles=None):
    role = await community_role(db, property_id, user_id)
    if roles and role not in roles:
        raise HTTPException(status_code=403, detail="Insufficient community permissions")
    return role


def scoped_data(payload, field, scope):
    """Reject confused-deputy requests; persist the URL scope, never the body scope."""
    data = payload.dict()
    if data.get(field) not in (None, scope):
        raise HTTPException(status_code=400, detail=f"{field} must match the URL")
    data[field] = scope
    return data
