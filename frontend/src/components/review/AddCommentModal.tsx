import { useState } from "react";
import { fmtTime } from "../../utils/time";
import styles from "./AddCommentModal.module.css";

interface AddCommentModalProps {
  timestamp: number;
  onSubmit: (text: string) => void;
  onClose: () => void;
  hideTimestamp?: boolean;
}

export function AddCommentModal({
  timestamp,
  onSubmit,
  onClose,
  hideTimestamp,
}: AddCommentModalProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {hideTimestamp ? (
          <div className={styles.header}>
            <span className={styles.label}>Add a note</span>
          </div>
        ) : (
          <div className={styles.header}>
            <span className={styles.label}>Comment at</span>
            <span className={styles.timestamp}>{fmtTime(timestamp)}</span>
          </div>
        )}
        <textarea
          className={styles.textarea}
          placeholder={hideTimestamp
            ? "Leave a note for the band..."
            : "What do you hear? Drop a note for the band..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          autoFocus
          rows={3}
        />
        <div className={styles.actions}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            {hideTimestamp ? "Add Note" : "Add Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
