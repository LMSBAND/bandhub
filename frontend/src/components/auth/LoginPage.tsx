import styles from "./LoginPage.module.css";

interface LoginPageProps {
  onGoogleSignIn: () => void;
}

export function LoginPage({ onGoogleSignIn }: LoginPageProps) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>LMS BandHub</h1>
        <p className={styles.subtitle}>
          Your band's home base. Organize media, review demos, schedule gigs.
        </p>
        <button
          className={`btn btn-primary ${styles.googleBtn}`}
          onClick={onGoogleSignIn}
        >
          Sign in with Google
        </button>
        <p className={styles.driveNote}>
          This will connect directly to your Google Drive. We don't store any data.
          It's safe as far as Google goes. Break a leg. - LMS
        </p>
      </div>
    </div>
  );
}
