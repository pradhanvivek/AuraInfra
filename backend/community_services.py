"""Association-curated services and booking requests; no external delivery API implied."""
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from access import require_community

class Service(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=160)
    category: Literal["laundry", "car_wash", "food", "repairs", "other"]
    vendor_name: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)
    @field_validator("name", "vendor_name", "description")
    @classmethod
    def nonblank(cls, value):
        if not value.strip(): raise ValueError("Value cannot be blank")
        return value.strip()

class Booking(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service_id: str
    instructions: str = Field(min_length=1, max_length=2000)
    preferred_at: datetime
    @field_validator("instructions")
    @classmethod
    def nonblank(cls, value):
        if not value.strip(): raise ValueError("Instructions are required")
        return value.strip()
    @field_validator("preferred_at")
    @classmethod
    def future(cls, value):
        if value.tzinfo is None or value <= datetime.now(timezone.utc):
            raise ValueError("Choose a future time including timezone")
        return value.astimezone(timezone.utc)

class BookingStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["confirmed", "in_progress", "completed", "cancelled"]
    note: str = Field(min_length=1, max_length=2000)
    @field_validator("note")
    @classmethod
    def nonblank(cls, value):
        if not value.strip(): raise ValueError("A note is required")
        return value.strip()

TRANSITIONS = {"requested": {"confirmed", "cancelled"}, "confirmed": {"in_progress", "cancelled"},
               "in_progress": {"completed", "cancelled"}, "completed": set(), "cancelled": set()}

def services_router(db, current_user):
    router = APIRouter(prefix="/api/properties/{property_id}/services")
    @router.get("")
    async def overview(property_id: str, user_id: str = Depends(current_user)):
        role = await require_community(db, property_id, user_id)
        query = {"property_id": property_id}
        if role != "admin": query["user_id"] = user_id
        return {"role": role,
                "services": await db.community_services.find({"property_id": property_id, "active": True}, {"_id": 0}).to_list(200),
                "bookings": await db.service_bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)}

    @router.post("", status_code=201)
    async def create_service(property_id: str, payload: Service, user_id: str = Depends(current_user)):
        await require_community(db, property_id, user_id, {"admin"})
        doc = {"id": str(uuid4()), "property_id": property_id, **payload.model_dump(), "active": True,
               "created_by": user_id, "created_at": datetime.now(timezone.utc)}
        await db.community_services.insert_one(dict(doc))
        return doc

    @router.delete("/{service_id}", status_code=204)
    async def retire_service(property_id: str, service_id: str, user_id: str = Depends(current_user)):
        await require_community(db, property_id, user_id, {"admin"})
        result = await db.community_services.update_one({"id": service_id, "property_id": property_id}, {"$set": {"active": False}})
        if not result.matched_count: raise HTTPException(404, "Service not found")

    @router.post("/bookings", status_code=201)
    async def create_booking(property_id: str, payload: Booking, user_id: str = Depends(current_user)):
        await require_community(db, property_id, user_id, {"admin", "resident"})
        service = await db.community_services.find_one({"id": payload.service_id, "property_id": property_id, "active": True})
        if not service: raise HTTPException(404, "Service not available")
        doc = {"id": str(uuid4()), "property_id": property_id, "user_id": user_id, **payload.model_dump(),
               "preferred_at": payload.preferred_at.isoformat(),
               "service_name": service["name"], "vendor_name": service["vendor_name"], "category": service["category"],
               "status": "requested", "created_at": datetime.now(timezone.utc),
               "history": [{"status": "requested", "by": user_id, "at": datetime.now(timezone.utc)}]}
        await db.service_bookings.insert_one(dict(doc))
        return doc

    @router.put("/bookings/{booking_id}")
    async def change_status(property_id: str, booking_id: str, payload: BookingStatus, user_id: str = Depends(current_user)):
        role = await require_community(db, property_id, user_id)
        doc = await db.service_bookings.find_one({"id": booking_id, "property_id": property_id}, {"_id": 0})
        if not doc: raise HTTPException(404, "Booking not found")
        if role != "admin" and (doc["user_id"] != user_id or payload.status != "cancelled" or doc["status"] != "requested"):
            raise HTTPException(403, "Only administrators can manage fulfillment")
        if payload.status not in TRANSITIONS[doc["status"]]: raise HTTPException(409, "Invalid booking transition")
        event = {"status": payload.status, "note": payload.note, "by": user_id, "at": datetime.now(timezone.utc)}
        result = await db.service_bookings.update_one({"id": booking_id, "property_id": property_id, "status": doc["status"]},
                                                    {"$set": {"status": payload.status}, "$push": {"history": event}})
        if not result.modified_count: raise HTTPException(409, "Booking changed; refresh and retry")
        return {**doc, "status": payload.status, "history": [*doc["history"], event]}
    return router
