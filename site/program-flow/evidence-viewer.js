import { prepareEvidenceResult } from "./evidence-result-loader.js";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const PAN_STEP = 48;
const PAN_ACTIONS = {
  "pan-left": "ArrowRight",
  "pan-right": "ArrowLeft",
  "pan-up": "ArrowDown",
  "pan-down": "ArrowUp"
};
const STAGE_IDS = {
  source: "dwg",
  canonical: "canonical",
  result: "rendered",
  checks: "checked",
  diff: "diff"
};

document.querySelectorAll("[data-evidence-viewer]").forEach(initializeViewer);

function initializeViewer(viewer) {
  const elements = collectElements(viewer);
  if (!elements.viewport || !elements.drawing || !elements.resultImage || elements.tabs.length === 0) return;
  const state = createState();
  viewer.dataset.enhanced = "true";
  bindTabs(elements, state);
  bindViewport(elements, state);
  bindActions(viewer, elements, state);
  bindFullscreen(viewer, elements, state);
  bindResponsiveDrawer(elements);
  selectStage("result", elements, state);
  applyTransform(elements, state);
  hydrateViewer(viewer, elements, state).catch((error) => handleHydrationFailure(viewer, elements, error));
}

function collectElements(viewer) {
  return {
    viewer,
    tabs: Array.from(viewer.querySelectorAll("[data-viewer-stage]")),
    panels: Array.from(viewer.querySelectorAll("[data-viewer-panel]")),
    viewport: viewer.querySelector("[data-viewer-viewport]"),
    drawing: viewer.querySelector("[data-viewer-transform]"),
    resultImage: viewer.querySelector('[data-viewer-panel="result"] img'),
    zoom: viewer.querySelector("[data-viewer-zoom]"),
    live: viewer.querySelector("[data-viewer-live]"),
    drawer: viewer.querySelector("[data-viewer-drawer]"),
    fullscreen: viewer.querySelector('[data-viewer-action="fullscreen"]'),
    callouts: Array.from(viewer.querySelectorAll("[data-callout]")),
    focusButtons: Array.from(viewer.querySelectorAll("[data-focus-callout]")),
    checksFocus: viewer.querySelector("[data-focus-from-checks]"),
    checksList: viewer.querySelector("[data-viewer-check-groups]")
  };
}

function createState() {
  return {
    scale: MIN_SCALE,
    x: 0,
    y: 0,
    selectedStage: "result",
    drag: null,
    lastTapAt: 0,
    fullscreenButton: null,
    ensureFullResult: async () => false
  };
}

function enableControls(viewer, elements) {
  elements.tabs.forEach((tab) => { tab.disabled = false; });
  viewer.querySelectorAll("[data-viewer-action]")
    .forEach((button) => { button.disabled = false; });
  if (!viewer.requestFullscreen) elements.fullscreen.disabled = true;
}

function enableEvidenceControls(elements) {
  elements.focusButtons.forEach((button) => { button.disabled = false; });
  if (elements.checksFocus) elements.checksFocus.disabled = false;
  elements.callouts.forEach((callout) => {
    callout.disabled = false;
    callout.setAttribute("aria-pressed", "false");
  });
}

function bindTabs(elements, state) {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectStage(tab.dataset.viewerStage, elements, state));
    tab.addEventListener("keydown", (event) => handleTabKey(event, tab, elements, state));
  });
}

function handleTabKey(event, tab, elements, state) {
  const currentIndex = elements.tabs.indexOf(tab);
  const keyMoves = {
    ArrowLeft: currentIndex - 1,
    ArrowRight: currentIndex + 1,
    Home: 0,
    End: elements.tabs.length - 1
  };
  if (Object.hasOwn(keyMoves, event.key)) {
    event.preventDefault();
    const nextIndex = (keyMoves[event.key] + elements.tabs.length) % elements.tabs.length;
    elements.tabs[nextIndex].focus();
    return;
  }
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  selectStage(tab.dataset.viewerStage, elements, state);
}

