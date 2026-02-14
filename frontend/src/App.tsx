import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useBand } from "./hooks/useBand";
import { LoginPage } from "./components/auth/LoginPage";
import { BandSetup } from "./components/auth/BandSetup";
import { Shell } from "./components/layout/Shell";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { LibraryPage } from "./components/library/LibraryPage";
import { DemoReview } from "./components/review/DemoReview";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

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

  // No bands yet - show setup
  if (bands.length === 0) {
    return (
      <BandSetup
        onCreateBand={async (name) => {
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
        }}
        onJoinBand={async (code) => {
          const q = query(
            collection(db, "bands"),
            where("inviteCode", "==", code.toUpperCase())
          );
          const snap = await getDocs(q);
          if (snap.empty) throw new Error("Invalid invite code");
          const bandDoc = snap.docs[0];
          await updateDoc(bandDoc.ref, {
            [`members.${user.uid}`]: {
              role: "member",
              displayName: user.displayName ?? user.email ?? "Unknown",
              joinedAt: serverTimestamp(),
            },
          });
          selectBand(bandDoc.id);
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Shell
              user={user}
              bands={bands}
              activeBand={activeBand}
              onSelectBand={selectBand}
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
          <Route path="/calendar" element={<DashboardPage />} />
          <Route path="/chat" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
