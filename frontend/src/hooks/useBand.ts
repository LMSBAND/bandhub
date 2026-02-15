import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, DEMO_MODE } from "../firebase";

export interface BandMember {
  role: "admin" | "member" | "pending";
  displayName: string;
  joinedAt: Date;
}

export interface Band {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  members: Record<string, BandMember>;
}

const BAND_STORAGE_KEY = "lms-bandhub-active-band";

// Demo band for offline preview
const DEMO_BAND: Band = {
  id: "demo-band",
  name: "LMS",
  createdBy: "demo-user",
  inviteCode: "DEMO42",
  members: {
    "demo-user": {
      role: "admin",
      displayName: "Demo User",
      joinedAt: new Date(),
    },
  },
};

export function useBand(userId: string | undefined) {
  const [bands, setBands] = useState<Band[]>(DEMO_MODE ? [DEMO_BAND] : []);
  const [activeBandId, setActiveBandId] = useState<string | null>(
    () => DEMO_MODE ? "demo-band" : localStorage.getItem(BAND_STORAGE_KEY)
  );
  const [loading, setLoading] = useState(!DEMO_MODE);

  // Listen to all bands the user is a member of
  useEffect(() => {
    if (DEMO_MODE || !db || !userId) {
      if (!userId) {
        setBands(DEMO_MODE ? [DEMO_BAND] : []);
        setLoading(false);
      }
      return;
    }

    const q = query(
      collection(db, "bands"),
      where(`members.${userId}.role`, "in", ["admin", "member", "pending"])
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const result: Band[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Band[];
        setBands(result);
        setLoading(false);

        // Auto-select first band if none active
        setActiveBandId((prev) => {
          if (!prev && result.length > 0) return result[0].id;
          return prev;
        });
      },
      (err) => {
        console.error("useBand onSnapshot error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [userId]);

  const selectBand = useCallback((bandId: string) => {
    setActiveBandId(bandId);
    localStorage.setItem(BAND_STORAGE_KEY, bandId);
  }, []);

  const activeBand = bands.find((b) => b.id === activeBandId) ?? null;

  return { bands, activeBand, activeBandId, selectBand, loading };
}
