import { useState } from "react";
import { fmtTime } from "../../utils/time";
import styles from "./CommentThread.module.css";

interface CommentData {
  id: string;
  timestamp: number;
  text: string;
  author: string;
  resolved: boolean;
  replies?: { author: string; text: string; createdAt: Date }[];
}

interface CommentThreadProps {
  comment: CommentData;
  isActive: boolean;
  onClick: () => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
  onReply: (text: string) => void;
  isOwner: boolean;
  hideTimestamp?: boolean;
}

export function CommentThread({
  comment,
  isActive,
  onClick,
  onResolve,
  onDelete,
  onReply,
  isOwner,
  hideTimestamp,
}: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(replyText.trim());
    setReplyText("");
    setShowReply(false);
  };

  return (
    <div
      className={`${styles.thread} ${isActive ? styles.active : ""} ${
        comment.resolved ? styles.resolved : ""
      }`}
      onClick={onClick}
    >
      <div className={styles.header}>
        {!hideTimestamp && (
          <span className={styles.timestamp}>{fmtTime(comment.timestamp)}</span>
        )}
        <span className={styles.author}>{comment.author}</span>
        {comment.resolved && <span className={styles.badge}>resolved</span>}
      </div>

      <p className={styles.text}>{comment.text}</p>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map((r, i) => (
            <div key={i} className={styles.reply}>
              <span className={styles.replyAuthor}>{r.author}</span>
              <span className={styles.replyText}>{r.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.actionBtn}
          onClick={(e) => {
            e.stopPropagation();
            onResolve(!comment.resolved);
          }}
        >
          {comment.resolved ? "Reopen" : "Resolve"}
        </button>
        <button
          className={styles.actionBtn}
          onClick={(e) => {
            e.stopPropagation();
            setShowReply(!showReply);
          }}
        >
          Reply
        </button>
        {isOwner && (
          <button
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        )}
      </div>

      {/* Reply input */}
      {showReply && (
        <div
          className={styles.replyForm}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitReply()}
            className={styles.replyInput}
            autoFocus
          />
          <button className="btn btn-primary" onClick={handleSubmitReply}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
