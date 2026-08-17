import {
  formatRoadmapBarWindow,
  formatRoadmapDate,
  formatRoadmapWindow,
  resolveHorizonIndex,
  resolveRoadmapDatePosition
} from "./roadmap-dates.js";

const ROADMAP_STATUS_ORDER = ["done", "doing", "planned", "conditional", "blocked"];

export function renderRoadmap(roadmap, moduleMap, stage) {
  setText("roadmapSummary", roadmap.summary);
  setText("roadmapBasis", roadmap.basis);
  renderForecast(roadmap.forecast, roadmap.milestones, stage);
  renderRoadmapOverview(roadmap.lanes);
  renderRoadmapLegend(roadmap.lanes);
  const laneNames = new Map(roadmap.lanes.map((lane) => [lane.id, lane.title]));
  document.getElementById("roadmapTimeline").replaceChildren(createTimelineBoard(roadmap, moduleMap));
  document.getElementById("roadmapDetails").replaceChildren(
    ...roadmap.lanes.map((lane, index) => createRoadmapDetail(lane, index, roadmap, laneNames, moduleMap))
  );
}

function renderForecast(forecast, milestones, stage) {
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${forecast.asOf}T00:00:00`));
  setText("roadmapCurrentStage", stage.label);
  setText("roadmapCurrentProgress", stage.progress);
  renderRouteMilestone(milestones, "prototype", "roadmapPrototype");
  renderRouteMilestone(milestones, "testing", "roadmapTesting");
  setText("roadmapForecastLabel", `Целевой запуск · план от ${date}`);
  setText("roadmapForecastWindow", forecast.window);
  setText("roadmapForecastTarget", forecast.target);
  setText("roadmapForecastBasis", forecast.basis);
  setText("roadmapForecastReview", forecast.review);
  setText("roadmapOverviewForecast", forecast.window);
}

function renderRouteMilestone(milestones, kind, prefix) {
  const milestone = milestones.find((item) => item.kind === kind);
  if (!milestone) return;
  setText(`${prefix}Date`, milestone.date);
  setText(`${prefix}Title`, milestone.title);
}

function renderRoadmapOverview(lanes) {
  if (lanes.length === 0) return renderEmptyOverview();
  const counts = countStatuses(lanes);
  const remaining = lanes.length - counts.get("done");
  const summary = ROADMAP_STATUS_ORDER
    .filter((status) => counts.get(status) > 0)
    .map((status) => roadmapCountLabel(status, counts.get(status)));
  setText("roadmapProgress", summary.join(" · "));
  setText("roadmapRemaining", `Осталось завершить ${remaining} ${directionCountLabel(remaining)}`);
}

function renderEmptyOverview() {
  setText("roadmapProgress", "План не заполнен");
  setText("roadmapRemaining", "Части плана ещё не описаны");
}

function renderRoadmapLegend() {
  const items = ROADMAP_STATUS_ORDER.map((status) => {
    const item = createElement("span", "", `${statusMark(status)} ${statusLabel(status)}`);
    item.dataset.roadmapStatus = status;
    return item;
  });
  document.getElementById("roadmapLegend").replaceChildren(...items);
}

function createTimelineBoard(roadmap, moduleMap) {
  const board = createElement("div", "timeline-board");
  const nowPosition = resolveRoadmapDatePosition(roadmap.horizons, roadmap.forecast.asOf);
  board.style.setProperty("--timeline-columns", roadmap.horizons.length);
  board.style.setProperty("--timeline-lanes", roadmap.lanes.length);
  if (nowPosition !== null) board.style.setProperty("--timeline-now-position", `${nowPosition}%`);
  board.append(createTimelineAxis(roadmap.horizons, roadmap.lanes.length));
  board.append(createTimelineMilestones(roadmap.milestones, roadmap.horizons));
  board.append(createMobileAxis(roadmap.horizons, roadmap.forecast.asOf, nowPosition));
  board.append(createTimelineList(roadmap, moduleMap));
  board.append(createTimelineOverlay(roadmap, nowPosition));
  return board;
}

function createTimelineAxis(horizons, laneCount) {
  const axis = createElement("div", "timeline-axis");
  axis.append(createElement("span", "timeline-axis__title", `${laneCount} ${directionCountLabel(laneCount)}`));
  const calendar = createElement("div", "timeline-axis__calendar");
  calendar.append(createYearBands(horizons));
  const months = createElement("div", "timeline-axis__periods");
  horizons.forEach((horizon, index) => {
    const period = createElement("span", "timeline-period", horizon.label);
    if (index % 3 === 0) period.dataset.quarterStart = "true";
    months.append(period);
  });
  calendar.append(months);
  axis.append(calendar);
  return axis;
}

function createYearBands(horizons) {
  const years = createElement("div", "timeline-axis__years");
  let start = 0;
  while (start < horizons.length) {
    const year = horizons[start].detail;
    let end = start + 1;
    while (end < horizons.length && horizons[end].detail === year) end += 1;
    const band = createElement("span", "", year);
    band.style.gridColumn = `${start + 1} / span ${end - start}`;
    years.append(band);
    start = end;
  }
  return years;
}

function createTimelineMilestones(milestones, horizons) {
  const row = createElement("div", "timeline-milestones");
  row.append(createElement("span", "timeline-milestones__title", "Ключевые даты"));
  const track = createElement("div", "timeline-milestones__track");
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", milestones.map((item) => `${item.date}: ${item.title}`).join(". "));
  const labelBands = createMilestoneLabelBands(milestones, horizons);
  milestones.forEach((milestone, index) => track.append(createMilestone(milestone, horizons, labelBands[index])));
  row.append(track);
  return row;
}

function createMilestoneLabelBands(milestones, horizons) {
  const indexes = milestones.map((milestone) => resolveHorizonIndex(horizons, milestone.horizon));
  return indexes.map((horizonIndex, index) => {
    const start = index === 0
      ? Math.floor(horizonIndex / 3) * 3
      : Math.floor((indexes[index - 1] + horizonIndex + 1) / 2);
    const end = index === indexes.length - 1
      ? horizons.length
      : Math.floor((horizonIndex + indexes[index + 1] + 1) / 2);
    return { start: start + 1, end: Math.max(start + 1, end) + 1 };
  });
}

function createMilestone(milestone, horizons, labelBand) {
  const marker = createElement("div", "timeline-milestone");
  marker.dataset.milestoneKind = milestone.kind;
  const horizonIndex = resolveHorizonIndex(horizons, milestone.horizon);
  marker.style.setProperty("--milestone-column", horizonIndex + 1);
  marker.style.setProperty("--milestone-label-start", labelBand.start);
  marker.style.setProperty("--milestone-label-end", labelBand.end);
  marker.style.setProperty("--milestone-position", `${(horizonIndex + 0.5) / horizons.length * 100}%`);
  const pin = createElement("i", "timeline-milestone__pin");
  pin.setAttribute("aria-hidden", "true");
  const label = createElement("span", "timeline-milestone__label");
  label.append(createElement("small", "", milestone.date), createElement("strong", "", milestone.title));
  marker.append(pin, label);
  return marker;
}

function createMobileAxis(horizons, dateText, nowPosition) {
  const axis = createElement("div", "timeline-mobile-axis");
  const anchors = [horizons[0], horizons[Math.floor(horizons.length / 2)], horizons.at(-1)];
  anchors.forEach((horizon) => axis.append(createElement("span", "", `${horizon.label} ${horizon.detail}`)));
  if (nowPosition !== null) {
    const now = createElement("i", "timeline-mobile-axis__now", `Сейчас · ${formatRoadmapDate(dateText)}`);
    now.style.setProperty("--timeline-now-position", `${nowPosition}%`);
    axis.append(now);
  }
  return axis;
}

function createTimelineList(roadmap, moduleMap) {
  const list = createElement("ol", "timeline-list");
  roadmap.lanes.forEach((lane, index) => {
    list.append(createTimelineLane(lane, index, roadmap.lanes.length, roadmap.horizons, moduleMap));
  });
  return list;
}

function createTimelineLane(lane, index, total, horizons, moduleMap) {
  const row = createElement("li", "timeline-row");
  row.dataset.roadmapStatus = lane.status;
  row.append(createTimelineLabel(lane, index, total, horizons, moduleMap));
  row.append(createTimelineTrack(lane, index, total, horizons));
  return row;
}

function createTimelineLabel(lane, index, total, horizons, moduleMap) {
  const label = createElement("div", "timeline-row__label");
  const meta = createElement("div", "timeline-row__meta");
  meta.append(createElement("span", "timeline-row__number", `Направление ${index + 1} из ${total}`));
  meta.append(createModuleTag(requireModule(moduleMap, lane.moduleId)));
  meta.append(createElement("span", "timeline-row__status", `${statusMark(lane.status)} ${statusLabel(lane.status)}`));
  label.append(meta, createElement("h3", "", lane.title));
  label.append(createElement("small", "timeline-row__window", formatRoadmapWindow(horizons, lane.from, lane.to)));
  return label;
}

function createTimelineTrack(lane, index, total, horizons) {
  const start = resolveHorizonIndex(horizons, lane.from) + 1;
  const end = resolveHorizonIndex(horizons, lane.to) + 1;
  const track = createElement("div", "timeline-track");
  const bar = createElement("div", "timeline-bar");
  const windowText = formatRoadmapWindow(horizons, lane.from, lane.to);
  const barWindowText = formatRoadmapBarWindow(horizons, lane.from, lane.to);
  bar.style.setProperty("--timeline-start", start);
  bar.style.setProperty("--timeline-span", end - start + 1);
  bar.dataset.duration = String(end - start + 1);
  bar.title = windowText;
  bar.append(createElement("span", "timeline-bar__label", barWindowText));
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", `Направление ${index + 1} из ${total}. ${lane.title}. ${statusLabel(lane.status)}. Ориентир: ${windowText}.`);
  track.append(bar);
  return track;
}

function createTimelineOverlay(roadmap, nowPosition) {
  const overlay = createElement("div", "timeline-overlay");
  overlay.setAttribute("aria-hidden", "true");
  const track = createElement("div", "timeline-overlay__track");
  roadmap.milestones.forEach((milestone) => {
    const position = ((resolveHorizonIndex(roadmap.horizons, milestone.horizon) + 0.5) / roadmap.horizons.length) * 100;
    const line = createElement("i", "timeline-guide-line timeline-guide-line--milestone");
    line.style.left = `${position}%`;
    track.append(line);
  });
  if (nowPosition !== null) {
    const line = createElement("i", "timeline-guide-line timeline-guide-line--now");
    line.style.left = `${nowPosition}%`;
    line.append(createElement("span", "", `Сейчас · ${formatRoadmapDate(roadmap.forecast.asOf)}`));
    track.append(line);
  }
  overlay.append(track);
  return overlay;
}

function createRoadmapDetail(lane, index, roadmap, laneNames, moduleMap) {
  const details = createElement("details", "roadmap-detail");
  details.dataset.roadmapStatus = lane.status;
  details.append(createRoadmapDetailSummary(lane, index, roadmap, moduleMap));
  const body = createElement("div", "roadmap-detail__body");
  const outcome = createElement("div", "roadmap-detail__outcome roadmap-detail__hint roadmap-detail__hint--result");
  outcome.append(createElement("span", "", "Что должно получиться"), createElement("p", "", lane.summary));
  body.append(outcome);
  if (lane.status !== "done") body.append(createForecastConfidence(lane));
  if (lane.dependsOn.length > 0) body.append(createDependency(lane, laneNames));
  body.append(createGate(lane.status === "done" ? "Чем подтверждено" : "Что может сдвинуть срок", lane.estimate.risk, lane.status !== "done" ? "risk" : "ready"));
  body.append(createGate("Как поймём, что готово", lane.checkpoint, "ready"));
  details.append(body);
  return details;
}

function createRoadmapDetailSummary(lane, index, roadmap, moduleMap) {
  const summary = document.createElement("summary");
  const windowText = formatRoadmapWindow(roadmap.horizons, lane.from, lane.to);
  const module = requireModule(moduleMap, lane.moduleId);
  summary.setAttribute("aria-label", `Направление ${index + 1} из ${roadmap.lanes.length}. ${lane.title}. Область: ${module.label}. ${statusLabel(lane.status)}. Срок: ${windowText}.`);
  const heading = createElement("h3", "roadmap-detail__heading");
  heading.setAttribute("aria-label", lane.title);
  const number = createElement("span", "roadmap-detail__number", `Направление ${index + 1} из ${roadmap.lanes.length}`);
  number.setAttribute("aria-label", `Направление ${index + 1} из ${roadmap.lanes.length}`);
  const title = createElement("span", "roadmap-detail__title", lane.title);
  const meta = createElement("span", "roadmap-detail__meta");
  meta.append(createDetailArea(module), createElement("small", "", `Срок: ${windowText}`));
  heading.append(number, title, meta, createElement("span", "roadmap-detail__status", `${statusMark(lane.status)} ${statusLabel(lane.status)}`));
  summary.append(heading);
  return summary;
}

function createForecastConfidence(lane) {
  const block = createElement("p", "roadmap-detail__forecast roadmap-detail__hint roadmap-detail__hint--forecast");
  block.append(createElement("span", "", "Надёжность прогноза"));
  block.append(createElement("strong", "", confidenceLabel(lane.estimate.confidence)));
  return block;
}

function createDependency(lane, laneNames) {
  const names = lane.dependsOn.map((id) => laneNames.get(id)).join(", ");
  const dependency = createElement("div", "timeline-dependency roadmap-detail__hint roadmap-detail__hint--dependency");
  const label = lane.status === "doing" ? "Для окончательной готовности нужны" : "Сначала нужно завершить";
  dependency.append(createElement("span", "", label), createElement("p", "", names));
  return dependency;
}

function createGate(label, text, tone) {
  const riskClass = tone === "risk" ? " timeline-gate--risk" : "";
  const gate = createElement("div", `timeline-gate${riskClass} roadmap-detail__hint roadmap-detail__hint--${tone}`);
  gate.append(createElement("span", "", label), createElement("p", "", text));
  return gate;
}

function countStatuses(lanes) {
  const counts = new Map(ROADMAP_STATUS_ORDER.map((status) => [status, 0]));
  lanes.forEach((lane) => counts.set(lane.status, (counts.get(lane.status) || 0) + 1));
  return counts;
}

function roadmapCountLabel(status, count) {
  return {
    done: `Готово: ${count}`, doing: `В работе: ${count}`, planned: `Запланировано: ${count}`,
    conditional: `После других работ: ${count}`, blocked: `Приостановлено: ${count}`
  }[status];
}

function createModuleTag(module) {
  const tag = createElement("span", "module-tag", module.label);
  tag.dataset.domain = module.id;
  tag.title = module.description;
  return tag;
}

/* Строка меты, а не таблетка категории: точка и обычный текст рядом со
 * сроком. Раньше здесь стоял тот же .module-tag, а стили гасили ему фон и
 * отступы - и один класс рисовался в двух разных видах. */
function createDetailArea(module) {
  const area = createElement("span", "roadmap-detail__area", `Область: ${module.label}`);
  area.dataset.domain = module.id;
  area.title = module.description;
  return area;
}

function requireModule(moduleMap, moduleId) {
  const module = moduleMap.get(moduleId);
  if (!module) throw new Error(`Неизвестная часть программы: ${moduleId}`);
  return module;
}

function statusMark(status) {
  return { done: "✓", doing: "→", planned: "○", conditional: "↳", blocked: "!" }[status] || "·";
}

function statusLabel(status) {
  return { done: "готово", doing: "в работе", planned: "запланировано", conditional: "после других работ", blocked: "приостановлено" }[status] || status;
}

function confidenceLabel(confidence) {
  return { high: "срок подтверждён", medium: "срок может уточняться", low: "срок ориентировочный" }[confidence] || confidence;
}

function directionCountLabel(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "направление";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "направления";
  return "направлений";
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
