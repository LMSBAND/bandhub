import { useState } from "react";
import type { User } from "firebase/auth";
import styles from "./Header.module.css";

interface HeaderProps {
  user: User;
  bandName: string | null;
  inviteCode: string | null;
  onSignOut: () => void;
  onMenuToggle?: () => void;
}

export function Header({ user, bandName, inviteCode, onSignOut, onMenuToggle }: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          {onMenuToggle && (
            <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Menu">
              <span /><span /><span />
            </button>
          )}
          <h1 className={styles.title}>
            {bandName ?? "LMS BandHub"}
            <span className={styles.betaBadge}>Beta</span>
          </h1>
          {inviteCode && (
            <button
              className={styles.inviteBtn}
              onClick={copyInviteCode}
              title="Click to copy invite code"
            >
              {copied ? "Copied!" : `Invite: ${inviteCode}`}
            </button>
          )}
        </div>
        <div className={styles.right}>
          <button className={styles.noticeBtn} onClick={() => setShowNotice(true)}>
            NOTICE
          </button>
          <span className={styles.userName}>
            {user.displayName ?? user.email}
          </span>
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              className={styles.avatar}
              referrerPolicy="no-referrer"
            />
          )}
          <button className="btn btn-secondary" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {showNotice && (
        <div className={styles.noticeOverlay} onClick={() => setShowNotice(false)}>
          <div className={styles.noticeBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.noticeTitleBar}>
              <span>NOTICE.txt</span>
              <button className={styles.noticeClose} onClick={() => setShowNotice(false)}>X</button>
            </div>
            <div className={styles.noticeContent}>
              <p className={styles.noticeWarning}>NOTICE</p>
              <p className={styles.noticeWarning}>THEY ARE TRYING TO STEAL YOUR COMPUTER</p>
              <p className={styles.noticeWarningSm}>INSTALL LINUX NOW</p>

              <p className={styles.noticeGreen}>Cancel your subscriptions, install Linux, use AI if you have to. It's a double whammy: they pay to get you off their junk.</p>

              <p className={styles.noticeGreen}>Own your tools again.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
