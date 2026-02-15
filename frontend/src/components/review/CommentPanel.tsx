import { useState } from "react";
import { CommentThread } from "./CommentThread";
import type { CommentMarkerData } from "./WaveformPlayer";
import styles from "./CommentPanel.module.css";

interface CommentPanelProps {
  comments: CommentMarkerData[];
  activeCommentId: string | null;
  onCommentClick: (id: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onReply: (commentId: string, text: string) => void;
  currentUserId: string;
  hideTimestamps?: boolean;
}

type Filter = "all" | "unresolved" | "mine";

export function CommentPanel({
  comments,
  activeCommentId,
  onCommentClick,
  onResolve,
  onDelete,
  onReply,
  currentUserId,
  hideTimestamps,
}: CommentPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = comments
    .filter((c) => {
      if (filter === "unresolved") return !c.resolved;
      if (filter === "mine") return c.authorUid === currentUserId;
      return true;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const label = hideTimestamps ? "Notes" : "Comments";
  const emptyHint = hideTimestamps
    ? "No notes yet. Click 'Add Note' to leave one!"
    : "No comments yet. Click the waveform to add one!";

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {label} ({comments.length})
        </h3>
        <div className={styles.filters}>
          {(["all", "unresolved", "mine"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${
                filter === f ? styles.active : ""
              }`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {comments.length === 0
              ? emptyHint
              : "No comments match this filter."}
          </div>
        ) : (
          filtered.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              isActive={c.id === activeCommentId}
              onClick={() => onCommentClick(c.id)}
              onResolve={(resolved) => onResolve(c.id, resolved)}
              onDelete={() => onDelete(c.id)}
              onReply={(text) => onReply(c.id, text)}
              isOwner={c.authorUid === currentUserId}
              hideTimestamp={hideTimestamps}
            />
          ))
        )}
      </div>
    </div>
  );
}
