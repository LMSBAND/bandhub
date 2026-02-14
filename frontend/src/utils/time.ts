/** Format seconds as MM:SS (e.g., "01:23") */
export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format seconds as MM:SS.CC (e.g., "01:23.45") */
export function fmtTimePrecise(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2);
  return `${String(m).padStart(2, "0")}:${s.padStart(5, "0")}`;
}
