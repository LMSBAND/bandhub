import random
import string
from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore import SERVER_TIMESTAMP

from auth import get_current_user
from models.schemas import BandCreate, BandJoin
from services.firestore import get_db

router = APIRouter(prefix="/api/bands", tags=["bands"])


def _generate_invite_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.post("")
async def create_band(body: BandCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    band_ref = db.collection("bands").document()
    band_ref.set(
        {
            "name": body.name,
            "createdBy": user["uid"],
            "createdAt": SERVER_TIMESTAMP,
            "inviteCode": _generate_invite_code(),
            "members": {
                user["uid"]: {
                    "role": "admin",
                    "displayName": user.get("name") or user.get("email") or "Unknown",
                    "joinedAt": SERVER_TIMESTAMP,
                }
            },
        }
    )
    return {"id": band_ref.id, "name": body.name}


@router.get("/{band_id}")
async def get_band(band_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("bands").document(band_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Band not found")
    data = doc.to_dict()
    if user["uid"] not in data.get("members", {}):
        raise HTTPException(status_code=403, detail="Not a member of this band")
    return {"id": doc.id, **data}


@router.post("/join")
async def join_band(body: BandJoin, user: dict = Depends(get_current_user)):
    db = get_db()
    query = db.collection("bands").where("inviteCode", "==", body.invite_code.upper())
    docs = list(query.stream())
    if not docs:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    band_doc = docs[0]
    band_ref = db.collection("bands").document(band_doc.id)
    band_ref.update(
        {
            f"members.{user['uid']}": {
                "role": "member",
                "displayName": user.get("name") or user.get("email") or "Unknown",
                "joinedAt": SERVER_TIMESTAMP,
            }
        }
    )
    return {"id": band_doc.id, "name": band_doc.to_dict()["name"]}


@router.post("/{band_id}/invite")
async def refresh_invite(band_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("bands").document(band_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Band not found")
    data = doc.to_dict()
    member = data.get("members", {}).get(user["uid"])
    if not member or member.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can refresh invite codes")

    new_code = _generate_invite_code()
    db.collection("bands").document(band_id).update({"inviteCode": new_code})
    return {"invite_code": new_code}
