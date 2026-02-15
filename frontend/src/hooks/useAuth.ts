import { useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  User,
} from "firebase/auth";
import { auth, DEMO_MODE } from "../firebase";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Use localStorage persistence to avoid sessionStorage issues
// (fixes "missing initial state" error in partitioned browsers / PWAs)
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

// Fake user for demo mode
const DEMO_USER = {
  uid: "demo-user",
  displayName: "Demo User",
  email: "demo@lmsbandhub.local",
  photoURL: null,
  getIdToken: async () => "demo-token",
} as unknown as User;

export function useAuth() {
  const [user, setUser] = useState<User | null>(DEMO_MODE ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (DEMO_MODE) {
      setUser(DEMO_USER);
      return;
    }
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      // "missing initial state" — clear stale auth state and retry once
      if (err?.code === "auth/missing-initial-state" || err?.message?.includes("missing initial state")) {
        // Clear any stale session data
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith("firebase:")) sessionStorage.removeItem(key);
        }
        await signInWithPopup(auth, googleProvider);
      } else {
        throw err;
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (DEMO_MODE) {
      setUser(DEMO_USER); // Can't really sign out in demo
      return;
    }
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    if (DEMO_MODE) return "demo-token";
    if (!auth?.currentUser) throw new Error("Not authenticated");
    return auth.currentUser.getIdToken();
  }, []);

  return { user, loading, signInWithGoogle, signOut, getToken };
}
