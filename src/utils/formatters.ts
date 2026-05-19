/**
 * Parses a time string in "mm:ss" or "hh:mm:ss" format to seconds.
 * @example parseTimeToSeconds("42:30") → 2550
 * @example parseTimeToSeconds("1:35:00") → 5700
 * @returns null if input is empty or invalid
 */
export function parseTimeToSeconds(input: string): number | null {
  if (!input || input.trim() === '') return null;

  const parts = input.trim().split(':');

  if (parts.length === 2) {
    const minutes = parseInt(parts[0]!, 10);
    const seconds = parseInt(parts[1]!, 10);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    if (seconds < 0 || seconds >= 60) return null;
    const total = minutes * 60 + seconds;
    return total > 0 ? total : null;
  }

  if (parts.length === 3) {
    const hours = parseInt(parts[0]!, 10);
    const minutes = parseInt(parts[1]!, 10);
    const seconds = parseInt(parts[2]!, 10);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    if (minutes >= 60 || seconds >= 60) return null;
    const total = hours * 3600 + minutes * 60 + seconds;
    return total > 0 ? total : null;
  }

  return null;
}

/**
 * Converts seconds to a human-readable time string.
 * @example formatSeconds(3725) → "1:02:05"
 * @example formatSeconds(185)  → "03:05"
 */
export function formatSeconds(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);

  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Converts seconds-per-km to a pace string.
 * @example formatPace(270) → "4:30 /km"
 */
export function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/**
 * Converts seconds-per-100m to a swim pace string.
 * @example formatSwimPace(100) → "1:40 /100m"
 */
export function formatSwimPace(secPer100m: number): string {
  if (!isFinite(secPer100m) || secPer100m <= 0) return '—';
  const m = Math.floor(secPer100m / 60);
  const s = Math.round(secPer100m % 60);
  return `${m}:${String(s).padStart(2, '0')} /100m`;
}

/**
 * Formats a speed value in km/h.
 * @example formatSpeed(37.4) → "37.4 km/h"
 */
export function formatSpeed(kmh: number): string {
  if (!isFinite(kmh) || kmh <= 0) return '—';
  return `${kmh.toFixed(1)} km/h`;
}
