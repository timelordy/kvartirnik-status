const MONTH_NAMES = new Map([
  ["jan", "январь"], ["feb", "февраль"], ["mar", "март"], ["apr", "апрель"],
  ["may", "май"], ["jun", "июнь"], ["jul", "июль"], ["aug", "август"],
  ["sep", "сентябрь"], ["oct", "октябрь"], ["nov", "ноябрь"], ["dec", "декабрь"]
]);

export function formatRoadmapWindow(horizons, from, to) {
  const start = parseHorizon(requireHorizon(horizons, from));
  const end = parseHorizon(requireHorizon(horizons, to));
  if (from === to) return `${start.monthName} ${start.year}`;
  if (start.year === end.year) return `${start.monthName}–${end.monthName} ${start.year}`;
  return `${start.monthName} ${start.year} – ${end.monthName} ${end.year}`;
}

export function formatRoadmapBarWindow(horizons, from, to) {
  const start = requireHorizon(horizons, from);
  const end = requireHorizon(horizons, to);
  return from === to ? start.label : `${start.label}–${end.label}`;
}

export function resolveHorizonIndex(horizons, id) {
  const index = horizons.findIndex((horizon) => horizon.id === id);
  if (index < 0) throw new Error(`Неизвестный месяц плана: ${id}`);
  return index;
}

export function resolveRoadmapDatePosition(horizons, dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const monthKey = Array.from(MONTH_NAMES.keys())[date.getUTCMonth()];
  const horizonId = `${monthKey}-${date.getUTCFullYear()}`;
  const horizonIndex = horizons.findIndex((horizon) => horizon.id === horizonId);
  if (horizonIndex < 0) return null;
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const monthFraction = (date.getUTCDate() - 0.5) / daysInMonth;
  return ((horizonIndex + monthFraction) / horizons.length) * 100;
}

export function formatRoadmapDate(dateText) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${dateText}T00:00:00Z`));
}

function requireHorizon(horizons, id) {
  const horizon = horizons.find((candidate) => candidate.id === id);
  if (!horizon) throw new Error(`Неизвестный месяц плана: ${id}`);
  return horizon;
}

function parseHorizon(horizon) {
  const [monthKey, yearText] = horizon.id.split("-");
  const monthName = MONTH_NAMES.get(monthKey);
  if (!monthName || !/^\d{4}$/.test(yearText)) throw new Error(`Некорректный месяц плана: ${horizon.id}`);
  return { monthName, year: Number(yearText) };
}
