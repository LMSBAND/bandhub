import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  return (
    <div className={styles.dashboard}>
      <h2>Dashboard</h2>
      <p className={styles.placeholder}>
        Welcome to LMS BandHub. Head to the Library to upload some demos!
      </p>
    </div>
  );
}
