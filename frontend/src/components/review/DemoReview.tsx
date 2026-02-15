import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db, DEMO_MODE } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";
import { useBand } from "../../hooks/useBand";
import { useOfflineStorage, getOfflineUrl, isMediaOffline } from "../../hooks/useOfflineStorage";
import { getMediaBlob, getPublicMediaBlob, getDirectDriveUrl } from "../../utils/storage";
import { WaveformPlayer, type CommentMarkerData } from "./WaveformPlayer";
import { CommentPanel } from "./CommentPanel";
import { AddCommentModal } from "./AddCommentModal";
import styles from "./DemoReview.module.css";

interface SongPart {
  name: string;
  hasLyrics: boolean;
  needsWork: boolean;
}

interface SongInfo {
  bpm?: number;
  key?: string;
  parts?: SongPart[];
}

interface MediaDoc {
  name: string;
  type: string;
  mimeType?: string;
  duration?: number;
  peaks?: number[];
  driveFileId?: string;
  gcsPath?: string;       // migration fallback for old uploads
  downloadUrl?: string;   // migration fallback for old uploads
  lyrics?: string;
  uploadedBy?: string;
  songInfo?: SongInfo;
}

interface CommentDoc extends CommentMarkerData {
  createdAt: Date;
}

export function DemoReview() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const navigate = useNavigate();
  const { user, googleAccessToken } = useAuth();
  const { activeBand } = useBand(user?.uid);

  const [media, setMedia] = useState<MediaDoc | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [addCommentAt, setAddCommentAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lyrics, setLyrics] = useState("");
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [songInfoOpen, setSongInfoOpen] = useState(false);
  const [editingSongInfo, setEditingSongInfo] = useState(false);
  const [songInfo, setSongInfo] = useState<SongInfo>({});
  const [seekTimestamp, setSeekTimestamp] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isSaved, saveOffline, removeOffline, saving } = useOfflineStorage();

  const bandId = activeBand?.id;
  const isAudio = media?.type === "audio";
  const isVideo = media?.type === "video";
  const isImage = media?.type === "image";
  const isPdf = media?.type === "pdf";

  // Load media doc
  useEffect(() => {
    if (!bandId || !mediaId || !db) {
      if (DEMO_MODE) setLoading(false);
      return;
    }

    const loadMedia = async () => {
      const docRef = doc(db!, `bands/${bandId}/media/${mediaId}`);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        navigate("/library");
        return;
      }
      const data = snap.data() as MediaDoc;
      setMedia(data);
      setLyrics(data.lyrics ?? "");
      setSongInfo(data.songInfo ?? {});

      // Try offline cache first
      const offlineUrl = await getOfflineUrl(mediaId);
      if (offlineUrl) {
        setMediaUrl(offlineUrl);
      } else if (data.driveFileId) {
        // Try cached OAuth token first, then API key, then direct URL
        let blob: Blob | null = null;
        const cachedToken = googleAccessToken ?? sessionStorage.getItem("google_access_token");
        if (cachedToken) {
          try {
            blob = await getMediaBlob(cachedToken, data.driveFileId);
          } catch {
            // Token expired or invalid — fall through
          }
        }
        if (!blob) {
          try {
            const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
            blob = await getPublicMediaBlob(apiKey, data.driveFileId);
          } catch {
            // API key failed — fall through to direct URL
          }
        }
        if (blob) {
          setMediaUrl(URL.createObjectURL(blob));
          // Auto-save for offline if enabled
          const autoOn = localStorage.getItem("lms-auto-offline") === "1";
          const typesRaw = localStorage.getItem("lms-auto-offline-types");
          const allowedTypes = typesRaw ? new Set(JSON.parse(typesRaw)) : new Set(["audio", "video", "image", "pdf", "other"]);
          if (autoOn && allowedTypes.has(data.type) && !(await isMediaOffline(mediaId))) {
            saveOffline(mediaId, blob, {
              bandId: bandId!,
              name: data.name,
              type: data.type,
              size: blob.size,
            }).catch(console.warn);
          }
        } else {
          setMediaUrl(getDirectDriveUrl(data.driveFileId));
        }
      } else if (data.downloadUrl) {
        // Migration fallback: old uploads stored in Firebase Storage
        setMediaUrl(data.downloadUrl);
      }
      setLoading(false);
    };

    loadMedia().catch((err) => {
      console.error("Failed to load media:", err);
      setLoading(false);
    });
  }, [bandId, mediaId, navigate, googleAccessToken, saveOffline]);

  // Real-time comments listener
  useEffect(() => {
    if (!bandId || !mediaId || !db) return;

    const q = query(
      collection(db, `bands/${bandId}/media/${mediaId}/comments`),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const result: CommentDoc[] = await Promise.all(
        snap.docs.map(async (d) => {
          const data = { id: d.id, ...(d.data() as Omit<CommentDoc, "id">) };
          const repliesQ = query(
            collection(db!, `bands/${bandId}/media/${mediaId}/comments/${d.id}/replies`),
            orderBy("createdAt", "asc")
          );
          const repliesSnap = await getDocs(repliesQ);
          const replies = repliesSnap.docs.map((r) => r.data() as { author: string; text: string; createdAt: Date });
          return { ...data, replies };
        })
      );
      setComments(result);
    });

    return unsub;
  }, [bandId, mediaId]);

  const handleAddComment = useCallback(
    async (text: string) => {
      if (!bandId || !mediaId || !user || !db) return;

      await addDoc(
        collection(db, `bands/${bandId}/media/${mediaId}/comments`),
        {
          timestamp: addCommentAt ?? 0,
          text,
          author: user.displayName ?? user.email ?? "Unknown",
          authorUid: user.uid,
          createdAt: serverTimestamp(),
          resolved: false,
        }
      );

      setAddCommentAt(null);
    },
    [bandId, mediaId, user, addCommentAt]
  );

  const handleResolve = useCallback(
    async (commentId: string, resolved: boolean) => {
      if (!bandId || !mediaId || !db) return;
      await updateDoc(
        doc(db, `bands/${bandId}/media/${mediaId}/comments/${commentId}`),
        { resolved }
      );
    },
    [bandId, mediaId]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!bandId || !mediaId || !db) return;
      await deleteDoc(
        doc(db, `bands/${bandId}/media/${mediaId}/comments/${commentId}`)
      );
    },
    [bandId, mediaId]
  );

  const handleReply = useCallback(
    async (commentId: string, text: string) => {
      if (!bandId || !mediaId || !user || !db) return;

      const authorName = user.displayName ?? user.email ?? "Unknown";

      await addDoc(
        collection(
          db,
          `bands/${bandId}/media/${mediaId}/comments/${commentId}/replies`
        ),
        {
          text,
          author: authorName,
          authorUid: user.uid,
          createdAt: serverTimestamp(),
        }
      );

      // Optimistically add reply to local state so it shows immediately
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, replies: [...(c.replies ?? []), { author: authorName, text, createdAt: new Date() }] }
            : c
        )
      );
    },
    [bandId, mediaId, user]
  );

  const handleSaveLyrics = useCallback(async () => {
    if (!bandId || !mediaId || !db) return;
    await updateDoc(doc(db, `bands/${bandId}/media/${mediaId}`), { lyrics });
    setMedia((prev) => prev ? { ...prev, lyrics } : prev);
    setEditingLyrics(false);
  }, [bandId, mediaId, lyrics]);

  const handleSaveSongInfo = useCallback(async () => {
    if (!bandId || !mediaId || !db) return;
    await updateDoc(doc(db, `bands/${bandId}/media/${mediaId}`), { songInfo });
    setMedia((prev) => prev ? { ...prev, songInfo } : prev);
    setEditingSongInfo(false);
  }, [bandId, mediaId, songInfo]);

  const handleAddPart = useCallback(() => {
    setSongInfo((prev) => ({
      ...prev,
      parts: [...(prev.parts ?? []), { name: "", hasLyrics: false, needsWork: true }],
    }));
  }, []);

  const handleUpdatePart = useCallback((index: number, updates: Partial<SongPart>) => {
    setSongInfo((prev) => ({
      ...prev,
      parts: (prev.parts ?? []).map((p, i) => i === index ? { ...p, ...updates } : p),
    }));
  }, []);

  const handleRemovePart = useCallback((index: number) => {
    setSongInfo((prev) => ({
      ...prev,
      parts: (prev.parts ?? []).filter((_, i) => i !== index),
    }));
  }, []);

  const handleCommentClick = useCallback((commentId: string) => {
    setActiveCommentId(commentId);
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    if (isAudio) {
      // Use a unique value each time to trigger the effect even if same timestamp
      setSeekTimestamp(comment.timestamp + Math.random() * 0.001);
    } else if (isVideo && videoRef.current) {
      videoRef.current.currentTime = comment.timestamp;
    }
  }, [comments, isAudio, isVideo]);

  const isUploader = user?.uid === media?.uploadedBy;

  if (DEMO_MODE) {
    return (
      <div className={styles.review}>
        <div className={styles.headerRow}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/library")}
          >
            Back to art
          </button>
          <h2 className={styles.title}>Demo Review (connect Firebase to use)</h2>
        </div>
        <div className={styles.loading}>
          Connect Firebase to upload and review demos with timestamped comments.
        </div>
      </div>
    );
  }

  if (loading || !media || !mediaUrl) {
    return (
      <div className={styles.loading}>Loading...</div>
    );
  }

  return (
    <div className={styles.review}>
      <div className={styles.headerRow}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/library")}
        >
          Back to art
        </button>
        <h2 className={styles.title}>{media.name}</h2>
        <div className={styles.headerActions}>
          {mediaId && bandId && mediaUrl && (
            isSaved(mediaId) ? (
              <button
                className={styles.offlineBtn}
                onClick={() => removeOffline(mediaId)}
                title="Remove offline copy"
              >
                Saved Offline
              </button>
            ) : (
              <button
                className={styles.saveOfflineBtn}
                onClick={() =>
                  saveOffline(mediaId, mediaUrl, {
                    bandId,
                    name: media.name,
                    type: media.type,
                    size: 0,
                  })
                }
                disabled={saving === mediaId}
                title="Save for offline playback"
              >
                {saving === mediaId ? "Saving..." : "Save Offline"}
              </button>
            )
          )}
          {!isAudio && !isVideo && (
            <button
              className="btn btn-primary"
              onClick={() => setAddCommentAt(0)}
            >
              Add Note
            </button>
          )}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.playerSection}>
          {isAudio && (
            <WaveformPlayer
              audioUrl={mediaUrl}
              peaks={media.peaks}
              duration={media.duration}
              comments={comments}
              onAddComment={(ts) => setAddCommentAt(ts)}
              onCommentClick={handleCommentClick}
              activeCommentId={activeCommentId}
              seekToTimestamp={seekTimestamp}
            />
          )}

          {isVideo && (
            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                src={mediaUrl}
                controls
                className={styles.videoPreview}
              />
              <div className={styles.videoControls}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const t = videoRef.current?.currentTime ?? 0;
                    setAddCommentAt(t);
                  }}
                  title="Add comment at current video position"
                >
                  Comment at Current Time
                </button>
              </div>
            </div>
          )}

          {isImage && (
            <div className={styles.imageContainer}>
              <img
                src={mediaUrl}
                alt={media.name}
                className={styles.imagePreview}
              />
            </div>
          )}

          {isPdf && (
            <iframe
              src={mediaUrl}
              title={media.name}
              className={styles.pdfPreview}
            />
          )}

          {!isAudio && !isVideo && !isImage && !isPdf && (
            <div className={styles.genericPreview}>
              <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Download {media.name}
              </a>
            </div>
          )}
        </div>

        {/* Song Info section (audio/video only) */}
        {(isAudio || isVideo) && (
          <div className={styles.infoSection}>
            <div className={styles.infoHeader}>
              <button
                className={styles.lyricsToggle}
                onClick={() => setSongInfoOpen(!songInfoOpen)}
              >
                Song Info {songInfoOpen ? "\u25B2" : "\u25BC"}
              </button>
              {isUploader && songInfoOpen && !editingSongInfo && (
                <button
                  className={styles.lyricsEditBtn}
                  onClick={() => setEditingSongInfo(true)}
                >
                  Edit
                </button>
              )}
            </div>
            {songInfoOpen && (
              editingSongInfo ? (
                <div className={styles.infoEdit}>
                  <div className={styles.infoRow}>
                    <label className={styles.infoLabel}>BPM</label>
                    <input
                      type="number"
                      className={styles.infoInput}
                      value={songInfo.bpm ?? ""}
                      onChange={(e) => setSongInfo((prev) => ({ ...prev, bpm: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="e.g. 120"
                    />
                  </div>
                  <div className={styles.infoRow}>
                    <label className={styles.infoLabel}>Key</label>
                    <input
                      type="text"
                      className={styles.infoInput}
                      value={songInfo.key ?? ""}
                      onChange={(e) => setSongInfo((prev) => ({ ...prev, key: e.target.value || undefined }))}
                      placeholder="e.g. Am, C Major"
                    />
                  </div>
                  <div className={styles.partsHeader}>
                    <label className={styles.infoLabel}>Parts</label>
                    <button className={styles.addPartBtn} onClick={handleAddPart}>+ Add Part</button>
                  </div>
                  {(songInfo.parts ?? []).map((part, i) => (
                    <div key={i} className={styles.partRow}>
                      <input
                        type="text"
                        className={styles.partNameInput}
                        value={part.name}
                        onChange={(e) => handleUpdatePart(i, { name: e.target.value })}
                        placeholder="e.g. Verse 1, Chorus, Bridge"
                      />
                      <label className={styles.partCheck}>
                        <input
                          type="checkbox"
                          checked={part.hasLyrics}
                          onChange={(e) => handleUpdatePart(i, { hasLyrics: e.target.checked })}
                        />
                        Has lyrics
                      </label>
                      <label className={styles.partCheck}>
                        <input
                          type="checkbox"
                          checked={part.needsWork}
                          onChange={(e) => handleUpdatePart(i, { needsWork: e.target.checked })}
                        />
                        Needs work
                      </label>
                      <button className={styles.removePartBtn} onClick={() => handleRemovePart(i)}>&times;</button>
                    </div>
                  ))}
                  <div className={styles.lyricsActions}>
                    <button className="btn btn-secondary" onClick={() => { setSongInfo(media.songInfo ?? {}); setEditingSongInfo(false); }}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveSongInfo}>
                      Save Info
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.infoBody}>
                  {songInfo.bpm && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoItemLabel}>BPM</span>
                      <span className={styles.infoItemValue}>{songInfo.bpm}</span>
                    </div>
                  )}
                  {songInfo.key && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoItemLabel}>Key</span>
                      <span className={styles.infoItemValue}>{songInfo.key}</span>
                    </div>
                  )}
                  {(songInfo.parts ?? []).length > 0 ? (
                    <div className={styles.partsGrid}>
                      {songInfo.parts!.map((part, i) => (
                        <div key={i} className={styles.partCard}>
                          <span className={styles.partName}>{part.name || "Untitled"}</span>
                          <div className={styles.partBadges}>
                            {part.hasLyrics && <span className={styles.badgeLyrics}>Lyrics</span>}
                            {part.needsWork && <span className={styles.badgeNeedsWork}>Needs Work</span>}
                            {!part.needsWork && !part.hasLyrics && <span className={styles.badgeDone}>Done</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !songInfo.bpm && !songInfo.key ? (
                    <p className={styles.lyricsEmpty}>
                      {isUploader ? "No song info yet. Click Edit to add BPM, key, and parts." : "No song info added yet."}
                    </p>
                  ) : null}
                </div>
              )
            )}
          </div>
        )}

        {/* Lyrics section (audio/video only) */}
        {(isAudio || isVideo) && (
          <div className={styles.lyricsSection}>
            <div className={styles.lyricsHeader}>
              <button
                className={styles.lyricsToggle}
                onClick={() => setLyricsOpen(!lyricsOpen)}
              >
                Lyrics {lyricsOpen ? "\u25B2" : "\u25BC"}
              </button>
              {isUploader && lyricsOpen && !editingLyrics && (
                <button
                  className={styles.lyricsEditBtn}
                  onClick={() => setEditingLyrics(true)}
                >
                  Edit
                </button>
              )}
            </div>
            {lyricsOpen && (
              editingLyrics ? (
                <div className={styles.lyricsEdit}>
                  <textarea
                    className={styles.lyricsTextarea}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="Paste or type lyrics here..."
                    rows={10}
                  />
                  <div className={styles.lyricsActions}>
                    <button className="btn btn-secondary" onClick={() => { setLyrics(media.lyrics ?? ""); setEditingLyrics(false); }}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveLyrics}>
                      Save Lyrics
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.lyricsBody}>
                  {lyrics ? (
                    <pre className={styles.lyricsText}>{lyrics}</pre>
                  ) : (
                    <p className={styles.lyricsEmpty}>
                      {isUploader ? "No lyrics yet. Click Edit to add them." : "No lyrics added yet."}
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        )}

        <div className={styles.commentsSection}>
          <CommentPanel
            comments={comments}
            activeCommentId={activeCommentId}
            onCommentClick={handleCommentClick}
            onResolve={handleResolve}
            onDelete={handleDelete}
            onReply={handleReply}
            currentUserId={user?.uid ?? ""}
            hideTimestamps={!(isAudio || isVideo)}
          />
        </div>
      </div>

      {addCommentAt !== null && (
        <AddCommentModal
          timestamp={addCommentAt}
          onSubmit={handleAddComment}
          onClose={() => setAddCommentAt(null)}
          hideTimestamp={!(isAudio || isVideo)}
        />
      )}
    </div>
  );
}
