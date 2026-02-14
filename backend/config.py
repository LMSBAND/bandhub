from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gcp_project_id: str = "lms-bandhub"
    gcs_bucket_name: str = "lms-bandhub-media"
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
