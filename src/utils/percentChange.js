// Percent change rounded to 1 decimal. null when there is nothing to compare against.
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
