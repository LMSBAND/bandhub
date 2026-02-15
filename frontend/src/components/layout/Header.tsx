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

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {onMenuToggle && (
          <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Menu">
            <span /><span /><span />
          </button>
        )}
        <h1 className={styles.title}>
          {bandName ?? "LMS BandHub"}
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
  );
}
