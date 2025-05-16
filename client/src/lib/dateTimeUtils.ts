import { Duration, DurationLikeObject, Settings } from "luxon";

// Detect user locale from the browser environment (fallback to 'en-US' on server)
export const userLocale = typeof navigator !== "undefined" ? navigator.language : "en-US";

// Detect whether the user prefers 12-hour time format (true = 12h, false = 24h)
const resolved = new Intl.DateTimeFormat(userLocale, { hour: "numeric" }).resolvedOptions();
export const hour12 = resolved.hourCycle === "h12";

// Detect user's timezone (not exported but used internally)
export const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Set default locale for Luxon globally
Settings.defaultLocale = userLocale;

/**
 * Returns localized weekday names, starting from Monday.
 *
 * @param locale - The locale to use (e.g., "en-US", "uk-UA").
 * @param format - The weekday format: "narrow" | "short" | "long".
 * @returns An array of localized weekday names from Monday to Sunday.
 */
export function getLocalizedWeekdayNames(
  locale: string,
  format: "narrow" | "short" | "long" = "long"
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });

  // Fallback in case Intl fails
  const fallback: Record<"narrow" | "short" | "long", string[]> = {
    narrow: ["M", "T", "W", "T", "F", "S", "S"],
    short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    long: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  };

  const today = new Date();
  const startDay = 1; // Monday

  return Array.from({ length: 7 }, (_, i) => {
    const day = startDay + i;
    const date = new Date(today);
    date.setDate(today.getDate() + ((day - today.getDay() + 7) % 7));

    const parts = formatter.formatToParts(date);
    const weekday = parts.find((part) => part.type === "weekday");

    return weekday?.value ?? fallback[format][i];
  });
}

/**
 * Returns an array of 24 localized hour labels (e.g., "0", "12 AM", "1 PM")
 * based on locale and given formatting options.
 *
 * @param locale - The locale to use (e.g., "en-US", "uk-UA").
 * @param options - Intl.DateTimeFormat options (e.g., { hour: "numeric", hour12: true }).
 * @returns An array of 24 formatted hour strings.
 */
export function getLocalizedTimeLabels(
  locale: string,
  options: Intl.DateTimeFormatOptions
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, options);

  return Array.from({ length: 24 }, (_, hour) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return formatter.format(date);
  });
}

/**
 * Formats a duration from minutes and seconds into a human-readable string.
 *
 * @param minutes - Number of minutes.
 * @param seconds - Number of seconds.
 * @returns A compact, readable string like "1 min 30 sec".
 */
export function formatDuration(minutes: number, seconds: number): string {
  const units: Record<string, number> = {};
  if (minutes > 0) units.minutes = minutes;
  if (seconds > 0 || minutes === 0) units.seconds = seconds;

  const keys: (keyof DurationLikeObject)[] = minutes > 0 ? ["minutes", "seconds"] : ["seconds"];

  const duration = Duration.fromObject(units).shiftTo(...keys).normalize();

  return duration.toHuman({
    listStyle: "narrow",
    unitDisplay: "short",
  });
}

/**
 * Formats a given hour and minute into a localized time string
 * (e.g., "11:00 AM" or "23:00"), using the detected `hour12` preference.
 *
 * @param hour - Hour of the day (0–23).
 * @param minute - Minute of the hour (0–59).
 * @returns Localized time string.
 */
export const formatLocalTime = (hour: number, minute: number): string => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: hour12,
  });

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return formatter.format(date);
};

// --- Precomputed localized data ---

// Full weekday names (e.g., "Monday", "Tuesday")
export const longDayNames: string[] = getLocalizedWeekdayNames(userLocale, "long");

// Short weekday names (e.g., "Mon", "Tue")
export const shortDayNames: string[] = getLocalizedWeekdayNames(userLocale, "short");

// Hour-only labels (e.g., "00", "01", "02", "1 AM", "2 PM")
export const hourLabels: string[] = getLocalizedTimeLabels(userLocale, {
  hour: "numeric",
  hour12: hour12,
});

// Full hour:minute labels (e.g., "00:00", "01:00", "1:00 AM", "2:00 PM")
export const hourMinuteLabels: string[] = getLocalizedTimeLabels(userLocale, {
  hour: "numeric",
  minute: "2-digit",
  hour12: hour12,
});
