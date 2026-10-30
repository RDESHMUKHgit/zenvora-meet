import { Temporal } from '@js-temporal/polyfill';

/**
 * Returns current UTC timestamp as an ISO-8601 string using Temporal API.
 */
export const nowIso = (): string => {
  return Temporal.Now.instant().toString();
};

/**
 * Adds days/hours/minutes/seconds to current Temporal instant and returns ISO string.
 * Converts days to hours (24h/day) to safely add to Temporal.Instant without daylight ambiguity.
 */
export const futureIso = (duration: {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}): string => {
  const totalHours = (duration.hours || 0) + (duration.days ? duration.days * 24 : 0);
  return Temporal.Now.instant()
    .add({
      hours: totalHours,
      minutes: duration.minutes || 0,
      seconds: duration.seconds || 0,
    })
    .toString();
};

/**
 * Determines whether a given ISO-8601 timestamp has expired relative to current Temporal instant.
 */
export const isExpired = (isoString: string): boolean => {
  const target = Temporal.Instant.from(isoString);
  const now = Temporal.Now.instant();
  return Temporal.Instant.compare(now, target) > 0;
};

/**
 * Calculates session expiration string based on days count.
 */
export const calculateSessionExpiry = (days = 7): string => {
  return futureIso({ days });
};
