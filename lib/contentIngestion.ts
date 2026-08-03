export interface IngestedImage {
  base64: string;
  mimeType: string;
  byteLength: number;
  /** Which thumbnail variant was used. Only set for YouTube ingestion. */
  thumbnailQuality?: "maxresdefault" | "hqdefault";
}

/**
 * YouTube serves a 120x90 grey "no thumbnail" placeholder for some videos
 * instead of a clean 404, so a size floor is needed alongside the status check.
 */
const PLACEHOLDER_BYTE_FLOOR = 2000;

/**
 * Pulls the 11-character video ID out of any standard YouTube URL shape:
 * watch?v=, youtu.be/, /embed/, /shorts/, /live/, /v/.
 */
export function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
    /\/v\/([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function tryFetchThumbnail(
  videoId: string,
  quality: "maxresdefault" | "hqdefault",
): Promise<IngestedImage | null> {
  const res = await fetch(`https://img.youtube.com/vi/${videoId}/${quality}.jpg`);
  if (!res.ok) return null;

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength < PLACEHOLDER_BYTE_FLOOR) return null;

  return {
    base64: bytes.toString("base64"),
    mimeType: res.headers.get("content-type") ?? "image/jpeg",
    byteLength: bytes.byteLength,
    thumbnailQuality: quality,
  };
}

/**
 * Fetches a YouTube video's public thumbnail server-side and returns it as
 * base64. Falls back to hqdefault when maxresdefault is unavailable.
 *
 * Only the thumbnail image is fetched - no video download or processing.
 */
export async function fetchYoutubeThumbnail(url: string): Promise<IngestedImage> {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) {
    throw new Error(`Could not extract a YouTube video ID from URL: ${url}`);
  }

  const maxres = await tryFetchThumbnail(videoId, "maxresdefault");
  if (maxres) return maxres;

  const hq = await tryFetchThumbnail(videoId, "hqdefault");
  if (hq) return hq;

  throw new Error(`No thumbnail available for YouTube video ID: ${videoId}`);
}

/**
 * Converts an uploaded image file (from a multipart form) to base64.
 */
export async function processUploadedImage(file: File): Promise<IngestedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`Uploaded file is not an image (got "${file.type || "unknown"}")`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("Uploaded file is empty");
  }

  return {
    base64: bytes.toString("base64"),
    mimeType: file.type,
    byteLength: bytes.byteLength,
  };
}
