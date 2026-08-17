import { laneProgressLabel } from "./status-copy.js";

const PULSE_STATUSES = new Set(["done", "doing", "planned", "blocked", "conditional"]);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-project-pulse]").forEach(renderProjectPulse);
});

async function renderProjectPulse(mount) {
  try {
    const response = await fetch(mount.dataset.statusSource, { cache: "no-store" });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const status = await response.json();
    const lanes = readPulseLanes(status);
    mount.replaceChildren(createPulseLink(mount.dataset.statusHref, status.updatedAt, lanes));
    mount.dataset.loadState = "ready";
  } catch (error) {
    const snapshotLink = mount.querySelector(".project-pulse__link");
    const snapshotMeta = mount.querySelector(".project-pulse__meta");
    if (snapshotLink && snapshotMeta) {
      snapshotMeta.append(" · обновление недоступно");
      snapshotLink.title = `Показан сохранённый снимок от ${formatPulseDate(mount.dataset.snapshotDate)}`;
      mount.dataset.loadState = "error";
      console.error("project pulse failed", error);
      return;
    }
    const message = document.createElement("a");
    message.className = "project-pulse__error";
    message.href = mount.dataset.statusHref;
    message.textContent = "Сведения о проекте временно недоступны. Открыть страницу проекта →";
    mount.replaceChildren(message);
    mount.dataset.loadState = "error";
    console.error("project pulse failed", error);
  }
}

function readPulseLanes(status) {
  const lanes = status?.roadmap?.lanes;
  if (!Array.isArray(lanes) || lanes.length === 0) throw new Error("roadmap lanes are missing");
  if (lanes.some((lane) => !PULSE_STATUSES.has(lane.status))) throw new Error("unknown roadmap status");
  return lanes;
}

function createPulseLink(href, updatedAt, lanes) {
  const counts = countLanes(lanes);
  const link = document.createElement("a");
  link.className = "project-pulse__link";
  link.href = href;
  link.title = `Сведения обновлены ${formatPulseDate(updatedAt)}`;
  const remaining = [`в работе: ${counts.doing}`, `запланировано: ${counts.planned}`];
  if (counts.conditional > 0) remaining.push(`после других работ: ${counts.conditional}`);
  if (counts.blocked > 0) remaining.push(`приостановлено: ${counts.blocked}`);
  const meta = createPulseText("project-pulse__meta", `${remaining.join(" · ")} · обновлено: `);
  meta.append(createPulseDate(updatedAt));
  link.append(
    createPulseText("project-pulse__kicker", "Состояние проекта"),
    createPulseValue(laneProgressLabel(counts)),
    meta,
    createPulseText("project-pulse__arrow", "→")
  );
  return link;
}

function countLanes(lanes) {
  const counts = { done: 0, doing: 0, planned: 0, conditional: 0, blocked: 0, total: lanes.length };
  for (const lane of lanes) counts[lane.status] += 1;
  return counts;
}

function createPulseValue(label) {
  const value = document.createElement("span");
  value.className = "project-pulse__value";
  const number = document.createElement("b");
  number.textContent = label;
  value.append(number);
  return value;
}

function createPulseText(className, text) {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function createPulseDate(updatedAt) {
  const value = document.createElement("time");
  value.id = "projectPulseDate";
  value.dateTime = updatedAt;
  value.textContent = formatPulseDate(updatedAt);
  return value;
}

function formatPulseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return "не определено";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
  }).format(date);
}
