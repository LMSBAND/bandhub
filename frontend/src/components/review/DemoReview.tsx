import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";
import { useBand } from "../../hooks/useBand";
import { getMediaUrl } from "../../utils/storage";
import { WaveformPlayer, type CommentMarkerData } from "./WaveformPlayer";
import { CommentPanel } from "./CommentPanel";
import { AddCommentModal } from "./AddCommentModal";
import styles from "./DemoReview.module.css";

interface MediaDoc {
  name: string;
  type: string;
  duration?: number;
  peaks?: number[];
  gcsPath: string;
}

interface CommentDoc extends CommentMarkerData {
  authorUid: string;
  createdAt: Date;
  replies?: { author: string; text: string; createdAt: Date }[];
}

export function DemoReview() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const navigate = useNavigate();
  const { user, getToken } = useAuth();
  const { activeBand } = useBand(user?.uid);

  const [media, setMedia] = useState<MediaDoc | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [addCommentAt, setAddCommentAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const bandId = activeBand?.id;

  // Load media doc
  useEffect(() => {
    if (!bandId || !mediaId) return;

    const loadMedia = async () => {
      const docRef = doc(db, `bands/${bandId}/media/${mediaId}`);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        navigate("/library");
        return;
      }
      setMedia(snap.data() as MediaDoc);

      // Get signed audio URL
      const token = await getToken();
      const url = await getMediaUrl(bandId, mediaId, token);
      setAudioUrl(url);
      setLoading(false);
    };

    loadMedia();
  }, [bandId, mediaId, getToken, navigate]);

  // Real-time comments listener
  useEffect(() => {
    if (!bandId || !mediaId) return;

    const q = query(
      collection(db, `bands/${bandId}/media/${mediaId}/comments`),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const result: CommentDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CommentDoc, "id">),
      }));
      setComments(result);
    });

    return unsub;
  }, [bandId, mediaId]);

  const handleAddComment = useCallback(
    async (text: string) => {
      if (!bandId || !mediaId || !user || addCommentAt === null) return;

      await addDoc(
        collection(db, `bands/${bandId}/media/${mediaId}/comments`),
        {
          timestamp: addCommentAt,
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
      if (!bandId || !mediaId) return;
      await updateDoc(
        doc(db, `bands/${bandId}/media/${mediaId}/comments/${commentId}`),
        { resolved }
      );
    },
    [bandId, mediaId]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!bandId || !mediaId) return;
      await deleteDoc(
        doc(db, `bands/${bandId}/media/${mediaId}/comments/${commentId}`)
      );
    },
    [bandId, mediaId]
  );

  const handleReply = useCallback(
    async (commentId: string, text: string) => {
      if (!bandId || !mediaId || !user) return;

      // Add reply as subcollection doc
      await addDoc(
        collection(
          db,
          `bands/${bandId}/media/${mediaId}/comments/${commentId}/replies`
        ),
        {
          text,
          author: user.displayName ?? user.email ?? "Unknown",
          authorUid: user.uid,
          createdAt: serverTimestamp(),
        }
      );
    },
    [bandId, mediaId, user]
  );

  if (loading || !media || !audioUrl) {
    return (
      <div className={styles.loading}>Loading demo review...</div>
    );
  }

  return (
    <div className={styles.review}>
      <div className={styles.headerRow}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/library")}
        >
          Back to Library
        </button>
        <h2 className={styles.title}>{media.name}</h2>
      </div>

      <div className={styles.layout}>
        <div className={styles.playerSection}>
          <WaveformPlayer
            audioUrl={audioUrl}
            peaks={media.peaks}
            duration={media.duration}
            comments={comments}
            onWaveformClick={(ts) => setAddCommentAt(ts)}
            onCommentClick={setActiveCommentId}
            activeCommentId={activeCommentId}
          />
        </div>

        <div className={styles.commentsSection}>
          <CommentPanel
            comments={comments}
            activeCommentId={activeCommentId}
            onCommentClick={setActiveCommentId}
            onResolve={handleResolve}
            onDelete={handleDelete}
            onReply={handleReply}
            currentUserId={user?.uid ?? ""}
          />
        </div>
      </div>

      {addCommentAt !== null && (
        <AddCommentModal
          timestamp={addCommentAt}
          onSubmit={handleAddComment}
          onClose={() => setAddCommentAt(null)}
        />
      )}
    </div>
  );
}
