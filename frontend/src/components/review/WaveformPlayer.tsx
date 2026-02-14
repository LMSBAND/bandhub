import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { fmtTime } from "../../utils/time";
import styles from "./WaveformPlayer.module.css";

export interface CommentMarkerData {
  id: string;
  timestamp: number;
  text: string;
  author: string;
  authorUid: string;
  resolved: boolean;
  replies?: { author: string; text: string; createdAt: Date }[];
}

interface WaveformPlayerProps {
  audioUrl: string;
  peaks?: number[];
  duration?: number;
  comments: CommentMarkerData[];
  onWaveformClick: (timestamp: number) => void;
  onCommentClick: (commentId: string) => void;
  activeCommentId?: string | null;
}

export function WaveformPlayer({
  audioUrl,
  peaks,
  duration,
  comments,
  onWaveformClick,
  onCommentClick,
  activeCommentId,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration ?? 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Initialize wavesurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#4a4a8a",
      progressColor: "#6c63ff",
      cursorColor: "#fff",
      height: 120,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      url: audioUrl,
      peaks: peaks ? [peaks] : undefined,
      duration: duration,
      minPxPerSec: 10,
      plugins: [regions],
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("ready", () => setTotalDuration(ws.getDuration()));

    // Click on waveform = add comment at that position
    ws.on("click", (relativeX) => {
      const clickTime = relativeX * ws.getDuration();
      onWaveformClick(clickTime);
    });

    // Click on region = highlight that comment
    regions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      onCommentClick(region.id);
      const ratio = region.start / ws.getDuration();
      ws.seekTo(Math.min(Math.max(ratio, 0), 1));
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  // Update regions when comments change
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;

    // Clear existing regions
    regions.clearRegions();

    // Add comment markers
    comments.forEach((c) => {
      regions.addRegion({
        id: c.id,
        start: c.timestamp,
        end: c.timestamp + 0.5,
        color: c.resolved
          ? "var(--color-comment-resolved)"
          : c.id === activeCommentId
          ? "rgba(108, 99, 255, 0.7)"
          : "var(--color-comment-marker)",
        drag: false,
        resize: false,
      });
    });
  }, [comments, activeCommentId]);

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const skip = useCallback((seconds: number) => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setTime(Math.max(0, ws.getCurrentTime() + seconds));
  }, []);

  const changeSpeed = useCallback(
    (delta: number) => {
      const newRate = Math.max(0.25, Math.min(2, playbackRate + delta));
      setPlaybackRate(newRate);
      wavesurferRef.current?.setPlaybackRate(newRate);
    },
    [playbackRate]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          skip(-5);
          break;
        case "ArrowRight":
          skip(5);
          break;
        case "c":
        case "C":
          onWaveformClick(wavesurferRef.current?.getCurrentTime() ?? 0);
          break;
        case ";":
          changeSpeed(-0.1);
          break;
        case "'":
          changeSpeed(0.1);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip, changeSpeed, onWaveformClick]);

  return (
    <div className={styles.player}>
      <div ref={containerRef} className={styles.waveform} />
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <button className={styles.controlBtn} onClick={() => skip(-5)}>
            -5s
          </button>
          <button
            className={`${styles.controlBtn} ${styles.playBtn}`}
            onClick={togglePlay}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button className={styles.controlBtn} onClick={() => skip(5)}>
            +5s
          </button>
        </div>
        <div className={styles.time}>
          {fmtTime(currentTime)} / {fmtTime(totalDuration)}
        </div>
        <div className={styles.controlsRight}>
          <span className={styles.speed}>{playbackRate.toFixed(1)}x</span>
          <span className={styles.hint}>
            Space: play | Arrows: skip | C: comment
          </span>
        </div>
      </div>
    </div>
  );
}
