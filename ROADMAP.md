# LMS BandHub — Roadmap

## Current State (v0.1 - MVP)
- Firebase Auth (Google sign-in)
- Band creation & joining with admin approval (pending/member/admin roles)
- Media library (upload audio/video/images to GCS)
- Demo review with waveform player (wavesurfer.js) & timestamped comments
- Video playback with timestamped comments
- Comment threads with replies
- Song Info (BPM, Key, parts tracking with lyrics/needs-work status)
- Band chat with channels
- Calendar/events
- PWA installable
- Firestore security rules enforcing role-based access
- Deployed on Firebase Hosting: https://lms-bandhub.web.app

---

## Phase 1: Google Drive Integration (Storage Swap)
**Goal:** Replace Google Cloud Storage with users' own Google Drive. Zero storage cost for us.

### 1.1 Google Drive API Setup
- [ ] Enable Google Drive API in GCP console
- [ ] Add `https://www.googleapis.com/auth/drive.file` scope to Firebase Auth (only accesses files the app creates — no snooping on user files)
- [ ] Update Firebase Auth config to request Drive scope on sign-in

### 1.2 Drive Storage Layer
- [ ] Create a `useGoogleDrive` hook that wraps the Drive REST API
  - `uploadFile(file, folderId)` — upload media to user's Drive
  - `getFile(fileId)` — fetch file for playback
  - `deleteFile(fileId)` — remove file from Drive
  - `createFolder(name)` — create a "BandHub" folder in user's Drive
  - `shareFile(fileId, emails)` — share with band members (viewer access)
- [ ] On first upload, auto-create a `BandHub/<BandName>/` folder structure in the uploader's Drive
- [ ] Store Drive `fileId` in Firestore media doc (instead of GCS URL)
- [ ] Generate shareable links so band members can stream without needing their own copy

### 1.3 Migration & Cleanup
- [ ] Update `storage.ts` utility to use Drive API instead of GCS
- [ ] Update `LibraryPage` upload flow
- [ ] Update `DemoReview` to fetch from Drive URLs
- [ ] Remove GCS dependencies (`@google-cloud/storage`, storage bucket config)
- [ ] Update environment variables (remove GCS bucket, add Drive API key if needed)

### 1.4 Considerations
- Users must grant Drive permission on first upload (one-time consent screen)
- If uploader leaves the band, their files stay in their Drive (they own them)
- Band members stream via shared link — no duplicate storage
- 15GB free per Google account = plenty for demos

---

## Phase 2: Monetization (The Reaper Model)
**Goal:** Free to use forever, gentle nag to pay $5-10 lifetime.

### 2.1 Payment Integration
- [ ] Stripe Checkout integration (one-time payment, not subscription)
- [ ] Two tiers: Free (full features + nag) and Paid ($5-10 lifetime, nag removed)
- [ ] Store payment status in Firestore user doc (`paid: true`, `paidAt: timestamp`)
- [ ] Stripe webhook endpoint to update Firestore on successful payment

### 2.2 The Nag
- [ ] Subtle banner at bottom of app: "You're using BandHub for free! Support development for $5"
- [ ] Show on app launch (dismissable, comes back next session)
- [ ] Never block functionality — everything works the same paid or free
- [ ] After payment: banner gone forever, maybe a small "Supporter" badge on profile

### 2.3 Landing Page
- [ ] Simple landing page at root URL for non-authenticated users
- [ ] Hero section: "Your band's HQ" with screenshot
- [ ] Feature bullets: Demo review, timestamped comments, scheduling, chat
- [ ] "Get Started Free" button → Google sign-in
- [ ] "$5 lifetime" callout (not aggressive, just present)

---

## Phase 3: Beta Feedback & Polish
**Goal:** Get local bands using it, fix what breaks, add what they ask for.

### 3.1 Known Issues
- [ ] Offline storage persistence (IndexedDB blob approach not working reliably)
- [ ] Service worker caching sometimes serves stale versions
- [ ] Test on various mobile devices (Android Chrome, iOS Safari)

### 3.2 UX Improvements
- [ ] Loading skeletons instead of "Loading..." text
- [ ] Toast notifications for actions (file uploaded, comment posted, member approved)
- [ ] Drag-and-drop file upload
- [ ] Mobile-optimized waveform player controls
- [ ] Dark mode (the people will ask for it)

### 3.3 Features Beta Users Will Probably Request
- [ ] Setlist builder (drag-to-reorder songs for a gig)
- [ ] Version history for demos (v1, v2, v3 of the same song)
- [ ] Notation/tab attachments on song info
- [ ] Practice log / rehearsal notes
- [ ] Export stems or final mixes
- [ ] Integration with DAWs (Reaper project file links?)

---

## Phase 4: Growth (If It Takes Off)
- [ ] Custom band invite links (shareable URL instead of code)
- [ ] Public band profiles (optional — showcase your band)
- [ ] Gigging tools: setlist sharing, stage plot, input list
- [ ] Multi-band support improvements (quick switcher)
- [ ] Desktop app (Electron or Tauri wrapper)
- [ ] API for third-party integrations

---

## Technical Debt & Infrastructure
- [ ] Add unit tests (React Testing Library + Vitest)
- [ ] Add E2E tests (Playwright)
- [ ] CI/CD pipeline (GitHub Actions → Firebase deploy)
- [ ] Error tracking (Sentry)
- [ ] Analytics (simple, privacy-respecting — Plausible or similar)
- [ ] Rate limiting on Firestore writes
- [ ] Automated backups for Firestore data

---

## Architecture Notes

### Current Stack
```
React 18 + TypeScript + Vite (PWA)
├── Firebase Auth (Google sign-in)
├── Firestore (metadata, comments, chat, events)
├── Google Cloud Storage (media files) ← REPLACING WITH GOOGLE DRIVE
└── Firebase Hosting (static frontend)
```

### Target Stack (Post Phase 1)
```
React 18 + TypeScript + Vite (PWA)
├── Firebase Auth (Google sign-in + Drive scope)
├── Firestore (metadata, comments, chat, events)
├── Google Drive API (media files — user-owned storage)
├── Stripe (one-time payments)
└── Firebase Hosting (static frontend)
```

### Cost Structure (Target)
- **Firebase Auth**: Free (unlimited users)
- **Firestore**: Free tier covers ~50K reads/20K writes per day
- **Google Drive**: Free (users' own 15GB)
- **Firebase Hosting**: Free tier covers 10GB transfer/month
- **Stripe**: 2.9% + $0.30 per transaction
- **Total operational cost**: ~$0/month until significant scale
