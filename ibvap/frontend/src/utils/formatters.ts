// Formatting and visual helper utilities

export function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return '--:--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatFullDateTime(isoString?: string | null): string {
  if (!isoString) return 'Date unknown';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function timeAgo(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${Math.floor(diffHour / 24)}d ago`;
  } catch {
    return '';
  }
}

export function getStatusTheme(status?: string | null): {
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  textColor: string;
  glow: string;
  label: string;
} {
  const s = (status || '').toUpperCase();
  if (s === 'KNOWN') {
    return {
      badgeBg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
      badgeText: 'text-emerald-400',
      borderColor: '#10b981',
      textColor: 'text-emerald-400',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]',
      label: 'KNOWN',
    };
  }
  if (s === 'FLAGGED' || s === 'CRITICAL' || s === 'WATCHLIST') {
    return {
      badgeBg: 'bg-red-500/15 border-red-500/40 text-red-400',
      badgeText: 'text-red-400',
      borderColor: '#ef4444',
      textColor: 'text-red-400',
      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]',
      label: 'FLAGGED',
    };
  }
  // UNKNOWN / MEDIUM / default
  return {
    badgeBg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
    badgeText: 'text-amber-400',
    borderColor: '#f59e0b',
    textColor: 'text-amber-400',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]',
    label: 'UNKNOWN',
  };
}

export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Handle backend relative static paths (/media/faces/..., /media/evidence/..., /evidence/...)
  if (path.startsWith('/')) {
    return path;
  }
  return `/${path}`;
}
