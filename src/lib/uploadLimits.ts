/**
 * Files are uploaded through the website's serverless function, and Vercel rejects any request body over about
 * 4.5 MB. A lesson video is far larger than that, so it can never be uploaded this way. These helpers turn that
 * (and other upload failures) into a message the admin can act on, shown next to the field.
 */
export const MAX_UPLOAD_BYTES = 4_000_000;

export const VIDEO_HELP =
  'Paste a YouTube (unlisted) or Vimeo link. The upload button only takes small files (up to about 4 MB), so it cannot carry a video.';

const mb = (n: number) => `${(n / 1_000_000).toFixed(1)} MB`;

const WHY_NOT_VIDEO = 'Uploads here are limited to about 4 MB, so a video cannot be uploaded this way. Host the video on YouTube (unlisted) or Vimeo and paste its link into the Video field instead.';

/** A message if the file is too big to upload here, otherwise null. */
export function uploadSizeProblem(size: number, name = 'This file'): string | null {
  if (size <= MAX_UPLOAD_BYTES) return null;
  return `${name} is ${mb(size)}. ${WHY_NOT_VIDEO}`;
}

/** A plain-language message for a failed upload response. */
export function uploadFailureMessage(status: number, serverMessage?: string): string {
  if (status === 413) return `The file was too large for the server. ${WHY_NOT_VIDEO}`;
  if (status === 401 || status === 403) return 'Your admin session has expired or is not allowed to upload. Sign in again and retry.';
  if (serverMessage && /STORAGE_BUCKET/i.test(serverMessage)) return 'File storage is not set up on the server (FIREBASE_STORAGE_BUCKET is missing), so nothing can be uploaded. Paste a link instead.';
  if (serverMessage) return `Upload failed: ${serverMessage}`;
  return `Upload failed (server status ${status}). Paste a link instead, or try a smaller file.`;
}
