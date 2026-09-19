// api/_utils/intraday/etTime.js
// ET calendar parts of an epoch-ms instant via Intl (`America/New_York`) —
// the BUILD_RULES §6 pattern, the same formula as marketDataCache.toEtParts
// (kept here so the intraday runners import no Firebase-bearing module).
// Pure: the instant is an argument.

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** @returns {{ dateStr: string, hour: number, minute: number, minuteOfDay: number }} */
export function etPartsOf(ms) {
  const parts = FMT.formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(get('minute'), 10);
  return { dateStr: `${get('year')}-${get('month')}-${get('day')}`, hour, minute, minuteOfDay: hour * 60 + minute };
}

export const etDateOf = (ms) => etPartsOf(ms).dateStr;
