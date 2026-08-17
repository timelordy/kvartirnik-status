import { applyAuthoredWorklogCopy } from "./worklog-public-copy.js";

export function countStatuses(lanes) {
  return lanes.reduce((counts, lane) => {
    counts[lane.status] = (counts[lane.status] || 0) + 1;
    return counts;
  }, { done: 0, doing: 0, planned: 0, conditional: 0, blocked: 0, total: lanes.length });
}

/* «Подтверждено: 1» стояло на пяти страницах и ничего не означало: один
   результат, один этап, один модуль, один тест? Число без знаменателя — это не
   факт, а повод для догадки. */
export function laneProgressLabel(counts) {
  return `Готово ${counts.done} из ${counts.total} направлений`;
}

export function collapseWorklog(entries) {
  const corrected = new Set(entries.map((entry) => entry.correctsDateOf).filter(Boolean));
  const visible = entries.filter((entry) => !corrected.has(entry.id));
  const finished = new Set(visible
    .filter((entry) => entry.status === "done" && entry.id.endsWith("-done"))
    .map((entry) => entry.id.slice(0, -5)));
  return visible.filter((entry) => !(entry.status === "doing"
    && entry.id.endsWith("-start")
    && finished.has(entry.id.slice(0, -6))));
}

export function createDailyWorklog(entries) {
  const entriesByDate = new Map();
  collapseWorklog(entries).forEach((entry) => {
    const dailyEntries = entriesByDate.get(entry.date) ?? [];
    dailyEntries.push(entry);
    entriesByDate.set(entry.date, dailyEntries);
  });
  return Array.from(entriesByDate, ([date, dailyEntries]) => createDailyWorklogEntry(date, dailyEntries))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function isProductWorklogEntry(entry) {
  return !["adapter", "integration"].includes(entry.moduleId);
}

function createDailyWorklogEntry(date, entries) {
  if (entries.length === 1) return toDailyWorklogEntry(entries[0]);
  const publicEntries = entries.map(toDailyWorklogEntry);
  const moduleIds = unique(publicEntries.flatMap((entry) => entry.impact?.moduleIds?.length
    ? entry.impact.moduleIds
    : [entry.moduleId]));
  const changes = publicEntries.map((entry) => entry.impact?.changed || entry.summary);
  const used = publicEntries.map((entry) => entry.impact?.used).filter(Boolean);
  return {
    id: `daily-${date}`,
    moduleId: entries.at(-1).moduleId,
    date,
    status: resolveDailyStatus(entries),
    title: `Итоги дня: ${entries.length} ${word(entries.length, "изменение", "изменения", "изменений")}`,
    summary: entries.map((entry) => entry.title).join(" · "),
    dailyEntryCount: entries.length,
    dailyGroups: createDailyGroups(publicEntries),
    impact: {
      moduleIds,
      used: numberedSummary(used),
      changed: numberedSummary(changes)
    }
  };
}

function resolveDailyStatus(entries) {
  if (entries.some((entry) => entry.status === "blocked")) return "blocked";
  if (entries.some((entry) => entry.status === "doing")) return "doing";
  return "done";
}

function createDailyGroups(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const group = groups.get(entry.moduleId) ?? { moduleId: entry.moduleId, entries: [] };
    group.entries.push(entry);
    groups.set(entry.moduleId, group);
  });
  return Array.from(groups.values(), (group) => ({
    ...group,
    entryCount: group.entries.length,
    moduleIds: unique(group.entries.flatMap((entry) => entry.impact?.moduleIds?.length
      ? entry.impact.moduleIds
      : [entry.moduleId]))
  }));
}

function toDailyWorklogEntry(entry) {
  const publicEntry = applyAuthoredWorklogCopy(entry);
  return {
    ...publicEntry,
    dailyEntryCount: 1,
    impact: publicEntry.impact && { ...publicEntry.impact }
  };
}

function numberedSummary(items) {
  return unique(items).map((item, index) => `${index + 1}. ${item}`).join(" ");
}

function unique(items) {
  return [...new Set(items)];
}

export function statusLabel(status) {
  return {
    blocked: "приостановлено",
    conditional: "зависит от других работ",
    doing: "в работе",
    done: "готово",
    local: "проверяется",
    planned: "запланировано"
  }[status] || status;
}

export function historyStatusLabel(status) {
  return { blocked: "приостановлено", doing: "в работе", done: "готово" }[status] || status;
}

export function formatDate(value, options = {}) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: options.short ? "2-digit" : "numeric",
    month: options.short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function shortSha(value, fallback = "нет данных") {
  return /^[0-9a-f]{40}$/u.test(value || "") ? value.slice(0, 8) : fallback;
}

export function word(value, one, few, many) {
  const tens = value % 100;
  const units = value % 10;
  if (tens >= 11 && tens <= 19) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}
