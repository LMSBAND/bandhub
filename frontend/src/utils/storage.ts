const API_BASE = "/api";

/** Get a fresh signed URL for media playback */
export async function getMediaUrl(
  bandId: string,
  mediaId: string,
  token: string
): Promise<string> {
  const res = await fetch(
    `${API_BASE}/bands/${bandId}/media/${mediaId}/audio-url`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to get media URL");
  const data = await res.json();
  return data.url;
}

/** Upload a file to the backend */
export async function uploadMedia(
  bandId: string,
  file: File,
  token: string,
  onProgress?: (pct: number) => void
): Promise<{ mediaId: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress((e.loaded / e.total) * 100);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.open("POST", `${API_BASE}/bands/${bandId}/media/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}
