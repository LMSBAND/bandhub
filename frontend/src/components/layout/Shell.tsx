import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { User } from "firebase/auth";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import type { Band } from "../../hooks/useBand";
import styles from "./Shell.module.css";

interface ShellProps {
  user: User;
  bands: Band[];
  activeBand: Band | null;
  onSelectBand: (id: string) => void;
  onCreateBand: (name: string) => Promise<void>;
  onJoinBand: (code: string) => Promise<void>;
  onApproveMember: (bandId: string, uid: string) => void;
  onRejectMember: (bandId: string, uid: string) => void;
  onKickMember: (bandId: string, uid: string) => void;
  onSignOut: () => void;
}

export function Shell({
  user,
  bands,
  activeBand,
  onSelectBand,
  onCreateBand,
  onJoinBand,
  onApproveMember,
  onRejectMember,
  onKickMember,
  onSignOut,
}: ShellProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [bandName, setBandName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(
    () => sessionStorage.getItem("install-dismissed") === "1"
  );
  const { canInstall, isInstalled, isIOS, install } = useInstallPrompt();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Close mobile menu on route change
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      setMobileMenuOpen(false);
    }
  }, [location.pathname]);

  const handleCreate = async () => {
    if (!bandName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onCreateBand(bandName.trim());
      setBandName("");
      setShowCreate(false);
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onJoinBand(joinCode.trim());
      setJoinCode("");
      setShowJoin(false);
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  };

  return (
    <div className={styles.shell}>
      {/* Mobile sidebar backdrop */}
      <div
        className={`${styles.sidebarBackdrop} ${mobileMenuOpen ? styles.backdropVisible : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <div className={`${styles.sidebarWrap} ${mobileMenuOpen ? styles.sidebarOpen : ""}`}>
        <Sidebar
          bands={bands}
          activeBand={activeBand}
          currentUserId={user.uid}
          onSelectBand={(id) => {
            onSelectBand(id);
            setMobileMenuOpen(false);
          }}
          onCreateBand={() => { setShowCreate(true); setError(""); setMobileMenuOpen(false); }}
          onJoinBand={() => { setShowJoin(true); setError(""); setMobileMenuOpen(false); }}
          onApproveMember={onApproveMember}
          onRejectMember={onRejectMember}
          onKickMember={onKickMember}
          onNavigate={() => setMobileMenuOpen(false)}
        />
      </div>

      <div className={styles.main}>
        <Header
          user={user}
          bandName={activeBand?.name ?? null}
          inviteCode={activeBand?.inviteCode ?? null}
          onSignOut={onSignOut}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <div className={styles.content}>
          {/* Install banner */}
          {!isInstalled && !installDismissed && (canInstall || isIOS) && (
            <div className={styles.installBanner}>
              <span>Install BandHub on your device for the best experience!</span>
              <div className={styles.installActions}>
                {canInstall ? (
                  <button className="btn btn-primary" onClick={install}>
                    Install
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => setShowInstallHelp(true)}>
                    How to Install
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setInstallDismissed(true);
                    sessionStorage.setItem("install-dismissed", "1");
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {(() => {
            const myRole = activeBand?.members[user.uid]?.role;
            if (myRole === "pending") {
              return (
                <div className={styles.pendingScreen}>
                  <h2>Waiting for Approval</h2>
                  <p>Your request to join <strong>{activeBand!.name}</strong> is pending admin approval.</p>
                  <p>The band admin will approve your access soon.</p>
                </div>
              );
            }
            if (!activeBand) {
              return (
                <div className={styles.pendingScreen}>
                  <p>Select a band from the sidebar to get started.</p>
                </div>
              );
            }
            return <Outlet />;
          })()}
        </div>
      </div>

      {/* Create Band Modal */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Create a New Band</h3>
            <input
              type="text"
              placeholder="Band name..."
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className={styles.input}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
                {submitting ? "Creating..." : "Create Band"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Band Modal */}
      {showJoin && (
        <div className={styles.overlay} onClick={() => setShowJoin(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Join a Band</h3>
            <input
              type="text"
              placeholder="Invite code..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className={styles.input}
              autoFocus
              maxLength={6}
            />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowJoin(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleJoin} disabled={submitting}>
                {submitting ? "Joining..." : "Join Band"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Help Modal */}
      {showInstallHelp && (
        <div className={styles.overlay} onClick={() => setShowInstallHelp(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Install LMS BandHub</h3>
            <div className={styles.installSteps}>
              {isIOS ? (
                <>
                  <p className={styles.installPlatform}>iPhone / iPad (Safari)</p>
                  <ol>
                    <li>Tap the <strong>Share</strong> button (square with arrow) at the bottom of Safari</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>"Add"</strong> in the top right</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className={styles.installPlatform}>Android (Chrome)</p>
                  <ol>
                    <li>Tap the <strong>three-dot menu</strong> in the top right of Chrome</li>
                    <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
                    <li>Tap <strong>"Install"</strong> to confirm</li>
                  </ol>
                  <p className={styles.installPlatform}>Desktop (Chrome / Edge)</p>
                  <ol>
                    <li>Look for the <strong>install icon</strong> in the address bar (right side)</li>
                    <li>Click <strong>"Install"</strong></li>
                  </ol>
                </>
              )}
              <p className={styles.installNote}>
                Once installed, BandHub opens as a standalone app — no browser bars!
              </p>
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-primary" onClick={() => setShowInstallHelp(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
