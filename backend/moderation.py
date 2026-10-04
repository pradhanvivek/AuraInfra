"""Human review before publication, reporting, and mutual user blocking."""
from datetime import datetime
from typing import Literal
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from access import require_community


class ContentReport(BaseModel):
    content_type: Literal["post", "comment"]
    content_id: str
    reason: str = Field(min_length=3, max_length=1000)


class ReviewContent(BaseModel):
    content_type: Literal["post", "comment"]
    content_id: str
    action: Literal["approve", "remove"]
    notes: str = Field(default="", max_length=1000)


async def blocked_users(db, user_id):
    rows = await db.community_blocks.find({"$or": [{"user_id": user_id}, {"blocked_user_id": user_id}]}).to_list(length=None)
    return list({r["blocked_user_id"] if r["user_id"] == user_id else r["user_id"] for r in rows})


async def visible_post(db, post_id, user_id):
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await require_community(db, post["property_id"], user_id)
    if post.get("moderation_status") != "approved" or post["user_id"] in await blocked_users(db, user_id):
        raise HTTPException(status_code=404, detail="Post is unavailable")
    return post


async def require_content_terms(db, user_id):
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("community_terms_accepted_at"):
        raise HTTPException(status_code=403, detail="Accept the community standards before posting")


def validate_content(*texts):
    # All media and text also undergo human review before publication.
    if any(not text.strip() or len(text) > 10000 for text in texts):
        raise HTTPException(status_code=400, detail="Content must contain 1–10,000 characters")


def serializable(rows):
    for row in rows:
        row.pop("_id", None)
    return rows


