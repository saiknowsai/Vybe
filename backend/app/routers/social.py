"""Users, 'going', friends and reviews — same contract as the old server.

NOTE: there is no authentication yet; user_id comes from the client. Fine for a
prototype, must be fixed (real auth) before public launch.
"""
from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from ..db import get_db
from ..models import (AcceptRequestModel, FriendRequestModel, GoingEventModel,
                      ReviewModel, UserProfileModel)
from ..util import clean, new_id, now_iso

router = APIRouter()


# ─── Users ───────────────────────────────────────────────────────────────────

@router.post("/user/profile")
async def upsert_profile(body: UserProfileModel):
    db = get_db()
    data = body.model_dump() | {"updatedAt": now_iso()}
    clash = await db.users.find_one({"username": body.username, "user_id": {"$ne": body.user_id}})
    if clash:
        raise HTTPException(status_code=409, detail="Username taken")
    await db.users.update_one({"user_id": body.user_id},
                              {"$set": data, "$setOnInsert": {"createdAt": now_iso()}},
                              upsert=True)
    return clean(await db.users.find_one({"user_id": body.user_id}))


@router.get("/user/profile/{username}")
async def get_profile(username: str):
    user = await get_db().users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return clean(user)


@router.post("/user/going")
async def mark_going(body: GoingEventModel):
    db = get_db()
    existing = await db.going_events.find_one({"user_id": body.user_id, "event_id": body.event_id})
    await db.going_events.replace_one({"user_id": body.user_id, "event_id": body.event_id},
                                      body.model_dump() | {"createdAt": now_iso()}, upsert=True)
    was_public = bool(existing and existing.get("privacy") == "public")
    is_public = body.privacy == "public"
    if is_public != was_public:  # only count each user once
        await db.events.update_one({"id": body.event_id},
                                   {"$inc": {"attendeeCount": 1 if is_public else -1}})
    return {"success": True}


@router.delete("/user/going/{user_id}/{event_id}")
async def remove_going(user_id: str, event_id: str):
    db = get_db()
    existing = await db.going_events.find_one_and_delete({"user_id": user_id, "event_id": event_id})
    if existing and existing.get("privacy") == "public":
        await db.events.update_one({"id": event_id, "attendeeCount": {"$gt": 0}},
                                   {"$inc": {"attendeeCount": -1}})
    return {"success": True}


@router.get("/user/{user_id}/going")
async def user_going(user_id: str):
    cursor = get_db().going_events.find({"user_id": user_id})
    return [clean(g) for g in await cursor.to_list(length=200)]


@router.get("/event/{event_id}/going")
async def event_going(event_id: str):
    cursor = get_db().going_events.find({"event_id": event_id, "privacy": "public"})
    return [{"user_id": g["user_id"], "username": g["username"]}
            for g in await cursor.to_list(length=200)]


# ─── Friends ─────────────────────────────────────────────────────────────────

@router.post("/friends/request")
async def send_friend_request(body: FriendRequestModel):
    db = get_db()
    target = await db.users.find_one({"username": body.to_username})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["user_id"] == body.from_user_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    existing = await db.friend_requests.find_one({
        "$or": [
            {"from_user_id": body.from_user_id, "to_user_id": target["user_id"]},
            {"from_user_id": target["user_id"], "to_user_id": body.from_user_id},
        ],
        "status": {"$in": ["pending", "accepted"]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="Request already sent or already friends")
    req = {
        "id": new_id(), "from_user_id": body.from_user_id, "from_username": body.from_username,
        "to_user_id": target["user_id"], "to_username": body.to_username,
        "status": "pending", "createdAt": now_iso(),
    }
    await db.friend_requests.insert_one(dict(req))
    return req


@router.put("/friends/request/{request_id}/accept")
async def accept_request(request_id: str, body: AcceptRequestModel):
    res = await get_db().friend_requests.update_one(
        {"id": request_id, "to_user_id": body.user_id, "status": "pending"},
        {"$set": {"status": "accepted", "updatedAt": now_iso()}})
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"success": True}


@router.put("/friends/request/{request_id}/reject")
async def reject_request(request_id: str, body: AcceptRequestModel | None = None):
    q: dict = {"id": request_id, "status": "pending"}
    if body:  # frontend may not send it yet; when it does, only the recipient can reject
        q["to_user_id"] = body.user_id
    await get_db().friend_requests.update_one(q, {"$set": {"status": "rejected", "updatedAt": now_iso()}})
    return {"success": True}


@router.get("/friends/{user_id}")
async def list_friends(user_id: str):
    db = get_db()
    reqs = await db.friend_requests.find({
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}], "status": "accepted",
    }).to_list(length=500)
    other_ids = [r["to_user_id"] if r["from_user_id"] == user_id else r["from_user_id"] for r in reqs]
    users = {u["user_id"]: u for u in await db.users.find({"user_id": {"$in": other_ids}}).to_list(length=500)}
    out = []
    for r, fid in zip(reqs, other_ids):
        u = users.get(fid, {})
        uname = r["to_username"] if r["from_user_id"] == user_id else r["from_username"]
        out.append({"requestId": r["id"], "userId": fid, "username": uname,
                    "displayName": u.get("display_name", uname), "avatarIndex": u.get("avatar_index", 0),
                    "city": u.get("city", ""), "status": "accepted"})
    return out


@router.get("/friends/requests/{user_id}")
async def pending_requests(user_id: str):
    reqs = await get_db().friend_requests.find({
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}], "status": "pending",
    }).to_list(length=100)
    out = []
    for r in reqs:
        sent = r["from_user_id"] == user_id
        out.append({"requestId": r["id"],
                    "userId": r["to_user_id"] if sent else r["from_user_id"],
                    "username": r["to_username"] if sent else r["from_username"],
                    "displayName": r["to_username"] if sent else r["from_username"],
                    "avatarIndex": 0, "city": "",
                    "status": "pending_sent" if sent else "pending_received"})
    return out


# ─── Reviews ─────────────────────────────────────────────────────────────────

@router.post("/reviews")
async def add_review(body: ReviewModel):
    db = get_db()
    if not await db.events.find_one({"id": body.event_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Event not found")
    review = body.model_dump() | {"id": new_id(), "createdAt": now_iso()}
    # One review per user per event — a second one replaces the first
    await db.reviews.replace_one({"user_id": body.user_id, "event_id": body.event_id},
                                 dict(review), upsert=True)
    agg = await db.reviews.aggregate([
        {"$match": {"event_id": body.event_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ]).to_list(length=1)
    if agg:
        await db.events.update_one({"id": body.event_id},
                                   {"$set": {"averageRating": round(agg[0]["avg"], 1),
                                             "reviewCount": agg[0]["n"]}})
    return review


@router.get("/reviews/{event_id}")
async def list_reviews(event_id: str):
    cursor = get_db().reviews.find({"event_id": event_id}).sort("createdAt", -1).limit(20)
    return [clean(r) for r in await cursor.to_list(length=20)]
