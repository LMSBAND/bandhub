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
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.setCustomParameters({ prompt: "select_account" });

// Use localStorage persistence so auth survives tab closes / PWA restarts
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
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(
    () => sessionStorage.getItem("google_access_token")
  );

  useEffect(() => {
    if (DEMO_MODE || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const saveToken = useCallback((token: string) => {
    setGoogleAccessToken(token);
    sessionStorage.setItem("google_access_token", token);
  }, []);

  const doPopupSignIn = useCallback(async () => {
    if (!auth) return;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      saveToken(credential.accessToken);
    }
  }, [saveToken]);

  const signInWithGoogle = useCallback(async () => {
    if (DEMO_MODE) {
      setUser(DEMO_USER);
      return;
    }
    if (!auth) return;

    try {
      await doPopupSignIn();
    } catch (err: any) {
      // "missing initial state" — clear stale Firebase data and retry once
      if (
        err?.code === "auth/missing-initial-state" ||
        err?.message?.includes("missing initial state")
      ) {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith("firebase:")) sessionStorage.removeItem(key);
        }
        await doPopupSignIn();
      } else if (err?.code !== "auth/popup-closed-by-user") {
        throw err;
      }
    }
  }, [doPopupSignIn]);

  const signOut = useCallback(async () => {
    if (DEMO_MODE) {
      setUser(DEMO_USER);
      return;
    }
    if (!auth) return;
    sessionStorage.removeItem("google_access_token");
    setGoogleAccessToken(null);
    await firebaseSignOut(auth);
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    if (DEMO_MODE) return "demo-token";
    if (!auth?.currentUser) throw new Error("Not authenticated");
    return auth.currentUser.getIdToken();
  }, []);

  // Re-auth to get a fresh Google OAuth access token (needed when token expires ~1hr)
  const refreshGoogleToken = useCallback(async (): Promise<string> => {
    if (DEMO_MODE) return "demo-token";
    if (!auth) throw new Error("Auth not initialized");

    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    if (!token) throw new Error("Failed to get Google access token");
    saveToken(token);
    return token;
  }, [saveToken]);

  return { user, loading, signInWithGoogle, signOut, getToken, googleAccessToken, refreshGoogleToken };
}
