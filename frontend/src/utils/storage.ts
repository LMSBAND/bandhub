import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { storage } from "../firebase";

/** Upload a file to Firebase Storage with progress tracking */
export async function uploadFile(
  bandId: string,
  mediaId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  if (!storage) throw new Error("Storage not initialized");

  const storagePath = `bands/${bandId}/media/${mediaId}/${file.name}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(pct);
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadUrl);
      }
    );
  });
}

/** Get download URL for a media file stored in Firebase Storage */
export async function getMediaUrl(gcsPath: string): Promise<string> {
  if (!storage) throw new Error("Storage not initialized");
  const storageRef = ref(storage, gcsPath);
  return getDownloadURL(storageRef);
}

/** Compute waveform peaks client-side using Web Audio API */
export async function computePeaks(
  file: File,
  numPeaks: number = 200
): Promise<{ peaks: number[]; duration: number }> {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const duration = audioBuffer.duration;
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerPeak = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(Math.round(max * 1000) / 1000);
  }

  audioContext.close();
  return { peaks, duration };
}

/** Determine media type from MIME type */
export function getMediaType(mimeType: string): string {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "other";
}
