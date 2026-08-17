import { formatDate, laneProgressLabel } from "./status-copy.js";
import { evidenceCopy, reasonCountLabel } from "./evidence-copy.js";
import { requirementTypesLabel } from "./requirements-copy.js";
import { versionLineageCopy, versionLineageFacts } from "./version-lineage-copy.js";
import { assertManagerOverview } from "./overview-contract.js";

const host = document.querySelector("[data-manager-overview]");

if (host) loadManagerOverview();

async function loadManagerOverview() {
  try {
    const [overview, deployment] = await Promise.all([
      fetchJson(host.dataset.overviewSource),
      fetchJson(host.dataset.deploymentSource).catch(() => ({}))
    ]);
    assertManagerOverview(overview);
    renderStage(overview);
    renderCurrent(overview);
    /* Блок проверяемого кейса снят с лендинга: числа июльского запуска
       текущая программа не воспроизводит. Данные о нём в домене остались,
       поэтому и файлы кейса тянем только когда блок на странице есть -
       иначе страница молча оставалась в состоянии загрузки. */
    if (document.getElementById("evidenceScenario")) {
      const [manifest, input] = await Promise.all([
        fetchJson(overview.evidence.manifestHref),
        fetchJson(overview.evidence.inputHref)
      ]);
      renderEvidence(overview.evidence, manifest, input, deployment);
    }
    /* Родословная версии рассказывает про саму витрину и приложение, а не
       про кейс, поэтому заполняется независимо от блока доказательства. */
    renderVersionLineage(deployment);
    renderHighlightedChanges(overview);
    host.dataset.loadState = "ready";
    setText("managerLoadNote", "Показаны свежие сведения о проекте.");
  } catch (error) {
    host.dataset.loadState = "error";
    setText("managerLoadNote", "Не удалось получить обновление. Показана последняя сохранённая сводка.");
    console.error(error);
  }
}

