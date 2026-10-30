import { Temporal } from '@js-temporal/polyfill';

/**
 * Format an ISO timestamp to local hour and minute (e.g. "10:52 AM")
 * using Temporal API.
 */
export function formatMessageTime(isoString: string): string {
  try {
    const instant = Temporal.Instant.from(isoString);
    const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
    const hour = zonedDateTime.hour;
    const minute = zonedDateTime.minute.toString().padStart(2, '0');
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minute} ${period}`;
  } catch {
    return '';
  }
}

/**
 * Format an ISO timestamp to a date label (e.g. "Today", "Yesterday", or "YYYY-MM-DD")
 * using Temporal API.
 */
export function formatMessageDate(isoString: string): string {
  try {
    const instant = Temporal.Instant.from(isoString);
    const tz = Temporal.Now.timeZoneId();
    const msgDate = instant.toZonedDateTimeISO(tz).toPlainDate();
    const today = Temporal.Now.plainDateISO(tz);
    const yesterday = today.subtract({ days: 1 });

    if (Temporal.PlainDate.compare(msgDate, today) === 0) {
      return 'Today';
    }
    if (Temporal.PlainDate.compare(msgDate, yesterday) === 0) {
      return 'Yesterday';
    }
    return `${msgDate.year}-${msgDate.month.toString().padStart(2, '0')}-${msgDate.day.toString().padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/**
 * Checks if two messages are consecutive from the same sender within 2 minutes (120s)
 * using Temporal API duration calculations.
 */
export function isConsecutiveMessage(
  prevCreatedAt: string,
  prevSenderId: string,
  currentCreatedAt: string,
  currentSenderId: string
): boolean {
  if (prevSenderId !== currentSenderId) return false;
  try {
    const t1 = Temporal.Instant.from(prevCreatedAt);
    const t2 = Temporal.Instant.from(currentCreatedAt);
    const duration = t2.since(t1);
    const diffSeconds = Math.abs(duration.total({ unit: 'second' }));
    return diffSeconds < 120;
  } catch {
    return false;
  }
}
