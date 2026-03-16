/**
 * Parse SSE logs to derive per-image progress.
 */

export function getCompletedImageCount(logs: string[]): number {
  let max = 0;
  for (const log of logs) {
    const m = log.match(/Completed image (\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

