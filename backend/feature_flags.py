"""Deployment-level module visibility. MongoDB _id guarantees one config document."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, StrictBool

CONFIG_ID = "resident-app"
DEFAULT_FLAGS = {"community": True, "assets": True}

class FeatureFlags(BaseModel):
    model_config = ConfigDict(extra="forbid")
    community: StrictBool
    assets: StrictBool

async def read_flags(db):
    doc = await db.app_configuration.find_one({"_id": CONFIG_ID}) or {}
    # Malformed/manual DB values never become truthy strings in the client.
    return {key: doc[key] if type(doc.get(key)) is bool else default
            for key, default in DEFAULT_FLAGS.items()}

def feature_flags_router(db, current_user, super_admin):
    router = APIRouter(prefix="/api")

    @router.get("/app-config", response_model=FeatureFlags)
    async def get_config(user_id: str = Depends(current_user)):
        return await read_flags(db)

    @router.put("/admin/super/app-config", response_model=FeatureFlags)
    async def set_config(flags: FeatureFlags, user_id: str = Depends(super_admin)):
        values = flags.model_dump()
        await db.app_configuration.update_one(
            {"_id": CONFIG_ID},
            {"$set": {**values, "updated_by": user_id, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return values

    return router