function selectStage(stageId, elements, state) {
  const selected = elements.tabs.find((tab) => tab.dataset.viewerStage === stageId);
  if (!selected) return;
  state.selectedStage = stageId;
  elements.tabs.forEach((tab) => {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  elements.panels.forEach((panel) => {
    panel.hidden = panel.dataset.viewerPanel !== stageId;
  });
  const stateLabel = selected.dataset.state === "published" ? "опубликовано" : "не опубликовано";
  elements.live.textContent = `${selected.querySelector("span").textContent} · ${stateLabel}`;
}

function bindActions(viewer, elements, state) {
  viewer.querySelectorAll("[data-viewer-action]").forEach((button) => {
    button.addEventListener("click", () => handleViewerAction(button.dataset.viewerAction, viewer, elements, state));
  });
  elements.callouts.forEach((button) => {
    button.addEventListener("click", () => focusCallout(button.dataset.callout, elements, state));
  });
  elements.focusButtons.forEach((button) => {
    button.addEventListener("click", () => focusCallout(button.dataset.focusCallout, elements, state));
  });
  elements.checksFocus?.addEventListener("click", () => {
    selectStage("result", elements, state);
    requestAnimationFrame(() => { void focusCallout(elements.checksFocus.dataset.focusFromChecks, elements, state); });
  });
}

async function handleViewerAction(action, viewer, elements, state) {
  if (["zoom-in", "fullscreen"].includes(action) && !(await state.ensureFullResult())) return;
  if (action === "zoom-in") changeScale(state.scale + SCALE_STEP, elements, state);
  if (action === "zoom-out") changeScale(state.scale - SCALE_STEP, elements, state);
  if (action === "fit") fitView(elements, state);
  if (action === "fullscreen") toggleFullscreen(viewer, elements, state);
  if (PAN_ACTIONS[action]) panByKey(PAN_ACTIONS[action], elements, state);
}

function bindViewport(elements, state) {
  elements.viewport.addEventListener("keydown", (event) => handleViewportKey(event, elements, state));
  elements.viewport.addEventListener("dblclick", async () => {
    if (await state.ensureFullResult()) changeScale(state.scale + 0.5, elements, state);
  });
  elements.viewport.addEventListener("pointerdown", (event) => startPointer(event, elements, state));
  elements.viewport.addEventListener("pointermove", (event) => movePointer(event, elements, state));
  elements.viewport.addEventListener("pointerup", (event) => finishPointer(event, elements, state));
  elements.viewport.addEventListener("pointercancel", (event) => finishPointer(event, elements, state));
  elements.viewport.addEventListener("touchend", (event) => handleDoubleTouch(event, elements, state), { passive: true });
  window.addEventListener("resize", () => {
    clampPan(elements, state);
    applyTransform(elements, state);
  });
}

async function handleViewportKey(event, elements, state) {
  const handled = ["+", "=", "-", "_", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  if (!handled.includes(event.key)) return;
  event.preventDefault();
  if (["+", "="].includes(event.key)) {
    if (await state.ensureFullResult()) changeScale(state.scale + SCALE_STEP, elements, state);
  }
  if (["-", "_"].includes(event.key)) changeScale(state.scale - SCALE_STEP, elements, state);
  if (event.key === "0") fitView(elements, state);
  if (event.key.startsWith("Arrow")) panByKey(event.key, elements, state);
}

function panByKey(key, elements, state) {
  if (state.scale <= MIN_SCALE) return;
  if (key === "ArrowLeft") state.x += PAN_STEP;
  if (key === "ArrowRight") state.x -= PAN_STEP;
  if (key === "ArrowUp") state.y += PAN_STEP;
  if (key === "ArrowDown") state.y -= PAN_STEP;
  clampPan(elements, state);
  applyTransform(elements, state);
}

function startPointer(event, elements, state) {
  if (event.button !== 0) return;
  state.drag = {
    id: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: state.x,
    startY: state.y
  };
  elements.viewport.setPointerCapture?.(event.pointerId);
  elements.viewport.dataset.dragging = String(state.scale > MIN_SCALE);
}

function movePointer(event, elements, state) {
  if (!state.drag || state.drag.id !== event.pointerId || state.scale <= MIN_SCALE) return;
  const deltaX = event.clientX - state.drag.startClientX;
  const deltaY = event.clientY - state.drag.startClientY;
  state.x = state.drag.startX + deltaX;
  state.y = state.drag.startY + deltaY;
  clampPan(elements, state);
  applyTransform(elements, state);
}

function finishPointer(event, elements, state) {
  if (!state.drag || state.drag.id !== event.pointerId) return;
  state.drag = null;
  delete elements.viewport.dataset.dragging;
  if (elements.viewport.hasPointerCapture?.(event.pointerId)) {
    elements.viewport.releasePointerCapture(event.pointerId);
  }
}

async function handleDoubleTouch(event, elements, state) {
  if (event.touches.length !== 0 || event.changedTouches.length !== 1) return;
  const now = Date.now();
  if (now - state.lastTapAt < 340) {
    if (await state.ensureFullResult()) changeScale(state.scale + 0.5, elements, state);
    state.lastTapAt = 0;
    return;
  }
  state.lastTapAt = now;
}

function changeScale(nextScale, elements, state) {
  state.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  if (state.scale === MIN_SCALE) {
    state.x = 0;
    state.y = 0;
  }
  clampPan(elements, state);
  applyTransform(elements, state);
}

function fitView(elements, state, focusViewport = true) {
  state.scale = MIN_SCALE;
  state.x = 0;
  state.y = 0;
  clearActiveCallout(elements);
  applyTransform(elements, state);
  if (focusViewport) elements.viewport.focus({ preventScroll: true });
}

function clampPan(elements, state) {
  const maxX = Math.max(0, elements.viewport.clientWidth * (state.scale - 1) / 2);
  const maxY = Math.max(0, elements.viewport.clientHeight * (state.scale - 1) / 2);
  state.x = Math.min(maxX, Math.max(-maxX, state.x));
  state.y = Math.min(maxY, Math.max(-maxY, state.y));
}

function applyTransform(elements, state) {
  elements.drawing.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  elements.viewer.style.setProperty("--viewer-inverse-scale", String(1 / state.scale));
  elements.zoom.value = `${Math.round(state.scale * 100)}%`;
  elements.zoom.textContent = elements.zoom.value;
  elements.viewer.dataset.scale = String(state.scale);
  const zoomOut = elements.viewer.querySelector('[data-viewer-action="zoom-out"]');
  const zoomIn = elements.viewer.querySelector('[data-viewer-action="zoom-in"]');
  zoomOut.disabled = state.scale <= MIN_SCALE;
  zoomIn.disabled = state.scale >= MAX_SCALE;
  elements.viewer.querySelectorAll("[data-pan-direction]")
    .forEach((button) => { button.disabled = state.scale <= MIN_SCALE; });
}

async function focusCallout(calloutId, elements, state) {
  const callout = elements.callouts.find((item) => item.dataset.callout === calloutId);
  if (!callout || callout.disabled) return;
  if (!(await state.ensureFullResult())) return;
  state.scale = Number(callout.dataset.scale) || 2;
  state.x = (50 - Number(callout.dataset.x)) / 100 * elements.viewport.clientWidth * state.scale;
  state.y = (50 - Number(callout.dataset.y)) / 100 * elements.viewport.clientHeight * state.scale;
  clampPan(elements, state);
  setActiveCallout(calloutId, elements);
  elements.drawer.open = true;
  applyTransform(elements, state);
  elements.live.textContent = `${callout.getAttribute("aria-label")} · масштаб ${Math.round(state.scale * 100)}%`;
  callout.focus({ preventScroll: true });
}

function setActiveCallout(calloutId, elements) {
  elements.callouts.forEach((callout) => {
    callout.setAttribute("aria-pressed", String(callout.dataset.callout === calloutId));
  });
  elements.viewer.querySelectorAll("[data-callout-detail]").forEach((detail) => {
    if (detail.dataset.calloutDetail === calloutId) detail.dataset.active = "true";
    else delete detail.dataset.active;
  });
}

function clearActiveCallout(elements) {
  elements.callouts.forEach((callout) => callout.setAttribute("aria-pressed", "false"));
  elements.viewer.querySelectorAll("[data-callout-detail]").forEach((detail) => delete detail.dataset.active);
}

function bindFullscreen(viewer, elements, state) {
  document.addEventListener("fullscreenchange", () => {
    const active = document.fullscreenElement === viewer;
    const returnButton = active ? null : state.fullscreenButton;
    elements.fullscreen.setAttribute("aria-pressed", String(active));
    elements.fullscreen.textContent = active ? "Выйти из полного экрана" : "На весь экран";
    if (!active) state.fullscreenButton = null;
    requestAnimationFrame(() => {
      fitView(elements, state, active);
      returnButton?.focus({ preventScroll: true });
    });
  });
  viewer.addEventListener("fullscreenerror", () => {
    state.fullscreenButton = null;
    showFullscreenError(elements);
  });
}

async function toggleFullscreen(viewer, elements, state) {
  state.fullscreenButton = elements.fullscreen;
  try {
    if (document.fullscreenElement === viewer) await document.exitFullscreen();
    else await viewer.requestFullscreen();
  } catch {
    state.fullscreenButton = null;
    showFullscreenError(elements);
  }
}

function showFullscreenError(elements) {
  elements.live.textContent = "Полноэкранный режим недоступен · остальные инструменты работают";
  elements.fullscreen.setAttribute("aria-pressed", "false");
  elements.fullscreen.focus({ preventScroll: true });
}

function bindResponsiveDrawer(elements) {
  const mobile = window.matchMedia("(max-width: 720px)");
  const sync = () => { elements.drawer.open = !mobile.matches; };
  mobile.addEventListener("change", sync);
  sync();
}

async function hydrateViewer(viewer, elements, state) {
  const [manifest, placement, status] = await Promise.all([
    fetchJson(viewer.dataset.manifestSource),
    fetchJson(viewer.dataset.placementSource),
    fetchJson(viewer.dataset.statusSource)
  ]);
  validateHydrationData(manifest, placement, status);
  const evidence = status.evidence.find((item) => item.id === manifest.scenarioId);
  state.ensureFullResult = await prepareEvidenceResult(
    elements.resultImage,
    manifest,
    (message) => { elements.live.textContent = message; }
  );
  hydrateStages(manifest.pipeline, elements);
  hydrateCounts(manifest, placement, elements);
  hydrateChecks(manifest, elements);
  hydrateCallouts(evidence, manifest, elements);
  enableControls(viewer, elements);
  enableEvidenceControls(elements);
  viewer.dataset.loadState = "ready";
}

async function fetchJson(source) {
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) throw new Error(`${source}: ${response.status}`);
  return response.json();
}

function validateHydrationData(manifest, placement, status) {
  if (manifest.schemaVersion !== 4 || !Array.isArray(manifest.pipeline)) throw new Error("manifest schema differs");
  if (placement.schemaVersion !== "evidence-placement/1" || !Array.isArray(placement.rows)) {
    throw new Error("placement schema differs");
  }
  if (!Array.isArray(status.evidence)) throw new Error("status evidence differs");
  const evidence = status.evidence.find((item) => item.id === manifest.scenarioId);
  if (!evidence || !Array.isArray(evidence.annotations)) throw new Error("viewer annotations are missing");
  if (evidence.annotationResultSha256 !== manifest.artifactHashes?.resultSha256) {
    throw new Error("viewer annotation hash differs from result");
  }
}

function hydrateStages(pipeline, elements) {
  const byId = new Map(pipeline.map((stage) => [stage.id, stage]));
  elements.tabs.forEach((tab) => {
    const stage = byId.get(STAGE_IDS[tab.dataset.viewerStage]);
    if (!stage) return;
    tab.dataset.state = stage.state;
    tab.querySelector("[data-stage-status]").textContent = stage.state === "published" ? "опубликовано" : "не опубликовано";
    const summary = elements.viewer.querySelector(`[data-viewer-panel="${tab.dataset.viewerStage}"] [data-stage-summary]`);
    if (summary) summary.textContent = stage.summary;
  });
}

function hydrateCounts(manifest, placement, elements) {
  setText("viewerApartmentCount", manifest.result.apartmentCount);
  setText("viewerRowCount", placement.rows.length);
  setText("viewerWarningCount", manifest.warnings.length);
  const warningCount = manifest.warnings.filter((warning) => warning.severity === "warning").length;
  const errorCount = manifest.warnings.filter((warning) => warning.severity === "error").length;
  setText("viewerWarningSummary", `${warningCount} предупреждения и ${errorCount} нарушения.`);
  const generatedAt = document.getElementById("viewerGeneratedAt");
  generatedAt.dateTime = manifest.generatedAt;
  generatedAt.textContent = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(manifest.generatedAt));
  setText("viewerApplicationCommit", manifest.revisionLabel === "undisclosed"
    ? "undisclosed"
    : manifest.applicationCommit?.slice(0, 7) || "нет данных");
}

function hydrateChecks(manifest, elements) {
  const groups = manifest.warningGroups.map((group) => {
    const item = document.createElement("li");
    item.dataset.state = group.state;
    const heading = document.createElement("strong");
    const summary = document.createElement("span");
    heading.textContent = group.label;
    summary.textContent = group.summary;
    item.append(heading, summary);
    return item;
  });
  elements.checksList.replaceChildren(...groups);
}

function hydrateCallouts(evidence, manifest, elements) {
  const resultHash = manifest.artifactHashes.resultSha256;
  if (evidence.annotationResultSha256 !== resultHash) throw new Error("callout result hash differs");
  const annotations = new Map(evidence.annotations.map((annotation) => [annotation.id, annotation]));
  elements.callouts.forEach((callout) => {
    const annotation = annotations.get(callout.dataset.callout);
    if (!annotation?.focus || annotation.focus.basis !== "rendered-result") throw new Error("callout focus differs");
    callout.dataset.x = String(annotation.focus.xPercent);
    callout.dataset.y = String(annotation.focus.yPercent);
    callout.dataset.scale = String(annotation.focus.scale);
    callout.style.setProperty("--callout-x", `${annotation.focus.xPercent}%`);
    callout.style.setProperty("--callout-y", `${annotation.focus.yPercent}%`);
  });
}

function handleHydrationFailure(viewer, elements, error) {
  viewer.dataset.loadState = "error";
  elements.live.textContent = "Не удалось сверить данные · показан сохранённый результат";
  elements.callouts.forEach((button) => { button.disabled = true; });
  elements.focusButtons.forEach((button) => { button.disabled = true; });
  if (elements.checksFocus) elements.checksFocus.disabled = true;
  console.error(error);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}
