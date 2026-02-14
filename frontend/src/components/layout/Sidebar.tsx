import { useLocation, useNavigate } from "react-router-dom";
import type { Band } from "../../hooks/useBand";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  bands: Band[];
  activeBand: Band | null;
  onSelectBand: (id: string) => void;
  onCreateBand: () => void;
  onJoinBand: () => void;
}

const NAV_ITEMS = [
  { path: "/library", label: "Library", icon: "folder" },
  { path: "/calendar", label: "Calendar", icon: "calendar" },
  { path: "/chat", label: "Chat", icon: "chat" },
];

const ICONS: Record<string, string> = {
  folder: "\u{1F4C1}",
  calendar: "\u{1F4C5}",
  chat: "\u{1F4AC}",
};

export function Sidebar({
  bands,
  activeBand,
  onSelectBand,
  onCreateBand,
  onJoinBand,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className={styles.sidebar}>
      {/* Band selector */}
      <div className={styles.bandSection}>
        <select
          className={styles.bandSelect}
          value={activeBand?.id ?? ""}
          onChange={(e) => onSelectBand(e.target.value)}
        >
          {bands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className={styles.bandActions}>
          <button className="btn btn-secondary" onClick={onCreateBand}>
            + Create
          </button>
          <button className="btn btn-secondary" onClick={onJoinBand}>
            Join
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`${styles.navItem} ${
              location.pathname.startsWith(item.path) ? styles.active : ""
            }`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.navIcon}>{ICONS[item.icon]}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Band members */}
      {activeBand && (
        <div className={styles.members}>
          <h4 className={styles.membersTitle}>Members</h4>
          {Object.entries(activeBand.members).map(([uid, member]) => (
            <div key={uid} className={styles.member}>
              <span className={styles.memberDot} />
              <span>{member.displayName}</span>
              {member.role === "admin" && (
                <span className={styles.adminBadge}>admin</span>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
