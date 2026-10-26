// IPP-1008: "today" / "yesterday" / "3 days ago" for the last backup date
const DAY_MS = 24 * 60 * 60 * 1000;

export function backupAge(at) {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / DAY_MS);
  if (days <= 0) return { days: 0, text: 'today' };
  if (days === 1) return { days, text: 'yesterday' };
  return { days, text: `${days} days ago` };
}

export const formatBackupDate = (value) =>
  new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
