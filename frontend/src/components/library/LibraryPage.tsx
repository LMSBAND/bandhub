import { useState, useCallback } from "react";
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
import { uploadFile, computePeaks, getMediaType } from "../../utils/storage";
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
}

const TYPE_FILTERS = ["all", "audio", "video", "image", "pdf", "other"];

export function LibraryPage() {
  const { user } = useAuth();
  const { activeBand } = useBand(user?.uid);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const navigate = useNavigate();
  const { isSaved } = useOfflineStorage();

  const { data: media, loading } = useCollection<MediaItem>({
    path: activeBand ? `bands/${activeBand.id}/media` : "",
    constraints: [orderBy("uploadedAt", "desc")],
    enabled: !!activeBand,
  });

  const filtered = media.filter((m) => {
    if (filter !== "all" && m.type !== filter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!activeBand || !user || !db) return;

      for (const file of files) {
        try {
          setUploadProgress(0);

          // Create Firestore doc ref to get the ID
          const mediaRef = doc(collection(db, `bands/${activeBand.id}/media`));
          const mediaId = mediaRef.id;
          const mediaType = getMediaType(file.type);

          // Upload to Firebase Storage
          const downloadUrl = await uploadFile(
            activeBand.id,
            mediaId,
            file,
            (pct) => setUploadProgress(pct * 0.8) // 80% for upload
          );

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
            gcsPath: `bands/${activeBand.id}/media/${mediaId}/${file.name}`,
            downloadUrl,
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
    [activeBand, user]
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
