import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";
import { useBand } from "../../hooks/useBand";
import { uploadMedia } from "../../utils/storage";
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
  const { user, getToken } = useAuth();
  const { activeBand } = useBand(user?.uid);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const navigate = useNavigate();

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
      if (!activeBand) return;
      for (const file of files) {
        setUploadProgress(0);
        const token = await getToken();
        await uploadMedia(activeBand.id, file, token, setUploadProgress);
      }
      setUploadProgress(null);
      setShowUpload(false);
    },
    [activeBand, getToken]
  );

  const handleMediaClick = (item: MediaItem) => {
    if (item.type === "audio" || item.type === "video") {
      navigate(`/library/${item.id}/review`);
    }
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
