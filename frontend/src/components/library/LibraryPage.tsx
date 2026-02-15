import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";
import { useBand } from "../../hooks/useBand";
import { useOfflineStorage } from "../../hooks/useOfflineStorage";
import { uploadFile, ensureBandFolder, computePeaks, getMediaType, getMediaBlob, getPublicMediaBlob } from "../../utils/storage";
import { DriveApiError } from "../../utils/driveApi";
import { MediaCard } from "./MediaCard";
import { UploadModal } from "./UploadModal";
import styles from "./LibraryPage.module.css";

interface MediaItem {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  duration?: number;
  tags: string[];
  project?: string;
  uploadedBy: string;
  commentCount: number;
  driveFileId?: string;
}

const TYPE_FILTERS = ["all", "audio", "video", "image", "pdf", "other"];

export function LibraryPage() {
  const { user, googleAccessToken, refreshGoogleToken } = useAuth();
  const { activeBand } = useBand(user?.uid);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const navigate = useNavigate();
  const { isSaved, saveOffline } = useOfflineStorage();
  const autoOfflineRunRef = useRef<Set<string>>(new Set());

  const { data: media, loading } = useCollection<MediaItem>({
    path: activeBand ? `bands/${activeBand.id}/media` : "",
    constraints: [orderBy("uploadedAt", "desc")],
    enabled: !!activeBand,
  });

  // Bulk auto-offline: when library loads, download & cache matching files
  // Reads settings from localStorage directly (toggle lives in Sidebar, separate hook instance)
  useEffect(() => {
    if (loading || media.length === 0 || !activeBand) return;

    const autoOn = localStorage.getItem("lms-auto-offline") === "1";
    if (!autoOn) return;

    const typesRaw = localStorage.getItem("lms-auto-offline-types");
    const allowedTypes: Set<string> = typesRaw
      ? new Set(JSON.parse(typesRaw))
      : new Set(["audio", "video", "image", "pdf", "other"]);

    let cancelled = false;

    (async () => {
      const token = googleAccessToken ?? sessionStorage.getItem("google_access_token");
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

      for (const item of media) {
        if (cancelled) break;
        if (!item.driveFileId) continue;
        if (!allowedTypes.has(item.type)) continue;
        if (autoOfflineRunRef.current.has(item.id)) continue;

        autoOfflineRunRef.current.add(item.id);

        let blob: Blob | null = null;
        if (token) {
          try { blob = await getMediaBlob(token, item.driveFileId); } catch { /* token expired */ }
        }
        if (!blob && apiKey) {
          try { blob = await getPublicMediaBlob(apiKey, item.driveFileId); } catch { /* skip */ }
        }
        if (blob && !cancelled) {
          try {
            await saveOffline(item.id, blob, {
              bandId: activeBand.id,
              name: item.name,
              type: item.type,
              size: item.size || blob.size,
            });
          } catch (err) {
            console.warn("Auto-offline save failed for", item.name, err);
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [media, loading, activeBand, googleAccessToken, saveOffline]);

  const filtered = media.filter((m) => {
    if (filter !== "all" && m.type !== filter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!activeBand || !user || !db) return;

      // Get (or refresh) the Google OAuth access token for Drive API
      let token = googleAccessToken;
      if (!token) {
        token = await refreshGoogleToken();
      }

      // Ensure BandHub/{BandName}/ folder exists in user's Drive
      const folderId = await ensureBandFolder(token, activeBand.name);

      for (const file of files) {
        try {
          setUploadProgress(0);

          const mediaRef = doc(collection(db, `bands/${activeBand.id}/media`));
          const mediaType = getMediaType(file.type);

          // Upload to user's Google Drive
          let driveFile;
          try {
            driveFile = await uploadFile(
              token,
              folderId,
              file,
              (pct) => setUploadProgress(pct * 0.8) // 80% for upload
            );
          } catch (err) {
            // Token expired — refresh and retry
            if (err instanceof DriveApiError && err.status === 401) {
              token = await refreshGoogleToken();
              driveFile = await uploadFile(
                token,
                folderId,
                file,
                (pct) => setUploadProgress(pct * 0.8)
              );
            } else {
              throw err;
            }
          }

          // Compute peaks for audio files
          let peaks: number[] | undefined;
          let duration: number | undefined;
          if (mediaType === "audio") {
            setUploadProgress(85);
            const peakData = await computePeaks(file);
            peaks = peakData.peaks;
            duration = peakData.duration;
          }

          setUploadProgress(95);

          // Write metadata to Firestore
          await setDoc(mediaRef, {
            name: file.name,
            type: mediaType,
            mimeType: file.type,
            driveFileId: driveFile.id,
            size: file.size,
            ...(duration !== undefined && { duration }),
            ...(peaks && { peaks }),
            tags: [],
            uploadedBy: user.uid,
            uploadedAt: serverTimestamp(),
            commentCount: 0,
          });

          setUploadProgress(100);
        } catch (err) {
          console.error("Upload failed:", err);
          alert(`Upload failed for ${file.name}: ${(err as Error).message}`);
        }
      }

      setUploadProgress(null);
      setShowUpload(false);
    },
    [activeBand, user, googleAccessToken, refreshGoogleToken]
  );

  const handleMediaClick = (item: MediaItem) => {
    navigate(`/library/${item.id}/review`);
  };

  if (!activeBand) {
    return <div>Select a band to view the library.</div>;
  }

  return (
    <div className={styles.library}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              className={`${styles.filterBtn} ${
                filter === t ? styles.active : ""
              }`}
              onClick={() => setFilter(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <button
            className="btn btn-primary"
            onClick={() => setShowUpload(true)}
          >
            Upload
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading media...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {media.length === 0
            ? "No files yet. Upload some demos!"
            : "No files match your filter."}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onClick={() => handleMediaClick(item)}
              isOffline={isSaved(item.id)}
              uploaderName={item.uploadedBy && activeBand?.members[item.uploadedBy]?.displayName}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
          progress={uploadProgress}
        />
      )}
    </div>
  );
}
