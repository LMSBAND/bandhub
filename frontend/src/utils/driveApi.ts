/**
 * Google Drive REST API v3 wrapper.
 * Thin fetch()-based client — no library needed.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

export class DriveApiError extends Error {
  status: number;
  constructor(resp: Response) {
    super(`Drive API error: ${resp.status} ${resp.statusText}`);
    this.status = resp.status;
  }
}

/** Find or create a folder by name under a parent (or root). Returns folder ID. */
export async function findOrCreateFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<string> {
  // Search for existing folder
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  else q += ` and 'root' in parents`;

  const searchResp = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!searchResp.ok) throw new DriveApiError(searchResp);

  const searchData = await searchResp.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

  // Create folder
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const createResp = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  if (!createResp.ok) throw new DriveApiError(createResp);

  const created = await createResp.json();
  return created.id;
}

/**
 * Upload a file to Google Drive using resumable upload protocol.
 * Uses XMLHttpRequest for upload progress tracking (fetch doesn't support it).
 */
export async function uploadFileToDrive(
  token: string,
  file: File,
  folderId: string,
  onProgress?: (pct: number) => void
): Promise<DriveFile> {
  // Step 1: Initiate resumable upload session
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const initResp = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=resumable&fields=id,name,mimeType,size`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(metadata),
    }
  );
  if (!initResp.ok) throw new DriveApiError(initResp);

  const uploadUri = initResp.headers.get("Location");
  if (!uploadUri) throw new Error("No upload URI returned from Drive");

  // Step 2: Upload file data with progress tracking via XHR
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUri);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Drive upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Drive upload network error"));
    xhr.send(file);
  });
}

/** Set a file to "anyone with the link can view". */
export async function makeFilePublic(token: string, fileId: string): Promise<void> {
  const resp = await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!resp.ok) throw new DriveApiError(resp);
}

/** Delete a file from Google Drive. */
export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  const resp = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok && resp.status !== 404) throw new DriveApiError(resp);
}

/** Fetch a Drive file as a Blob using OAuth token (for private files). */
export async function fetchDriveMedia(token: string, fileId: string): Promise<Blob> {
  const resp = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new DriveApiError(resp);
  return resp.blob();
}

/**
 * Fetch a publicly-shared Drive file as a Blob using just an API key.
 * No user OAuth token needed — works for any file shared as "anyone with link".
 */
export async function fetchPublicDriveMedia(apiKey: string, fileId: string): Promise<Blob> {
  const resp = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&key=${apiKey}`);
  if (!resp.ok) throw new DriveApiError(resp);
  return resp.blob();
}

/**
 * Direct download URL for publicly-shared Drive files.
 * Works without any auth or API key — browser follows the redirect.
 * Use as src for <audio>, <video>, <img>, <iframe> elements.
 */
export function getPublicDriveUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Embeddable image URL — works inline without triggering download interstitials. */
export function getDriveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/** Embeddable PDF viewer URL — Google renders the PDF, works on mobile. */
export function getDrivePdfUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
