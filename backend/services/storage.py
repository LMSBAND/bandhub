import datetime
from google.cloud import storage
from config import settings

_client: storage.Client | None = None


def get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client(project=settings.gcp_project_id)
    return _client


def get_bucket() -> storage.Bucket:
    return get_client().bucket(settings.gcs_bucket_name)


def upload_blob(data: bytes, destination: str, content_type: str) -> str:
    """Upload bytes to GCS. Returns the GCS path."""
    blob = get_bucket().blob(destination)
    blob.upload_from_string(data, content_type=content_type)
    return destination


def generate_signed_url(gcs_path: str, expiration_minutes: int = 60) -> str:
    """Generate a signed URL for temporary access to a GCS object."""
    blob = get_bucket().blob(gcs_path)
    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=expiration_minutes),
        method="GET",
    )
    return url


def delete_blob(gcs_path: str) -> None:
    """Delete a blob from GCS."""
    blob = get_bucket().blob(gcs_path)
    blob.delete()
