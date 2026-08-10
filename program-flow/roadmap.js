import { renderRoadmap } from "./roadmap-timeline.js";
import { appendNewsImpact } from "./news-impact.js";
import {
  historyStatusExplanationHref,
  moduleExplanationHref,
  moduleMapHref
} from "./explanation-links.js";
import {
  createDailyWorklog,
  formatDate,
  historyStatusLabel,
  statusLabel,
  word
} from "./status-copy.js";
import { roadmapVersionCopy } from "./version-lineage-copy.js";

const DATA_ROOT = "../data";
const WORKLOG_PAGE_SIZE = 8;
const HISTORY_CHOICES = [
  { id: "all", label: "Вся история", description: "Здесь показана вся история работы." },
  {
    id: "product",
    label: "Изменения в программе",
    description: "Показаны изменения расчёта, данных, схемы и экрана программы."
  },
  {
    id: "portal",
    label: "Портал и публикация",
    description: "Показаны изменения этого сайта и автоматической публикации."
  },
  {
    id: "external",
    label: "Внешние подключения",
    description: "Показаны работы по сохранению проектов и подключению внешних программ."
  }
];
openTargetDisclosure();
window.addEventListener("hashchange", openTargetDisclosure);
main().catch(showLoadError);

function openTargetDisclosure() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  let disclosure = target;
  while (disclosure) {
    if (disclosure instanceof HTMLDetailsElement) disclosure.open = true;
    disclosure = disclosure.parentElement?.closest("details");
  }
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
}

async function main() {
  const [status, worklog, deployment] = await Promise.all([
    fetchJson(`${DATA_ROOT}/project-status.json`),
    fetchJson(`${DATA_ROOT}/worklog.json`),
    fetchJson(`${DATA_ROOT}/deployment.json`)
  ]);

  const moduleMap = new Map(status.modules.map((module) => [module.id, module]));
  renderHeader(status, deployment);
  renderRoadmap(status.roadmap, moduleMap, status.stage);
  const productCurrent = status.current.filter((item) => isProductModule(item.moduleId));
  renderItems("currentList", productCurrent.length > 0 ? productCurrent : status.current,
    (item) => createCurrentFocusItem(item, moduleMap));
  renderItems("nextList", selectNext(status), (item) => createNextFocusItem(item, moduleMap));
  renderLimitations(status.limitations);
  renderExpectations(status.expectations);
  renderWorklog(worklog.entries, moduleMap);
  document.querySelector(".roadmap-shell").dataset.loadState = "ready";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function renderHeader(status, deployment) {
  setText("stageLabel", status.stage.label);
  setText("stageSummary", status.stage.summary);
  setText("stageProgress", status.stage.progress);
  setText("updatedAt", formatDate(status.updatedAt));
  const version = roadmapVersionCopy(deployment);
  const deploymentProof = document.getElementById("deploymentSha");
  deploymentProof.textContent = version.publicationLabel;
  deploymentProof.title = version.publicationTitle;
  const check = document.getElementById("deploymentCheck");
  check.textContent = version.releaseLabel;
  check.dataset.tone = version.releaseState;
}

function selectNext(status) {
  const primary = status.next.find((item) => item.id === status.managerOverview.primaryNextId);
  const product = status.next.filter((item) => isProductModule(item.moduleId) && item !== primary);
  return [primary, ...product].filter(Boolean).slice(0, 3);
}

function renderItems(containerId, items, factory) {
  const container = document.getElementById(containerId);
  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.append(factory(item)));
  container.replaceChildren(fragment);
}

function createCurrentFocusItem(item, moduleMap) {
  return createFocusItem(item, moduleMap, statusLabel(item.status), item.summary);
}

function createNextFocusItem(item, moduleMap) {
  return createFocusItem(item, moduleMap, item.priority, item.expected);
}

function createFocusItem(item, moduleMap, state, summary) {
  const row = createElement("article", "focus-item");
  const meta = createElement("div", "focus-item__meta");
  meta.append(createModuleTag(requireModule(moduleMap, item.moduleId)));
  meta.append(createElement("span", "", state));
  row.append(meta, createElement("h3", "", item.title), createElement("p", "", summary));
  return row;
}

function createModuleTag(module) {
  const tag = createElement("a", "module-tag", module.label);
  tag.dataset.domain = module.id;
  tag.href = moduleExplanationHref(module.id);
  tag.setAttribute("aria-label", `Открыть описание части программы «${module.label}»`);
  tag.title = module.description;
  return tag;
}

function renderLimitations(items) {
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const row = createElement("li");
    row.append(createElement("span", "limit-mark", "!"));
    row.append(createElement("p", "", item));
    fragment.append(row);
  });
  document.getElementById("limitationsList").replaceChildren(fragment);
}

function renderExpectations(items) {
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const row = createElement("article", "expectation");
    row.append(createElement("span", "", item.horizon));
    row.append(createElement("p", "", item.text));
    fragment.append(row);
  });
  document.getElementById("expectationsList").replaceChildren(fragment);
}

function renderWorklog(entries, moduleMap) {
  const published = entries;
  const state = {
    moduleId: readModuleFilter(),
    expanded: false
  };
  const buttons = createModuleFilters(published, (moduleId) => {
    state.moduleId = moduleId;
    state.expanded = false;
    writeModuleFilter(moduleId);
    updateWorklog(published, moduleMap, state, buttons);
  });
  document.getElementById("worklogMore").addEventListener("click", () => {
    state.expanded = true;
    updateWorklog(published, moduleMap, state, buttons);
  });
  updateWorklog(published, moduleMap, state, buttons);
}

