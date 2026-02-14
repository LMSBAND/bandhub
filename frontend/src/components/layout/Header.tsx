import type { User } from "firebase/auth";
import styles from "./Header.module.css";

interface HeaderProps {
  user: User;
  bandName: string | null;
  onSignOut: () => void;
}

export function Header({ user, bandName, onSignOut }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>
          {bandName ?? "LMS BandHub"}
        </h1>
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
