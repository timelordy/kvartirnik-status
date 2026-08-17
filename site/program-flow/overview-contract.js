import {
  countStatuses,
  createDailyWorklog,
  isProductWorklogEntry
} from "./status-copy.js";

/* 2: у счётчика направлений появился знаменатель. «Подтверждено: 1» без общего
   числа направлений не является фактом, и потребитель обязан получить оба
   значения либо отвергнуть сводку — поэтому это смена версии, а не добавление
   необязательного поля. */
export const OVERVIEW_SCHEMA_VERSION = 2;
export const OVERVIEW_MAX_BYTES = 48 * 1024;
export const OVERVIEW_MAX_SOURCE_RATIO = 0.2;

// Строчная первая буква без порчи аббревиатур: «Проверяю ... ЛЛУ» -> «проверяю ... ЛЛУ».
export function toSentenceStart(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

// Карточки сводки стоят рядом, поэтому факт начинается с прописной и без точки на конце.
function asSentence(value) {
  const trimmed = value.trim().replace(/\.+$/u, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function createManagerOverview(status, worklog) {
  const config = status.managerOverview;
  const current = requireSelection(status.current, config.primaryCurrentId, "current");
  const risk = requireSelection(status.roadmap.lanes, config.mainRiskLaneId, "risk lane");
  const evidence = requireSelection(status.evidence, config.evidenceId, "evidence");
  const counts = countStatuses(status.roadmap.lanes);
  const changes = selectOverviewChanges(worklog, config.highlightChangeIds).map(projectChange);
  const overview = {
    schemaVersion: OVERVIEW_SCHEMA_VERSION,
    updatedAt: status.updatedAt,
    stage: projectFields(status.stage, ["label", "summary"]),
    facts: {
      currentTitle: current.title,
      done: counts.done,
      doing: counts.doing,
      total: counts.total,
      risk: risk.estimate?.risk || "Риск не указан",
      nextResult: asSentence(status.stage.progress.replace(/^Следующий результат —\s*/u, ""))
    },
    maturity: status.maturity.map((item) => projectFields(item, ["status", "title", "summary", "timing"])),
    milestones: status.roadmap.milestones.map((item) => projectFields(item, ["kind", "date", "title"])),
    evidence: projectEvidence(evidence),
    modules: projectReferencedModules(status.modules, changes),
    changes
  };
  assertManagerOverview(overview);
  return overview;
}

export function selectOverviewChanges(worklog, highlightChangeIds) {
  if (new Set(highlightChangeIds).size !== highlightChangeIds.length) {
    throw new Error("overview highlight changes are duplicated");
  }
  const productChanges = worklog.entries.filter(isProductWorklogEntry);
  const highlighted = highlightChangeIds.map((id) => (
    requireSelection(productChanges, id, "highlight change")
  ));
  const automaticDigest = createDailyWorklog(worklog.entries)
    .reverse()
    .find(containsAutomaticEntry);
  if (!automaticDigest) return highlighted;
  const represented = representedEntryIds(automaticDigest);
  return [
    automaticDigest,
    ...highlighted.filter((entry) => !represented.has(entry.id))
  ].slice(0, 3);
}

function containsAutomaticEntry(entry) {
  if (isAutomaticEntryId(entry.id)) return true;
  return entry.dailyGroups?.some((group) => group.entries.some((item) => isAutomaticEntryId(item.id))) ?? false;
}

function representedEntryIds(entry) {
  if (!entry.dailyGroups) return new Set([entry.id]);
  return new Set(entry.dailyGroups.flatMap((group) => group.entries.map((item) => item.id)));
}

function isAutomaticEntryId(id) {
  return /^\d{4}-\d{2}-\d{2}-auto-[0-9a-f]{12}$/u.test(id ?? "");
}

export function assertManagerOverview(overview) {
  requireObject(overview, "overview");
  requireAllowedKeys(overview, [
    "schemaVersion",
    "updatedAt",
    "stage",
    "facts",
    "maturity",
    "milestones",
    "evidence",
    "modules",
    "changes"
  ], "overview");
  if (overview.schemaVersion !== OVERVIEW_SCHEMA_VERSION) {
    throw new Error(`overview schemaVersion must be ${OVERVIEW_SCHEMA_VERSION}`);
  }
  requireDate(overview.updatedAt, "overview.updatedAt");
  requireAllowedKeys(overview.stage, ["label", "summary"], "overview.stage");
  requireStrings(overview.stage, ["label", "summary"], "overview.stage");
  requireFacts(overview.facts);
  requireArray(overview.maturity, "overview.maturity", 1).forEach((item, index) => {
    const label = `overview.maturity[${index}]`;
    requireAllowedKeys(item, ["status", "title", "summary", "timing"], label);
    requireStrings(item, ["status", "title", "summary", "timing"], label);
  });
  requireArray(overview.milestones, "overview.milestones", 1).forEach((item, index) => {
    const label = `overview.milestones[${index}]`;
    requireAllowedKeys(item, ["kind", "date", "title"], label);
    requireStrings(item, ["kind", "date", "title"], label);
  });
  requireEvidence(overview.evidence);
  const moduleIds = validateModules(overview.modules);
  validateChanges(overview.changes, moduleIds);
  const bytes = byteLength(overview);
  if (bytes > OVERVIEW_MAX_BYTES) {
    throw new Error(`overview payload is ${bytes} bytes; limit is ${OVERVIEW_MAX_BYTES}`);
  }
  return { bytes, moduleCount: moduleIds.size, changeCount: overview.changes.length };
}

function projectChange(entry) {
  const change = {
    date: entry.date,
    title: entry.title,
    moduleId: entry.moduleId,
    impact: projectImpact(entry.impact)
  };
  if (!entry.dailyGroups) return change;
  change.dailyEntryCount = entry.dailyEntryCount;
  change.dailyGroups = entry.dailyGroups.map((group) => ({
    moduleId: group.moduleId,
    entryCount: group.entryCount,
    moduleIds: [...group.moduleIds],
    entries: group.entries.map(projectDailyEntry)
  }));
  return change;
}

function projectDailyEntry(entry) {
  return {
    moduleId: entry.moduleId,
    title: entry.title,
    impact: projectImpact(entry.impact)
  };
}

function projectImpact(impact) {
  if (!impact) return undefined;
  return {
    moduleIds: [...impact.moduleIds],
    used: impact.used,
    changed: impact.changed
  };
}

function projectEvidence(evidence) {
  return {
    ...projectFields(evidence, [
      "id",
      "title",
      "inputSummary",
      "manual",
      "manifestHref",
      "inputHref",
      "resultHref",
      "displayImage",
      "displayImageAlt"
    ]),
    annotations: evidence.annotations.map((item) => projectFields(item, ["id", "label", "summary"]))
  };
}

function projectReferencedModules(modules, changes) {
  const referenced = collectReferencedModules(changes);
  return modules
    .filter((module) => referenced.has(module.id))
    .map((module) => projectFields(module, ["id", "label", "description"]));
}

function collectReferencedModules(changes) {
  const referenced = new Set();
  changes.forEach((change) => {
    addImpactModules(referenced, change);
    change.dailyGroups?.forEach((group) => {
      referenced.add(group.moduleId);
      group.moduleIds.forEach((id) => referenced.add(id));
      group.entries.forEach((entry) => addImpactModules(referenced, entry));
    });
  });
  return referenced;
}

function addImpactModules(target, entry) {
  target.add(entry.moduleId);
  entry.impact?.moduleIds.forEach((id) => target.add(id));
}

function projectFields(value, fields) {
  return Object.fromEntries(fields.filter((field) => value[field] !== undefined)
    .map((field) => [field, value[field]]));
}

function requireSelection(values, id, label) {
  const value = values.find((item) => item.id === id);
  if (!value) throw new Error(`overview ${label} is missing: ${id}`);
  return value;
}

function requireFacts(facts) {
  requireAllowedKeys(facts, ["currentTitle", "done", "doing", "total", "risk", "nextResult"], "overview.facts");
  requireStrings(facts, ["currentTitle", "risk", "nextResult"], "overview.facts");
  for (const field of ["done", "doing", "total"]) {
    if (!Number.isInteger(facts[field]) || facts[field] < 0) {
      throw new Error(`overview.facts.${field} must be a non-negative integer`);
    }
  }
  if (facts.done + facts.doing > facts.total) {
    throw new Error("overview.facts.total must cover done and doing lanes");
  }
}

function requireEvidence(evidence) {
  requireAllowedKeys(evidence, [
    "id",
    "title",
    "inputSummary",
    "manual",
    "manifestHref",
    "inputHref",
    "resultHref",
    "displayImage",
    "displayImageAlt",
    "annotations"
  ], "overview.evidence");
  requireStrings(evidence, [
    "id",
    "title",
    "inputSummary",
    "manual",
    "manifestHref",
    "inputHref",
    "resultHref",
    "displayImage",
    "displayImageAlt"
  ], "overview.evidence");
  requireArray(evidence.annotations, "overview.evidence.annotations", 1).forEach((item, index) => {
    const label = `overview.evidence.annotations[${index}]`;
    requireAllowedKeys(item, ["id", "label", "summary"], label);
    requireStrings(item, ["id", "label", "summary"], label);
  });
}

function validateModules(modules) {
  const ids = new Set();
  requireArray(modules, "overview.modules", 1).forEach((module, index) => {
    const label = `overview.modules[${index}]`;
    requireAllowedKeys(module, ["id", "label", "description"], label);
    requireStrings(module, ["id", "label", "description"], label);
    if (ids.has(module.id)) throw new Error(`overview module is duplicated: ${module.id}`);
    ids.add(module.id);
  });
  return ids;
}

function validateChanges(changes, moduleIds) {
  requireArray(changes, "overview.changes", 1, 3).forEach((change, index) => {
    const label = `overview.changes[${index}]`;
    requireAllowedKeys(change, [
      "date",
      "title",
      "moduleId",
      "impact",
      "dailyEntryCount",
      "dailyGroups"
    ], label);
    requireStrings(change, ["date", "title", "moduleId"], label);
    requireDate(change.date, `${label}.date`);
    requireKnownModule(change.moduleId, moduleIds, label);
    validateImpact(change.impact, moduleIds, `${label}.impact`);
    if (change.dailyGroups) validateDailyGroups(change, moduleIds, label);
  });
  const referenced = collectReferencedModules(changes);
  if (referenced.size !== moduleIds.size || [...moduleIds].some((id) => !referenced.has(id))) {
    throw new Error("overview.modules must equal the referenced module subset");
  }
}

function validateDailyGroups(change, moduleIds, label) {
  const groups = requireArray(change.dailyGroups, `${label}.dailyGroups`, 1);
  const count = groups.reduce((total, group, groupIndex) => {
    const groupLabel = `${label}.dailyGroups[${groupIndex}]`;
    requireAllowedKeys(group, ["moduleId", "entryCount", "moduleIds", "entries"], groupLabel);
    requireStrings(group, ["moduleId"], groupLabel);
    requireKnownModule(group.moduleId, moduleIds, groupLabel);
    requireArray(group.moduleIds, `${groupLabel}.moduleIds`, 1)
      .forEach((id) => requireKnownModule(id, moduleIds, groupLabel));
    const entries = requireArray(group.entries, `${groupLabel}.entries`, 1);
    entries.forEach((entry) => {
      requireAllowedKeys(entry, ["moduleId", "title", "impact"], `${groupLabel}.entry`);
      requireStrings(entry, ["moduleId", "title"], `${groupLabel}.entry`);
      requireKnownModule(entry.moduleId, moduleIds, groupLabel);
      validateImpact(entry.impact, moduleIds, `${groupLabel}.entry.impact`);
    });
    if (group.entryCount !== entries.length) throw new Error(`${groupLabel}.entryCount differs`);
    return total + entries.length;
  }, 0);
  if (change.dailyEntryCount !== count) throw new Error(`${label}.dailyEntryCount differs`);
}

function validateImpact(impact, moduleIds, label) {
  requireObject(impact, label);
  requireAllowedKeys(impact, ["moduleIds", "used", "changed"], label);
  requireStrings(impact, ["used", "changed"], label);
  requireArray(impact.moduleIds, `${label}.moduleIds`, 1)
    .forEach((id) => requireKnownModule(id, moduleIds, label));
}

function requireKnownModule(id, moduleIds, label) {
  if (!moduleIds.has(id)) throw new Error(`${label} references unknown module: ${id}`);
}

function requireStrings(value, fields, label) {
  requireObject(value, label);
  fields.forEach((field) => {
    if (typeof value[field] !== "string" || value[field].trim() === "") {
      throw new Error(`${label}.${field} must be a non-empty string`);
    }
  });
}

function requireArray(value, label, minimum = 0, maximum = Infinity) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new Error(`${label} must contain ${minimum}-${maximum} items`);
  }
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function requireAllowedKeys(value, allowed, label) {
  requireObject(value, label);
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unexpected.length > 0) throw new Error(`${label} has unexpected fields: ${unexpected.join(", ")}`);
}

function requireDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
