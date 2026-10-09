"""Community SOP runs with immutable checklist snapshots and approval gates."""
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from access import require_community

class Checklist(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=160)
    steps: list[str] = Field(min_length=1, max_length=30)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        if not value.strip():
            raise ValueError("Title cannot be blank")
        return value.strip()

    @field_validator("steps")
    @classmethod
    def clean_steps(cls, values):
        if any(not value.strip() or len(value) > 500 for value in values):
            raise ValueError("Steps must contain 1–500 characters")
        return [value.strip() for value in values]

class StartRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: str
    assignee_id: str
    due_at: datetime

    @field_validator("due_at")
    @classmethod
    def future_due(cls, value):
        if value.tzinfo is None:
            raise ValueError("Due date must include timezone")
        value = value.astimezone(timezone.utc)
        if value <= datetime.now(timezone.utc):
            raise ValueError("Due date must be in the future")
        return value

class CompleteStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    evidence: str = Field(min_length=1, max_length=2000)

    @field_validator("evidence")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Evidence is required")
        return value.strip()

class ReviewRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approve", "reopen"]
    note: str = Field(min_length=1, max_length=2000)

    @field_validator("note")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Review note is required")
        return value.strip()


def sop_router(db, current_user):
    router = APIRouter(prefix="/api/properties/{property_id}/sops")

    @router.get("")
    async def overview(property_id: str, user_id: str = Depends(current_user)):
        role = await require_community(db, property_id, user_id)
        templates = await db.sop_templates.find({"property_id": property_id}, {"_id": 0}).to_list(200)
        query = {"property_id": property_id}
        if role != "admin":
            query["assignee_id"] = user_id
        runs = await db.sop_runs.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
        return {"role": role, "templates": templates, "runs": runs}

    @router.post("/templates", status_code=201)
    async def create_template(property_id: str, payload: Checklist, user_id: str = Depends(current_user)):
        await require_community(db, property_id, user_id, {"admin"})
        doc = {"id": str(uuid4()), "property_id": property_id, **payload.model_dump(),
               "created_by": user_id, "created_at": datetime.now(timezone.utc)}
        await db.sop_templates.insert_one(dict(doc))
        return doc

    @router.post("/runs", status_code=201)
    async def start_run(property_id: str, payload: StartRun, user_id: str = Depends(current_user)):
        await require_community(db, property_id, user_id, {"admin"})
        await require_community(db, property_id, payload.assignee_id)
        template = await db.sop_templates.find_one({"id": payload.template_id, "property_id": property_id})
        if not template:
            raise HTTPException(404, "SOP template not found")
        doc = {"id": str(uuid4()), "property_id": property_id, "template_id": template["id"],
               "title": template["title"], "assignee_id": payload.assignee_id,
               "due_at": payload.due_at.isoformat(), "status": "open", "revision": 0,
               "steps": [{"text": text, "completed": False} for text in template["steps"]],
               "created_at": datetime.now(timezone.utc), "history": [{"action": "started", "by": user_id, "at": datetime.now(timezone.utc)}]}
        await db.sop_runs.insert_one(dict(doc))
        return doc

    async def accessible_run(property_id, run_id, user_id):
        role = await require_community(db, property_id, user_id)
        run = await db.sop_runs.find_one({"id": run_id, "property_id": property_id}, {"_id": 0})
        if not run:
            raise HTTPException(404, "SOP run not found")
        if role != "admin" and run["assignee_id"] != user_id:
            raise HTTPException(403, "Only the assignee can complete this SOP")
        return run

    async def persist(run, changes, event):
        result = await db.sop_runs.update_one(
            {"id": run["id"], "property_id": run["property_id"], "revision": run["revision"]},
            {"$set": changes, "$inc": {"revision": 1}, "$push": {"history": event}},
        )
        if not result.modified_count:
            raise HTTPException(409, "SOP changed; refresh and retry")
        return {**run, **changes, "revision": run["revision"] + 1, "history": [*run["history"], event]}

    @router.put("/runs/{run_id}/steps/{step_index}")
    async def complete_step(property_id: str, run_id: str, step_index: int, payload: CompleteStep,
                            user_id: str = Depends(current_user)):
        run = await accessible_run(property_id, run_id, user_id)
        if run["status"] != "open":
            raise HTTPException(409, "Only open SOPs can be edited")
        if step_index < 0 or step_index >= len(run["steps"]):
            raise HTTPException(404, "Checklist step not found")
        if run["steps"][step_index]["completed"]:
            raise HTTPException(409, "Step already completed")
        run["steps"][step_index].update(completed=True, evidence=payload.evidence,
                                        completed_by=user_id, completed_at=datetime.now(timezone.utc))
        return await persist(run, {"steps": run["steps"]},
                             {"action": "step_completed", "step": step_index, "by": user_id, "at": datetime.now(timezone.utc)})

    @router.post("/runs/{run_id}/submit")
    async def submit(property_id: str, run_id: str, user_id: str = Depends(current_user)):
        run = await accessible_run(property_id, run_id, user_id)
        if run["status"] != "open" or not all(step["completed"] for step in run["steps"]):
            raise HTTPException(409, "Complete every checklist step before submitting")
        return await persist(run, {"status": "awaiting_approval"},
                             {"action": "submitted", "by": user_id, "at": datetime.now(timezone.utc)})

    @router.post("/runs/{run_id}/review")
    async def review(property_id: str, run_id: str, payload: ReviewRun, user_id: str = Depends(current_user)):
        await require_community(db, property_id, user_id, {"admin"})
        run = await accessible_run(property_id, run_id, user_id)
        if run["status"] != "awaiting_approval":
            raise HTTPException(409, "SOP must be submitted before review")
        changes = {"status": "approved" if payload.decision == "approve" else "open"}
        if payload.decision == "reopen":
            changes["steps"] = [{"text": step["text"], "completed": False} for step in run["steps"]]
        return await persist(run, changes, {"action": payload.decision, "note": payload.note,
                                           "by": user_id, "at": datetime.now(timezone.utc)})
    return router
