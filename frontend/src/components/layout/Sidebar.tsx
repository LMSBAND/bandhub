import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Band } from "../../hooks/useBand";
import { useOfflineStorage } from "../../hooks/useOfflineStorage";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  bands: Band[];
  activeBand: Band | null;
  currentUserId?: string;
  onSelectBand: (id: string) => void;
  onCreateBand: () => void;
  onJoinBand: () => void;
  onApproveMember?: (bandId: string, uid: string) => void;
  onRejectMember?: (bandId: string, uid: string) => void;
  onKickMember?: (bandId: string, uid: string) => void;
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { path: "/library", label: "art", icon: "folder" },
  { path: "/calendar", label: "dates", icon: "calendar" },
  { path: "/chat", label: "bullshit", icon: "chat" },
];

const ICONS: Record<string, string> = {
  folder: "\u{1F4C1}",
  calendar: "\u{1F4C5}",
  chat: "\u{1F4AC}",
};

export function Sidebar({
  bands,
  activeBand,
  currentUserId,
  onSelectBand,
  onCreateBand,
  onJoinBand,
  onApproveMember,
  onRejectMember,
  onKickMember,
  onNavigate,
}: SidebarProps) {
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { autoOffline, setAutoOffline, autoOfflineTypes, toggleOfflineType } = useOfflineStorage();

  const copyInviteCode = () => {
    if (!activeBand?.inviteCode) return;
    navigator.clipboard.writeText(activeBand.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const emailInvite = () => {
    if (!activeBand) return;
    const subject = encodeURIComponent(`Join ${activeBand.name} on LMS BandHub`);
    const body = encodeURIComponent(
      `You're invited to join "${activeBand.name}" on LMS BandHub!\n\n` +
      `1. Go to https://lms-bandhub.web.app\n` +
      `2. Sign in with Google\n` +
      `3. Enter invite code: ${activeBand.inviteCode}\n\n` +
      `See you there!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  };

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
        {activeBand?.inviteCode && (
          <div className={styles.inviteRow}>
            <button className={styles.inviteCode} onClick={copyInviteCode}>
              {copied ? "Copied!" : `${activeBand.inviteCode}`}
            </button>
            <button className={styles.emailInviteBtn} onClick={emailInvite} title="Email invite">
              Email
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`${styles.navItem} ${
              location.pathname.startsWith(item.path) ? styles.active : ""
            }`}
            onClick={() => { navigate(item.path); onNavigate?.(); }}
          >
            <span className={styles.navIcon}>{ICONS[item.icon]}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Auto-offline toggle */}
      <div className={styles.offlineSection}>
        <label className={styles.autoOfflineToggle}>
          <input
            type="checkbox"
            checked={autoOffline}
            onChange={(e) => setAutoOffline(e.target.checked)}
          />
          <span className={styles.toggleSwitch} />
          <span className={styles.toggleLabel}>auto-offline</span>
        </label>
        {autoOffline && (
          <div className={styles.typeFilters}>
            {["audio", "video", "image", "pdf", "other"].map((t) => (
              <button
                key={t}
                className={`${styles.typeChip} ${autoOfflineTypes.has(t) ? styles.typeChipOn : ""}`}
                onClick={() => toggleOfflineType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Band members */}
      {activeBand && (() => {
        const isAdmin = currentUserId ? activeBand.members[currentUserId]?.role === "admin" : false;
        const activeMembers = Object.entries(activeBand.members).filter(([, m]) => m.role !== "pending");
        const pendingMembers = Object.entries(activeBand.members).filter(([, m]) => m.role === "pending");

        return (
          <div className={styles.members}>
            <h4 className={styles.membersTitle}>Members</h4>
            {activeMembers.map(([uid, member]) => (
              <div key={uid} className={styles.member}>
                <span className={styles.memberDot} />
                <span className={styles.memberName}>{member.displayName}</span>
                {member.role === "admin" && (
                  <span className={styles.adminBadge}>admin</span>
                )}
                {isAdmin && uid !== currentUserId && member.role !== "admin" && (
                  <button
                    className={styles.kickBtn}
                    onClick={() => onKickMember?.(activeBand.id, uid)}
                    title="Remove from band"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}

            {pendingMembers.length > 0 && isAdmin && (
              <>
                <h4 className={`${styles.membersTitle} ${styles.pendingTitle}`}>
                  Pending Approval ({pendingMembers.length})
                </h4>
                {pendingMembers.map(([uid, member]) => (
                  <div key={uid} className={`${styles.member} ${styles.pendingMember}`}>
                    <span className={styles.pendingDot} />
                    <span className={styles.memberName}>{member.displayName}</span>
                    <div className={styles.pendingActions}>
                      <button
                        className={styles.approveBtn}
                        onClick={() => onApproveMember?.(activeBand.id, uid)}
                        title="Approve"
                      >
                        Y
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => onRejectMember?.(activeBand.id, uid)}
                        title="Reject"
                      >
                        N
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {pendingMembers.length > 0 && !isAdmin && (
              <div className={styles.pendingNotice}>
                Waiting for admin approval...
              </div>
            )}
          </div>
        );
      })()}
    </aside>
  );
}
