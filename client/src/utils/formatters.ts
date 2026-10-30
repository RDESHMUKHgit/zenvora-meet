import { Temporal } from '@js-temporal/polyfill';

export const getCurrentTemporalInstant = (): Temporal.Instant => {
  return Temporal.Now.instant();
};

export const getCurrentIsoTimestamp = (): string => {
  return Temporal.Now.instant().toString();
};

export const getLiveClockData = (timeZone: string = 'UTC') => {
  try {
    const zdt = Temporal.Now.zonedDateTimeISO(timeZone);

    const hour12 = zdt.hour % 12 || 12;
    const minute = zdt.minute.toString().padStart(2, '0');
    const second = zdt.second.toString().padStart(2, '0');
    const ampm = zdt.hour >= 12 ? 'PM' : 'AM';

    const timeString = `${hour12}:${minute}:${second} ${ampm}`;

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const dayName = dayNames[zdt.dayOfWeek - 1] ?? 'Today';
    const monthName = monthNames[zdt.month - 1] ?? '';
    const dateString = `${dayName}, ${monthName} ${zdt.day}, ${zdt.year}`;

    return { timeString, dateString, zdt };
  } catch {
    // Fallback if timezone invalid
    const now = new Date();
    return {
      timeString: now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      dateString: now.toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      zdt: null,
    };
  }
};

export const formatMeetingDate = (isoString: string): string => {
  try {
    const instant = Temporal.Instant.from(isoString);
    const zdt = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
    const month = zdt.month.toString().padStart(2, '0');
    const day = zdt.day.toString().padStart(2, '0');
    const hour = (zdt.hour % 12 || 12).toString().padStart(2, '0');
    const min = zdt.minute.toString().padStart(2, '0');
    const ampm = zdt.hour >= 12 ? 'PM' : 'AM';
    return `${zdt.year}-${month}-${day} at ${hour}:${min} ${ampm}`;
  } catch {
    return new Date(isoString).toLocaleString();
  }
};

export const formatMeetingDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hrs = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
};
