import { useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useBand } from "./hooks/useBand";
import { LoginPage } from "./components/auth/LoginPage";
import { BandSetup } from "./components/auth/BandSetup";
import { Shell } from "./components/layout/Shell";
import { LibraryPage } from "./components/library/LibraryPage";
import { DemoReview } from "./components/review/DemoReview";
import { CalendarPage } from "./components/calendar/CalendarPage";
import { ChatPage } from "./components/chat/ChatPage";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { db, DEMO_MODE } from "./firebase";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function App() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const {
    bands,
    activeBand,
    selectBand,
    loading: bandsLoading,
  } = useBand(user?.uid);

  const handleCreateBand = useCallback(
    async (name: string) => {
      if (!db || !user) return;
      const bandRef = doc(collection(db, "bands"));
      await setDoc(bandRef, {
        name,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        inviteCode: generateInviteCode(),
        members: {
          [user.uid]: {
            role: "admin",
            displayName: user.displayName ?? user.email ?? "Unknown",
            joinedAt: serverTimestamp(),
          },
        },
      });
      selectBand(bandRef.id);
    },
    [user, selectBand]
  );

  const handleJoinBand = useCallback(
    async (code: string) => {
      if (!db || !user) return;
      const q = query(
        collection(db, "bands"),
        where("inviteCode", "==", code.toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) throw new Error("Invalid invite code");
      const bandDoc = snap.docs[0];
      const bandData = bandDoc.data();
      // Check if already a member
      if (bandData.members?.[user.uid]) {
        selectBand(bandDoc.id);
        return;
      }
      await updateDoc(bandDoc.ref, {
        [`members.${user.uid}`]: {
          role: "pending",
          displayName: user.displayName ?? user.email ?? "Unknown",
          joinedAt: serverTimestamp(),
        },
      });
      selectBand(bandDoc.id);
    },
    [user, selectBand]
  );

  const handleApproveMember = useCallback(
    async (bandId: string, uid: string) => {
      if (!db) return;
      await updateDoc(doc(db, "bands", bandId), {
        [`members.${uid}.role`]: "member",
      });
    },
    []
  );

  const handleRejectMember = useCallback(
    async (bandId: string, uid: string) => {
      if (!db) return;
      await updateDoc(doc(db, "bands", bandId), {
        [`members.${uid}`]: deleteField(),
      });
    },
    []
  );

  const handleKickMember = useCallback(
    async (bandId: string, uid: string) => {
      if (!db) return;
      await updateDoc(doc(db, "bands", bandId), {
        [`members.${uid}`]: deleteField(),
      });
    },
    []
  );

  if (loading || bandsLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--color-text-secondary)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onGoogleSignIn={signInWithGoogle} />;
  }

  // No bands yet - show setup (skip in demo mode, we have a fake band)
  if (bands.length === 0 && !DEMO_MODE) {
    return (
      <BandSetup
        onCreateBand={handleCreateBand}
        onJoinBand={handleJoinBand}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Shell
              key={activeBand?.id}
              user={user}
              bands={bands}
              activeBand={activeBand}
              onSelectBand={selectBand}
              onCreateBand={handleCreateBand}
              onJoinBand={handleJoinBand}
              onApproveMember={handleApproveMember}
              onRejectMember={handleRejectMember}
              onKickMember={handleKickMember}
              onSignOut={signOut}
            />
          }
        >
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route
            path="/library/:mediaId/review"
            element={<DemoReview />}
          />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
