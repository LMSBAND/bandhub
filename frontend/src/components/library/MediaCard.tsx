import { fmtTime } from "../../utils/time";
import styles from "./MediaCard.module.css";

interface MediaItem {
  id: string;
  name: string;
  type: string;
  size: number;
  duration?: number;
  tags: string[];
  commentCount: number;
}

interface MediaCardProps {
  item: MediaItem;
  onClick: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  audio: "\u{1F3B5}",
  video: "\u{1F3AC}",
  image: "\u{1F5BC}",
  pdf: "\u{1F4C4}",
  other: "\u{1F4CE}",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaCard({ item, onClick }: MediaCardProps) {
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.icon}>{TYPE_ICONS[item.type] ?? TYPE_ICONS.other}</div>
      <div className={styles.info}>
        <div className={styles.name} title={item.name}>
          {item.name}
        </div>
        <div className={styles.meta}>
          <span>{formatSize(item.size)}</span>
          {item.duration != null && <span>{fmtTime(item.duration)}</span>}
          {item.commentCount > 0 && (
            <span className={styles.comments}>
              {item.commentCount} comment{item.commentCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {item.tags.length > 0 && (
          <div className={styles.tags}>
            {item.tags.map((t) => (
              <span key={t} className={styles.tag}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
