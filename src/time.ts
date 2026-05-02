export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function timeString(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function timestampSlug(d: Date): string {
  return `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export function attachmentSlug(d: Date): string {
  return `${dateString(d)}-${timestampSlug(d)}`;
}
