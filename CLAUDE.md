# LMS BandHub

A band collaboration platform for organizing media, reviewing demos with timestamped comments, and scheduling. Built as a PWA deployed on GCP Cloud Run.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (PWA)
- **Backend**: Python FastAPI
- **Database**: Firestore
- **Storage**: Google Cloud Storage
- **Auth**: Firebase Auth (Google sign-in)
- **Audio**: wavesurfer.js v7 + Regions plugin
- **Deploy**: Docker → Cloud Run

## Project Structure
- `frontend/` - React PWA (Vite)
- `backend/` - FastAPI server

## Local Development
```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# Or with Docker
docker-compose up
```

## Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase/GCP config.

## GCP Project
- Project: `lms-bandhub`
- Account: `bryanleavelle@gmail.com`

## Key Patterns
- Timestamp commenting uses wavesurfer.js Regions plugin (adapted from FlightRecordingAnalyzer)
- Firestore real-time listeners for collaborative features
- Pre-computed audio peaks stored in Firestore for instant waveform rendering
- Firebase Auth tokens verified on backend via middleware
