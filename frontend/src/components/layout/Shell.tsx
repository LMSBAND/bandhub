import { Outlet } from "react-router-dom";
import type { User } from "firebase/auth";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { Band } from "../../hooks/useBand";
import styles from "./Shell.module.css";

interface ShellProps {
  user: User;
  bands: Band[];
  activeBand: Band | null;
  onSelectBand: (id: string) => void;
  onSignOut: () => void;
}

export function Shell({
  user,
  bands,
  activeBand,
  onSelectBand,
  onSignOut,
}: ShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar
        bands={bands}
        activeBand={activeBand}
        onSelectBand={onSelectBand}
        onCreateBand={() => {/* TODO: modal */}}
        onJoinBand={() => {/* TODO: modal */}}
      />
      <div className={styles.main}>
        <Header
          user={user}
          bandName={activeBand?.name ?? null}
          onSignOut={onSignOut}
        />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
