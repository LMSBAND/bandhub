import { useState, useEffect, useCallback } from "react";

const DB_NAME = "lms-offline";
const META_STORE = "saved-media";
const BLOB_STORE = "media-blobs";
const DB_VERSION = 2;

interface OfflineMeta {
  mediaId: string;
  bandId: string;
  name: string;
  type: string;
  size: number;
  savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "mediaId" });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllSaved(): Promise<OfflineMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveMeta(meta: OfflineMeta): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    store.put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteMeta(mediaId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    store.delete(mediaId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function saveBlob(mediaId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    const store = tx.objectStore(BLOB_STORE);
    store.put(blob, mediaId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(mediaId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const store = tx.objectStore(BLOB_STORE);
    const req = store.get(mediaId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlob(mediaId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    const store = tx.objectStore(BLOB_STORE);
    store.delete(mediaId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Check if a single media item is saved offline */
export async function isMediaOffline(mediaId: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const req = store.get(mediaId);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get a cached media URL (blob URL) if available */
export async function getOfflineUrl(mediaId: string): Promise<string | null> {
  const blob = await getBlob(mediaId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

const AUTO_OFFLINE_KEY = "lms-auto-offline";
const AUTO_OFFLINE_TYPES_KEY = "lms-auto-offline-types";
const ALL_MEDIA_TYPES = ["audio", "video", "image", "pdf", "other"] as const;

function loadOfflineTypes(): Set<string> {
  const raw = localStorage.getItem(AUTO_OFFLINE_TYPES_KEY);
  if (!raw) return new Set(ALL_MEDIA_TYPES);
  try { return new Set(JSON.parse(raw)); } catch { return new Set(ALL_MEDIA_TYPES); }
}

/** Hook: manage offline storage for the current view */
export function useOfflineStorage() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [autoOffline, setAutoOfflineState] = useState<boolean>(
    () => localStorage.getItem(AUTO_OFFLINE_KEY) === "1"
  );

  const [autoOfflineTypes, setAutoOfflineTypesState] = useState<Set<string>>(loadOfflineTypes);

  const setAutoOffline = useCallback((enabled: boolean) => {
    setAutoOfflineState(enabled);
    localStorage.setItem(AUTO_OFFLINE_KEY, enabled ? "1" : "0");
  }, []);

  const toggleOfflineType = useCallback((type: string) => {
    setAutoOfflineTypesState((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      localStorage.setItem(AUTO_OFFLINE_TYPES_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Load all saved media IDs from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    getAllSaved()
      .then((items) => {
        if (!cancelled) {
          setSavedIds(new Set(items.map((m) => m.mediaId)));
        }
      })
      .catch((err) => {
        console.warn("Failed to load offline saved items:", err);
      });
    return () => { cancelled = true; };
  }, []);

  const isSaved = useCallback(
    (mediaId: string) => savedIds.has(mediaId),
    [savedIds]
  );

  const saveOffline = useCallback(
    async (
      mediaId: string,
      urlOrBlob: string | Blob,
      meta: { bandId: string; name: string; type: string; size: number }
    ) => {
      setSaving(mediaId);
      try {
        let blob: Blob;
        if (urlOrBlob instanceof Blob) {
          blob = urlOrBlob;
        } else {
          const resp = await fetch(urlOrBlob);
          if (!resp.ok) throw new Error("Failed to fetch media");
          blob = await resp.blob();
        }

        await saveBlob(mediaId, blob);
        await saveMeta({
          mediaId,
          bandId: meta.bandId,
          name: meta.name,
          type: meta.type,
          size: meta.size || blob.size,
          savedAt: Date.now(),
        });

        setSavedIds((prev) => new Set([...prev, mediaId]));
      } finally {
        setSaving(null);
      }
    },
    []
  );

  const removeOffline = useCallback(async (mediaId: string) => {
    await deleteBlob(mediaId);
    await deleteMeta(mediaId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(mediaId);
      return next;
    });
  }, []);

  return { isSaved, saveOffline, removeOffline, saving, savedIds, autoOffline, setAutoOffline, autoOfflineTypes, toggleOfflineType };
}
