from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore import SERVER_TIMESTAMP

from auth import get_current_user
from models.schemas import EventCreate, RSVPUpdate
from services.firestore import get_db

router = APIRouter(prefix="/api/bands/{band_id}/events", tags=["calendar"])


@router.post("")
async def create_event(
    band_id: str,
    body: EventCreate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    ref = db.collection("bands").document(band_id).collection("events").document()
    ref.set(
        {
            "title": body.title,
            "type": body.type,
            "start": body.start,
            "end": body.end,
            "location": body.location,
            "description": body.description,
            "linkedMedia": body.linked_media,
            "rsvp": {user["uid"]: "going"},
            "createdBy": user["uid"],
            "createdAt": SERVER_TIMESTAMP,
        }
    )
    return {"id": ref.id}


@router.get("")
async def list_events(
    band_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    docs = (
        db.collection("bands")
        .document(band_id)
        .collection("events")
        .order_by("start")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.patch("/{event_id}")
async def update_event(
    band_id: str,
    event_id: str,
    body: EventCreate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    ref = db.collection("bands").document(band_id).collection("events").document(event_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Event not found")

    ref.update(
        {
            "title": body.title,
            "type": body.type,
            "start": body.start,
            "end": body.end,
            "location": body.location,
            "description": body.description,
            "linkedMedia": body.linked_media,
        }
    )
    return {"ok": True}


@router.post("/{event_id}/rsvp")
async def rsvp_event(
    band_id: str,
    event_id: str,
    body: RSVPUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    ref = db.collection("bands").document(band_id).collection("events").document(event_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Event not found")

    ref.update({f"rsvp.{user['uid']}": body.status})
    return {"ok": True}
