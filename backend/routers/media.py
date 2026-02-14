import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from google.cloud.firestore import SERVER_TIMESTAMP

from auth import get_current_user
from models.schemas import MediaUpdate, UploadResponse
from services.firestore import get_db
from services.storage import upload_blob, generate_signed_url, delete_blob
from services.audio import compute_peaks, get_duration

router = APIRouter(prefix="/api/bands/{band_id}/media", tags=["media"])

# Map MIME types to our simplified categories
MIME_TYPE_MAP = {
    "audio": ["audio/"],
    "video": ["video/"],
    "image": ["image/"],
    "pdf": ["application/pdf"],
}


def _classify_type(mime_type: str) -> str:
    for category, prefixes in MIME_TYPE_MAP.items():
        if any(mime_type.startswith(p) for p in prefixes):
            return category
    return "other"


@router.post("/upload", response_model=UploadResponse)
async def upload_media(
    band_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    db = get_db()

    # Verify band membership
    band_doc = db.collection("bands").document(band_id).get()
    if not band_doc.exists or user["uid"] not in band_doc.to_dict().get("members", {}):
        raise HTTPException(status_code=403, detail="Not a member of this band")

    content = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    file_type = _classify_type(mime_type)
    file_id = uuid.uuid4().hex

    # Upload to GCS
    gcs_path = f"bands/{band_id}/media/{file_id}/{file.filename}"
    upload_blob(content, gcs_path, mime_type)

    # Build media document
    media_data: dict = {
        "name": file.filename,
        "type": file_type,
        "mimeType": mime_type,
        "gcsPath": gcs_path,
        "size": len(content),
        "tags": [],
        "uploadedBy": user["uid"],
        "uploadedAt": SERVER_TIMESTAMP,
        "commentCount": 0,
    }

    # Compute audio-specific metadata
    if file_type == "audio":
        media_data["duration"] = get_duration(content)
        media_data["peaks"] = compute_peaks(content)

    # Save to Firestore
    media_ref = db.collection("bands").document(band_id).collection("media").document(file_id)
    media_ref.set(media_data)

    return UploadResponse(media_id=file_id, name=file.filename or "", type=file_type)


@router.get("")
async def list_media(
    band_id: str,
    type: str | None = None,
    tag: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query = db.collection("bands").document(band_id).collection("media")

    if type:
        query = query.where("type", "==", type)

    docs = list(query.order_by("uploadedAt", direction="DESCENDING").stream())
    result = []
    for d in docs:
        data = d.to_dict()
        if tag and tag not in data.get("tags", []):
            continue
        data["id"] = d.id
        # Don't send peaks in list view (too large)
        data.pop("peaks", None)
        result.append(data)

    return result


@router.get("/{media_id}")
async def get_media(
    band_id: str,
    media_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = db.collection("bands").document(band_id).collection("media").document(media_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Media not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return data


@router.get("/{media_id}/audio-url")
async def get_audio_url(
    band_id: str,
    media_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = db.collection("bands").document(band_id).collection("media").document(media_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Media not found")
    data = doc.to_dict()
    url = generate_signed_url(data["gcsPath"])
    return {"url": url}


@router.patch("/{media_id}")
async def update_media(
    band_id: str,
    media_id: str,
    body: MediaUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    ref = db.collection("bands").document(band_id).collection("media").document(media_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Media not found")

    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.tags is not None:
        updates["tags"] = body.tags
    if body.project is not None:
        updates["project"] = body.project

    if updates:
        ref.update(updates)

    return {"ok": True}


@router.delete("/{media_id}")
async def delete_media(
    band_id: str,
    media_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    ref = db.collection("bands").document(band_id).collection("media").document(media_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Media not found")

    data = doc.to_dict()

    # Delete from GCS
    try:
        delete_blob(data["gcsPath"])
    except Exception:
        pass  # File might already be gone

    # Delete Firestore doc
    ref.delete()

    return {"ok": True}
