import { useState, useRef, type DragEvent } from "react";
import styles from "./UploadModal.module.css";

interface UploadModalProps {
  onUpload: (files: File[]) => Promise<void>;
  onClose: () => void;
  progress: number | null;
}

export function UploadModal({ onUpload, onClose, progress }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onUpload(files);
  };

  const handleFileSelect = () => {
    const files = fileInputRef.current?.files;
    if (files && files.length > 0) {
      onUpload(Array.from(files));
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Upload Files</h3>

        {progress !== null ? (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {Math.round(progress)}%
            </span>
          </div>
        ) : (
          <div
            className={`${styles.dropzone} ${
              dragActive ? styles.dropzoneActive : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <p className={styles.dropText}>
              Drop files here or click to browse
            </p>
            <p className={styles.dropHint}>
              Audio, video, images, PDFs - anything the band needs
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className={styles.fileInput}
            />
          </div>
        )}

        <div className={styles.actions}>
          <button className="btn btn-secondary" onClick={onClose}>
            {progress !== null ? "Cancel" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
