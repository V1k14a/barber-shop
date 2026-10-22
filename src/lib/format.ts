/** 35000 øre → "350 kr." (decimals only when needed: 37550 → "375,50 kr.") */
export function formatPrice(ore: number): string {
  const kr = ore / 100;
  const text = Number.isInteger(kr)
    ? kr.toLocaleString("da-DK")
    : kr.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${text} kr.`;
}

/** 75 → "1 h 15 min", 45 → "45 min" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
