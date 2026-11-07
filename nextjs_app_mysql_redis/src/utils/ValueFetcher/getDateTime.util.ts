export function getCurrentDateTime(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}