def moderation_router(db, authenticate):
    router = APIRouter(prefix="/api")

    @router.post("/community/accept-standards")
    async def accept_standards(user_id: str = Depends(authenticate)):
        await db.users.update_one({"id": user_id}, {"$set": {"community_terms_accepted_at": datetime.utcnow()}})
        return {"message": "Community standards accepted"}

    @router.post("/properties/{property_id}/community/reports")
    async def report(property_id: str, payload: ContentReport, user_id: str = Depends(authenticate)):
        await require_community(db, property_id, user_id)
        collection = db.community_posts if payload.content_type == "post" else db.community_comments
        item = await collection.find_one({"id": payload.content_id})
        if not item:
            raise HTTPException(status_code=404, detail="Content not found")
        post = item if payload.content_type == "post" else await db.community_posts.find_one({"id": item["post_id"]})
        if not post or post["property_id"] != property_id or item.get("moderation_status") != "approved":
            raise HTTPException(status_code=404, detail="Content not found in this community")
        await db.community_reports.update_one({"reporter_id": user_id, "content_type": payload.content_type,
            "content_id": payload.content_id}, {"$set": {"reason": payload.reason, "status": "pending",
                "property_id": property_id, "created_at": datetime.utcnow()},
            "$setOnInsert": {"id": str(uuid.uuid4())}}, upsert=True)
        return {"message": "Report submitted to the community administrator"}

    @router.post("/properties/{property_id}/community/blocks/{target_id}")
    async def block(property_id: str, target_id: str, user_id: str = Depends(authenticate)):
        await require_community(db, property_id, user_id)
        await require_community(db, property_id, target_id)
        if target_id == user_id:
            raise HTTPException(status_code=400, detail="Cannot block yourself")
        await db.community_blocks.update_one({"user_id": user_id, "blocked_user_id": target_id},
            {"$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.utcnow()}}, upsert=True)
        return {"message": "User blocked"}

    @router.get("/community/blocks")
    async def list_blocks(user_id: str = Depends(authenticate)):
        return serializable(await db.community_blocks.find({"user_id": user_id}).to_list(length=1000))

    @router.delete("/community/blocks/{target_id}")
    async def unblock(target_id: str, user_id: str = Depends(authenticate)):
        await db.community_blocks.delete_many({"user_id": user_id, "blocked_user_id": target_id})
        return {"message": "User unblocked"}

    @router.get("/admin/properties/{property_id}/moderation")
    async def queue(property_id: str, user_id: str = Depends(authenticate)):
        await require_community(db, property_id, user_id, {"admin"})
        # Missing status on older content is deliberately quarantined too.
        posts = await db.community_posts.find({"property_id": property_id,
            "moderation_status": {"$nin": ["approved", "removed"]}}).to_list(length=100)
        all_posts = await db.community_posts.find({"property_id": property_id}, {"id": 1}).to_list(length=None)
        comments = await db.community_comments.find({"post_id": {"$in": [p["id"] for p in all_posts]},
            "moderation_status": {"$nin": ["approved", "removed"]}}).to_list(length=100)
        reports = await db.community_reports.find({"property_id": property_id, "status": "pending"}).to_list(length=100)
        for report in reports:
            source = db.community_posts if report["content_type"] == "post" else db.community_comments
            item = await source.find_one({"id": report["content_id"]})
            if item:
                item.pop("_id", None)
                report["item"] = item
        return {"posts": serializable(posts), "comments": serializable(comments), "reports": serializable(reports)}

    @router.post("/admin/properties/{property_id}/moderation")
    async def review(property_id: str, payload: ReviewContent, user_id: str = Depends(authenticate)):
        await require_community(db, property_id, user_id, {"admin"})
        collection = db.community_posts if payload.content_type == "post" else db.community_comments
        item = await collection.find_one({"id": payload.content_id})
        if not item:
            raise HTTPException(status_code=404, detail="Content not found")
        post = item if payload.content_type == "post" else await db.community_posts.find_one({"id": item["post_id"]})
        if not post or post["property_id"] != property_id:
            raise HTTPException(status_code=404, detail="Content not found in this community")
        await collection.update_one({"id": payload.content_id}, {"$set": {
            "moderation_status": "approved" if payload.action == "approve" else "removed",
            "moderated_by": user_id, "moderated_at": datetime.utcnow(), "moderation_notes": payload.notes}})
        await db.community_reports.update_many({"property_id": property_id, "content_type": payload.content_type,
            "content_id": payload.content_id, "status": "pending"}, {"$set": {
                "status": "resolved", "reviewed_by": user_id, "resolution": payload.action,
                "reviewed_at": datetime.utcnow()}})
        count = await db.community_comments.count_documents({"post_id": post["id"], "moderation_status": "approved"})
        await db.community_posts.update_one({"id": post["id"]}, {"$set": {"comments_count": count}})
        return {"message": "Content reviewed"}

    @router.post("/admin/properties/{property_id}/community/suspend/{target_id}")
    async def suspend(property_id: str, target_id: str, user_id: str = Depends(authenticate)):
        await require_community(db, property_id, user_id, {"admin"})
        if await require_community(db, property_id, target_id) == "admin":
            raise HTTPException(status_code=400, detail="Use administrator management to revoke administrative access")
        await db.property_memberships.update_many({"property_id": property_id, "user_id": target_id},
            {"$set": {"status": "inactive"}})
        await db.users.update_one({"id": target_id}, {"$pull": {"member_properties": property_id}})
        await db.community_posts.update_many({"property_id": property_id, "user_id": target_id},
            {"$set": {"moderation_status": "removed"}})
        posts = await db.community_posts.find({"property_id": property_id}, {"id": 1}).to_list(length=None)
        await db.community_comments.update_many({"user_id": target_id, "post_id": {"$in": [p["id"] for p in posts]}},
            {"$set": {"moderation_status": "removed"}})
        for post in posts:
            count = await db.community_comments.count_documents({"post_id": post["id"], "moderation_status": "approved"})
            await db.community_posts.update_one({"id": post["id"]}, {"$set": {"comments_count": count}})
        return {"message": "Community membership suspended"}

    return router
