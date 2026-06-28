/**
 * Utility helpers for formatting strings, dates, and numbers.
 */

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