function createModuleFilters(entries, onSelect) {
  const root = document.getElementById("moduleFilters");
  const buttons = new Map();
  const choices = HISTORY_CHOICES.map((choice) => ({
    ...choice,
    count: createDailyWorklog(entries.filter((entry) => matchesHistoryChoice(entry, choice.id))).length
  }));
  const nodes = choices.map((choice) => {
    const label = word(choice.count, "день", "дня", "дней");
    const button = createElement("button", "module-filter", `${choice.label} · ${choice.count} ${label}`);
    button.type = "button";
    button.setAttribute("aria-controls", "worklogList");
    button.addEventListener("click", () => onSelect(choice.id));
    buttons.set(choice.id, button);
    return button;
  });
  root.replaceChildren(...nodes);
  return buttons;
}

function updateWorklog(entries, moduleMap, state, buttons) {
  const filtered = createDailyWorklog(entries.filter((entry) => matchesHistoryChoice(entry, state.moduleId))).reverse();
  const visible = state.expanded ? filtered : filtered.slice(0, WORKLOG_PAGE_SIZE);
  renderWorklogEntries(visible, moduleMap);
  buttons.forEach((button, moduleId) => {
    button.setAttribute("aria-pressed", String(moduleId === state.moduleId));
  });
  const selected = HISTORY_CHOICES.find((choice) => choice.id === state.moduleId);
  setText("moduleDescription", selected?.description || HISTORY_CHOICES[0].description);
  setText("worklogFilterStatus", `${filtered.length} ${word(filtered.length, "день", "дня", "дней")}`);
  const more = document.getElementById("worklogMore");
  more.hidden = state.expanded || filtered.length <= WORKLOG_PAGE_SIZE;
  more.textContent = `Показать ещё ${Math.max(0, filtered.length - WORKLOG_PAGE_SIZE)}`;
}

function renderWorklogEntries(entries, moduleMap) {
  const list = document.getElementById("worklogList");
  if (entries.length === 0) {
    list.replaceChildren(createElement("li", "worklog-empty", "Для этой части программы записей пока нет."));
    return;
  }
  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => fragment.append(createWorklogRow(entry, moduleMap)));
  list.replaceChildren(fragment);
}

function createWorklogRow(entry, moduleMap) {
  const row = createElement("li", "worklog-entry");
  row.dataset.entryCount = String(entry.dailyEntryCount ?? 1);
  const date = createElement("time", "", formatDate(entry.date));
  date.dateTime = entry.date;
  const content = createElement("div");
  const meta = createElement("div", "worklog-entry__meta");
  if (entry.dailyGroups?.length) {
    const count = entry.dailyGroups.length;
    const digestLink = createElement("a", "worklog-entry__digest-label",
      `${count} ${word(count, "функциональный блок", "функциональных блока", "функциональных блоков")}`);
    digestLink.href = moduleMapHref();
    digestLink.setAttribute("aria-label", `Открыть объяснение функциональных блоков; количество: ${count}`);
    meta.append(digestLink);
  } else {
    meta.append(createModuleTag(requireModule(moduleMap, entry.moduleId)));
  }
  const statusLabel = historyStatusLabel(entry.status);
  const statusLink = createElement("a", "worklog-entry__status", statusLabel);
  statusLink.href = historyStatusExplanationHref(entry.status);
  statusLink.setAttribute("aria-label", `Что значит статус «${statusLabel}»`);
  meta.append(statusLink);
  content.append(meta, createElement("h3", "", entry.title));
  appendNewsImpact(content, entry, moduleMap, createElement, { collapsible: true });
  row.append(date, content);
  return row;
}

function readModuleFilter() {
  const candidate = new URLSearchParams(window.location.search).get("module");
  return HISTORY_CHOICES.some((choice) => choice.id === candidate) ? candidate : "all";
}

function matchesHistoryChoice(entry, choiceId) {
  if (choiceId === "all") return true;
  if (choiceId === "portal") return entry.moduleId === "adapter";
  if (choiceId === "external") return entry.moduleId === "integration";
  return isProductModule(entry.moduleId);
}

function isProductModule(moduleId) {
  return moduleId !== "adapter" && moduleId !== "integration";
}

function writeModuleFilter(moduleId) {
  const url = new URL(window.location.href);
  if (moduleId === "all") url.searchParams.delete("module");
  else url.searchParams.set("module", moduleId);
  window.history.replaceState(null, "", url);
}

function requireModule(moduleMap, moduleId) {
  const module = moduleMap.get(moduleId);
  if (!module) throw new Error(`Неизвестная часть программы: ${moduleId}`);
  return module;
}

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function showLoadError(error) {
  console.error(error);
  const loadError = document.getElementById("loadError");
  const snapshotDate = document.getElementById("updatedAt")?.textContent.trim();
  loadError.textContent = snapshotDate && snapshotDate !== "—"
    ? `Показана последняя опубликованная сводка от ${snapshotDate}. Более свежие сведения сейчас недоступны.`
    : "Показана сохранённая сводка. Более свежие сведения сейчас недоступны.";
  loadError.hidden = false;
  document.querySelector(".roadmap-shell").dataset.loadState = "error";
}
