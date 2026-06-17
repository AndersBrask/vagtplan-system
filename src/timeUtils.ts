// Tids-hjælpere — porteret fra backend/core/utils.py.
// Vi regner i minutter-siden-midnat. "HH:MM"-strenge er nul-paddede,
// så leksikografisk sammenligning (<, <=) svarer til tidsmæssig orden,
// præcis som i den oprindelige Python-kode.

export function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(t: string, minutes: number): string {
  return formatTime(parseTime(t) + minutes);
}

export function subtractMinutes(t: string, minutes: number): string {
  return formatTime(parseTime(t) - minutes);
}

/** Giver [slot_start, slot_end]-par for hele intervallet. */
export function generateTimeSlots(
  start: string,
  end: string,
  slotMinutes: number
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let current = parseTime(start);
  const endM = parseTime(end);
  while (current < endM) {
    const slotEnd = current + slotMinutes;
    out.push([formatTime(current), formatTime(slotEnd)]);
    current = slotEnd;
  }
  return out;
}

/** Varighed af et slot i timer. */
export function slotDurationInHours(slot: { start: string; end: string }): number {
  return (parseTime(slot.end) - parseTime(slot.start)) / 60;
}
