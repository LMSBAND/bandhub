from pydantic import BaseModel


class BandCreate(BaseModel):
    name: str


class BandJoin(BaseModel):
    invite_code: str


class MediaUpdate(BaseModel):
    name: str | None = None
    tags: list[str] | None = None
    project: str | None = None


class CommentCreate(BaseModel):
    timestamp: float
    text: str


class CommentUpdate(BaseModel):
    resolved: bool | None = None
    text: str | None = None


class ReplyCreate(BaseModel):
    text: str


class EventCreate(BaseModel):
    title: str
    type: str = "other"
    start: str  # ISO datetime
    end: str
    location: str = ""
    description: str = ""
    linked_media: list[str] = []


class RSVPUpdate(BaseModel):
    status: str  # "going" | "maybe" | "not_going"


class UploadResponse(BaseModel):
    media_id: str
    name: str
    type: str
