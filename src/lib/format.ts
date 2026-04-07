/** Shared formatting utilities */

export function formatDate(ts?: number) {
  if (!ts) return "未知时间";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Resolve an image string to a displayable src */
export function resolveImageSrc(url: string): string {
  if (url.startsWith("data:") || url.startsWith("http") || url.startsWith("local-file://") || url.startsWith("file://")) return url;
  return `data:image/png;base64,${url}`;
}

/** Check if a URL is a valid displayable image source (not raw base64) */
export function isImageUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("http") || url.startsWith("local-file://") || url.startsWith("file://");
}