async function fetchJson(source) {
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить ${source}: ${response.status}`);
  return response.json();
}

function renderStage(overview) {
  setText("managerStage", overview.stage.label);
  setText("managerStageSummary", overview.stage.summary);
  const updated = document.getElementById("managerUpdated");
  if (!updated) return;
  updated.dateTime = overview.updatedAt;
  updateText(updated, formatDate(overview.updatedAt));
}

/* Карточка уже подписана «Сейчас», и заголовок повторял слово вторым: на первом
   экране стояло «Сейчас Сейчас: соединяем чертёж…». Подпись принадлежит
   карточке, значение — заголовку. */
function renderCurrent(overview) {
  setText("managerFactDone", `${laneProgressLabel(overview.facts)} · в работе: ${overview.facts.doing}`);
  setText("managerCurrentTitle", overview.facts.currentTitle);
  setText("managerFactRisk", overview.facts.risk);
  setText("managerFactNext", overview.facts.nextResult);
}

function renderEvidence(evidence, manifest, input, deployment) {
  const copy = evidenceCopy(manifest, deployment);
  setText("evidenceScenario", `${displayScenarioId(evidence.id)} · ${evidence.title}`);
  setText("evidenceInput", evidence.inputSummary);
  setText("evidenceResult", copy.result);
  renderEvidenceMetrics(manifest);
  setText("evidenceMetric", `${copy.metricLabel}: ${copy.efficiencyExact}% (округлено до ${copy.efficiency}%) = ${copy.formula}`);
  setText("evidenceWarnings", copy.warnings);
  setText("routeRequirements", requirementTypesLabel(input));
  setText("routePlacement", placementRouteSummary(manifest));
  setText("routeChecks", copy.warnings);
  renderWarningGroups("evidenceWarningGroups", copy.warningGroups);
  setText("evidenceAutomatic", copy.automatic);
  setText("evidenceManual", evidence.manual);
  renderVersionLineage(deployment);
  setText("evidenceResultSource", "запись проверки CS3-90");
  setText("evidenceResultGeneratedAt", copy.generatedAt);
  setText("evidenceResultFreshness", copy.freshness);
  const freshness = document.getElementById("evidenceResultFreshness");
  if (freshness) freshness.dataset.state = copy.freshnessState;
  setText("evidenceDuration", copy.duration);
  setText("evidenceVariantCount", manifest.variantsConsidered);
  renderEvidenceImage(evidence);
  setHref("evidenceResultSource", evidence.manifestHref);
  setHref("evidenceInputLink", evidence.inputHref);
  setHref("evidenceManifestLink", evidence.manifestHref);
  setHref("evidenceResultLink", evidence.resultHref);
}

function renderEvidenceMetrics(manifest) {
  setText("evidenceApartmentCount", manifest.result.apartmentCount);
  setText("evidenceArea", Math.round(manifest.result.usableAreaM2));
  setText("evidenceRequiredLost", manifest.result.requiredApartmentsLost);
}

function renderWarningGroups(targetId, groups) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const items = groups.map((group) => {
    const item = document.createElement("li");
    item.dataset.state = group.state;
    if (group.reasons.length > 0) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.append(createTextElement("strong", group.heading));
      const reasons = document.createElement("ul");
      reasons.append(...group.reasons.map((warning) => {
        const reason = document.createElement("li");
        reason.append(createTextElement("strong", warning.reason), createTextElement("span", warning.message));
        if (warning.count > 1) reason.append(createTextElement("em", reasonCountLabel(warning.count)));
        return reason;
      }));
      details.append(summary, createTextElement("span", group.summary), reasons);
      item.append(details);
    } else {
      item.append(createTextElement("strong", group.heading));
    }
    return item;
  });
  target.replaceChildren(...items);
}

export function renderVersionLineage(deployment) {
  const copy = versionLineageCopy(deployment, { now: Date.now() });
  Object.entries(versionLineageFacts(copy)).forEach(([id, value]) => setText(id, value));
  setTitle("portalBuildCommit", copy.portalCommitFull);
  setTitle("applicationCommit", copy.applicationCommitFull);
  setTitle("evidenceProducedBy", copy.evidenceCommitFull);
  const freshness = document.getElementById("evidenceFreshness");
  if (freshness) freshness.dataset.state = copy.evidenceState;
}

function renderEvidenceImage(evidence) {
  const image = document.getElementById("evidenceImage");
  if (!image) return;
  if (!image.hasAttribute("data-preserve-source")) image.src = evidence.displayImage;
  image.alt = evidence.displayImageAlt;
  const nodes = evidence.annotations.map((annotation, index) => createAnnotation(annotation, index));
  document.getElementById("resultAnnotations")?.replaceChildren(...nodes);
}

function createAnnotation(annotation, index) {
  const item = document.createElement("li");
  item.dataset.callout = annotation.id;
  item.title = annotation.summary;
  item.append(createTextElement("span", String(index + 1)), createTextElement("strong", annotation.label));
  return item;
}

function renderHighlightedChanges(overview) {
  const target = document.getElementById("managerChanges");
  if (target) target.replaceChildren(...overview.changes.map(createHighlightedChange));
}

function createHighlightedChange(entry) {
  const article = document.createElement("article");
  const date = createTextElement("time", formatDate(entry.date));
  date.dateTime = entry.date;
  article.append(
    date,
    createTextElement("h3", entry.title),
    createTechnicalChange(entry)
  );
  return article;
}

function createTechnicalChange(entry) {
  const details = document.createElement("details");
  const facts = document.createElement("dl");
  details.className = "change-technical";
  details.dataset.technicalCopy = "";
  details.append(createTextElement("summary", "Техническая запись"));
  facts.append(
    createFact("Что изменилось", entry.impact.changed),
    createFact("На чём основано", entry.impact.used)
  );
  details.append(facts);
  return details;
}

function createFact(label, value) {
  const fact = document.createElement("div");
  fact.append(createTextElement("dt", label), createTextElement("dd", value));
  return fact;
}

function placementRouteSummary(manifest) {
  const summary = manifest.pipeline?.find((stage) => stage.id === "placed")?.summary ?? "";
  const counts = summary.match(/^(\d+)\s+квартир.*?(\d+)\s+рядам/u);
  return counts ? `${counts[1]} квартир · ${counts[2]} рядов` : `${manifest.result.apartmentCount} квартир`;
}

function displayScenarioId(id) {
  return id.replace(/-requirements$/u, "").toUpperCase();
}

function setText(id, value) {
  updateText(document.getElementById(id), value);
}

function updateText(element, value) {
  if (!element) return;
  if (element.textContent !== value) element.textContent = value;
}

function setHref(id, value) {
  const element = document.getElementById(id);
  if (element) element.href = value;
}

function setTitle(id, value) {
  const element = document.getElementById(id);
  if (element) element.title = value;
}

function createTextElement(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}
