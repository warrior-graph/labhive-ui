/**
 * Date helpers for Material datepickers.
 *
 * Material's datepicker binds to `Date` objects, while the API speaks ISO
 * strings (`YYYY-MM-DD` for dates, full ISO for timestamps). These helpers keep
 * the conversion in one place and work in **local time** — using
 * `toISOString().slice(0, 10)` shifts the day in negative-offset timezones.
 */

/** Parse an API value (`YYYY-MM-DD` or full ISO) into a local `Date`. */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Format a `Date` as the API's `YYYY-MM-DD` (local calendar day). */
export function toIsoDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Format a `Date`'s clock time as `HH:mm`. */
export function toLocalTime(date: Date | null | undefined): string {
  if (!date) return '00:00';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Combine a datepicker value with an `HH:mm` string into a local `Date`. */
export function combineDateTime(
  date: Date | null | undefined,
  time: string | null | undefined,
): Date | null {
  if (!date) return null;
  const clock = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '00:00';
  const [hours, minutes] = clock.split(':');
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number(hours),
    Number(minutes),
  );
}
