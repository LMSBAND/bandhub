from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth as firebase_auth

# Initialize Firebase Admin SDK (uses Application Default Credentials)
if not firebase_admin._apps:
    firebase_admin.initialize_app()

security = HTTPBearer()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify Firebase ID token and return decoded claims."""
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(claims: dict = Depends(verify_token)) -> dict:
    """Get current user info from verified token."""
    return {
        "uid": claims["uid"],
        "email": claims.get("email"),
        "name": claims.get("name"),
    }
