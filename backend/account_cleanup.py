"""Idempotent cleanup, retried from a durable account_deletions job."""
from datetime import datetime, timedelta


async def clean_account(db, job):
    user_id = job["user_id"]
    property_ids = job["property_ids"]
    property_scope = {"property_id": {"$in": property_ids}}
    # Remove descendants before parents, so retry never loses their IDs.
    post_ids = job["post_ids"]
    for collection in ("community_comments", "post_likes"):
        await db[collection].delete_many({"post_id": {"$in": post_ids}})
    if property_ids:
        for collection in ("property_documents", "documents", "fixtures", "measurements",
                           "paint_estimations", "vastu_analysis", "property_memberships",
                           "property_admin_assignments", "pending_user_approvals", "visitors",
                           "amenities", "amenity_bookings", "complaints", "meetings",
                           "hoa_meetings", "hoa_charges", "hoa_maintenance_charges", "maintenance_dues"):
            await db[collection].delete_many(property_scope)
        await db.meeting_rsvps.delete_many({"meeting_id": {"$in": job["meeting_ids"]}})
        await db.users.update_many({}, {"$pull": {
            "member_properties": {"$in": property_ids}, "managed_properties": {"$in": property_ids}}})
    for collection in ("properties", "vehicles", "appliances", "jewelry", "furniture", "art",
                       "maintenance", "notifications", "property_memberships", "community_posts",
                       "community_comments", "post_likes", "complaints", "meeting_rsvps",
                       "amenity_bookings", "maintenance_dues", "pending_user_approvals", "user_sessions", "password_resets"):
        await db[collection].delete_many({"user_id": user_id})
    await db.visitors.delete_many({"host_user_id": user_id})
    await db.property_admin_assignments.delete_many({"admin_user_id": user_id})
    await db.community_blocks.delete_many({"$or": [{"user_id": user_id}, {"blocked_user_id": user_id}]})
    await db.community_reports.delete_many({"reporter_id": user_id})
    await db.documents.delete_many({"uploaded_by": user_id})
    for collection in ("meetings", "hoa_meetings"):
        await db[collection].update_many({"organizer_id": user_id}, {"$set": {
            "organizer_id": "deleted", "organizer_name": "Deleted account"}})
    # Keep community accounting totals, remove app-held account links and metadata.
    for collection in ("payment_transactions", "payments", "hoa_maintenance_charges"):
        await db[collection].update_many({"user_id": user_id}, {"$set": {
            "user_id": "deleted", "metadata": {}, "user_name": "Deleted account", "user_email": None},
            "$unset": {"stripe_session_id": "", "stripe_payment_intent_id": ""}})
    # Strip references where this user acted on somebody else's community records.
    for collection, fields in {
        "visitors": ["approved_by"], "amenity_bookings": ["approved_by"],
        "property_memberships": ["approved_by"], "pending_user_approvals": ["reviewed_by"],
        "complaints": ["assigned_to"], "community_reports": ["reviewed_by"],
        "community_posts": ["moderated_by"], "community_comments": ["moderated_by"],
        "hoa_charges": ["created_by"], "maintenance_dues": ["created_by"],
    }.items():
        for field in fields:
            await db[collection].update_many({field: user_id}, {"$set": {field: "deleted"}})
    # Recompute public counters after author/comment removal.
    affected_posts = await db.community_posts.find({}).to_list(length=None)
    for post in affected_posts:
        comments = await db.community_comments.count_documents({"post_id": post["id"], "moderation_status": "approved"})
        likes = await db.post_likes.count_documents({"post_id": post["id"]})
        await db.community_posts.update_one({"id": post["id"]}, {"$set": {"comments_count": comments, "likes_count": likes}})
    await db.users.delete_one({"id": user_id})
    await db.account_deletions.update_one({"id": job["id"]}, {"$set": {
        "status": "completed", "completed_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=30)},
        "$unset": {"user_id": "", "property_ids": "", "post_ids": "", "meeting_ids": "", "apple_token": ""}})
