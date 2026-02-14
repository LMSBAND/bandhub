import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

export interface BandMember {
  role: "admin" | "member";
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

export function useBand(userId: string | undefined) {
  const [bands, setBands] = useState<Band[]>([]);
  const [activeBandId, setActiveBandId] = useState<string | null>(
    () => localStorage.getItem(BAND_STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  // Listen to all bands the user is a member of
  useEffect(() => {
    if (!userId) {
      setBands([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "bands"),
      where(`members.${userId}.role`, "in", ["admin", "member"])
    );

    const unsub = onSnapshot(q, (snap) => {
      const result: Band[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Band[];
      setBands(result);
      setLoading(false);

      // Auto-select first band if none active
      if (!activeBandId && result.length > 0) {
        setActiveBandId(result[0].id);
      }
    });

    return unsub;
  }, [userId, activeBandId]);

  const selectBand = useCallback((bandId: string) => {
    setActiveBandId(bandId);
    localStorage.setItem(BAND_STORAGE_KEY, bandId);
  }, []);

  const activeBand = bands.find((b) => b.id === activeBandId) ?? null;

  return { bands, activeBand, activeBandId, selectBand, loading };
}
