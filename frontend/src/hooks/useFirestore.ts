import { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  QueryConstraint,
  DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";

interface UseCollectionOptions {
  path: string;
  constraints?: QueryConstraint[];
  enabled?: boolean;
}

export function useCollection<T extends DocumentData>({
  path,
  constraints = [],
  enabled = true,
}: UseCollectionOptions) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !path) {
      setData([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, path), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const result = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as T),
        }));
        setData(result);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  }, [path, enabled]);

  return { data, loading, error };
}
