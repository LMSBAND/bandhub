import { useState } from "react";
import styles from "./BandSetup.module.css";

interface BandSetupProps {
  onCreateBand: (name: string) => Promise<void>;
  onJoinBand: (code: string) => Promise<void>;
}

export function BandSetup({ onCreateBand, onJoinBand }: BandSetupProps) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [bandName, setBandName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!bandName.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onCreateBand(bandName.trim());
    } catch (e: any) {
      setError(e.message || "Failed to create band");
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onJoinBand(inviteCode.trim());
    } catch (e: any) {
      setError(e.message || "Invalid invite code");
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Welcome to LMS BandHub</h2>
        <p className={styles.subtitle}>Create a new band or join an existing one.</p>

        {error && <div className={styles.error}>{error}</div>}

        {mode === "choose" && (
          <div className={styles.choices}>
            <button
              className={`btn btn-primary ${styles.choiceBtn}`}
              onClick={() => setMode("create")}
            >
              Create a Band
            </button>
            <button
              className={`btn btn-secondary ${styles.choiceBtn}`}
              onClick={() => setMode("join")}
            >
              Join with Invite Code
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className={styles.form}>
            <input
              type="text"
              placeholder="Band name"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              className={styles.input}
              autoFocus
            />
            <div className={styles.formActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setMode("choose")}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={loading || !bandName.trim()}
              >
                {loading ? "Creating..." : "Create Band"}
              </button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className={styles.form}>
            <input
              type="text"
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className={styles.input}
              autoFocus
            />
            <div className={styles.formActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setMode("choose")}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleJoin}
                disabled={loading || !inviteCode.trim()}
              >
                {loading ? "Joining..." : "Join Band"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
