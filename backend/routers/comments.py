from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore import SERVER_TIMESTAMP, Increment

from auth import get_current_user
from models.schemas import CommentCreate, CommentUpdate, ReplyCreate
from services.firestore import get_db

router = APIRouter(
    prefix="/api/bands/{band_id}/media/{media_id}/comments",
    tags=["comments"],
)


@router.post("")
async def create_comment(
    band_id: str,
    media_id: str,
    body: CommentCreate,
    user: dict = Depends(get_current_user),
):
    db = get_db()

    # Verify media exists
    media_ref = db.collection("bands").document(band_id).collection("media").document(media_id)
    if not media_ref.get().exists:
        raise HTTPException(status_code=404, detail="Media not found")

    comment_ref = media_ref.collection("comments").document()
    comment_ref.set(
        {
            "timestamp": body.timestamp,
            "text": body.text,
            "author": user.get("name") or user.get("email") or "Unknown",
            "authorUid": user["uid"],
            "createdAt": SERVER_TIMESTAMP,
            "resolved": False,
            "replyCount": 0,
        }
    )

    # Increment comment count on media doc
    media_ref.update({"commentCount": Increment(1)})

    return {"id": comment_ref.id}


@router.get("")
async def list_comments(
    band_id: str,
    media_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    docs = (
        db.collection("bands")
        .document(band_id)
        .collection("media")
        .document(media_id)
        .collection("comments")
        .order_by("timestamp")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.patch("/{comment_id}")
async def update_comment(
    band_id: str,
    media_id: str,
    comment_id: str,
    body: CommentUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    ref = (
        db.collection("bands")
        .document(band_id)
        .collection("media")
        .document(media_id)
        .collection("comments")
        .document(comment_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Comment not found")

    updates = {}
    if body.resolved is not None:
        updates["resolved"] = body.resolved
    if body.text is not None:
        updates["text"] = body.text
    if updates:
        ref.update(updates)

    return {"ok": True}


@router.delete("/{comment_id}")
async def delete_comment(
    band_id: str,
    media_id: str,
    comment_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    ref = (
        db.collection("bands")
        .document(band_id)
        .collection("media")
        .document(media_id)
        .collection("comments")
        .document(comment_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Comment not found")

    data = doc.to_dict()
    if data.get("authorUid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Can only delete your own comments")

    ref.delete()

    # Decrement comment count
    media_ref = db.collection("bands").document(band_id).collection("media").document(media_id)
    media_ref.update({"commentCount": Increment(-1)})

    return {"ok": True}


@router.post("/{comment_id}/replies")
async def add_reply(
    band_id: str,
    media_id: str,
    comment_id: str,
    body: ReplyCreate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    comment_ref = (
        db.collection("bands")
        .document(band_id)
        .collection("media")
        .document(media_id)
        .collection("comments")
        .document(comment_id)
    )
    if not comment_ref.get().exists:
        raise HTTPException(status_code=404, detail="Comment not found")

    reply_ref = comment_ref.collection("replies").document()
    reply_ref.set(
        {
            "text": body.text,
            "author": user.get("name") or user.get("email") or "Unknown",
            "authorUid": user["uid"],
            "createdAt": SERVER_TIMESTAMP,
        }
    )

    comment_ref.update({"replyCount": Increment(1)})

    return {"id": reply_ref.id}
