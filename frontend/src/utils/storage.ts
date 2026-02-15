import {
  findOrCreateFolder,
  uploadFileToDrive,
  makeFilePublic,
  deleteDriveFile,
  fetchDriveMedia,
  fetchPublicDriveMedia,
  getPublicDriveUrl,
  getDriveImageUrl,
  getDrivePdfUrl,
  type DriveFile,
} from "./driveApi";

export type { DriveFile };

/** Ensure BandHub/{bandName}/ folder exists in user's Drive. Returns folder ID. */
export async function ensureBandFolder(
  token: string,
  bandName: string
): Promise<string> {
  const appFolderId = await findOrCreateFolder(token, "BandHub");
  const bandFolderId = await findOrCreateFolder(token, bandName, appFolderId);
  return bandFolderId;
}

/** Upload a file to Google Drive with progress tracking. Makes it publicly viewable. */
export async function uploadFile(
  token: string,
  folderId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<DriveFile> {
  const driveFile = await uploadFileToDrive(token, file, folderId, onProgress);
  await makeFilePublic(token, driveFile.id);
  return driveFile;
}

/** Fetch media from Drive as a Blob (for playback via object URL). */
export async function getMediaBlob(
  token: string,
  driveFileId: string
): Promise<Blob> {
  return fetchDriveMedia(token, driveFileId);
}

/** Fetch publicly-shared media using API key (no OAuth token needed). */
export async function getPublicMediaBlob(
  apiKey: string,
  driveFileId: string
): Promise<Blob> {
  return fetchPublicDriveMedia(apiKey, driveFileId);
}

/** Direct URL for publicly-shared Drive files (no auth needed). */
export function getDirectDriveUrl(driveFileId: string): string {
  return getPublicDriveUrl(driveFileId);
}

/** Embeddable image URL for Drive files (no auth, no download interstitial). */
export function getDirectImageUrl(driveFileId: string): string {
  return getDriveImageUrl(driveFileId);
}

/** Embeddable PDF viewer URL (Google renders the PDF server-side). */
export function getDirectPdfUrl(driveFileId: string): string {
  return getDrivePdfUrl(driveFileId);
}

/** Delete a file from the uploader's Google Drive. */
export async function deleteMediaFile(
  token: string,
  driveFileId: string
): Promise<void> {
  await deleteDriveFile(token, driveFileId);
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
