import { word } from "./status-copy.js";
import { moduleExplanationHref } from "./explanation-links.js";

export function resolveNewsImpact(entry, moduleMap) {
  const impact = entry.impact;
  const moduleIds = impact?.moduleIds?.length ? impact.moduleIds : [entry.moduleId];
  const modules = moduleIds.map((id) => moduleMap.get(id)).filter(Boolean);
  const primaryModule = moduleMap.get(entry.moduleId);
  return {
    modules,
    used: String(impact?.used || primaryModule?.description || `Использована часть программы «${primaryModule?.label || entry.moduleId}».`),
    changed: String(impact?.changed || entry.summary)
  };
}

export function appendNewsImpact(host, entry, moduleMap, createElement, options = {}) {
  if (entry.dailyGroups?.length) {
    appendDailyImpact(host, entry, moduleMap, createElement, options);
    return;
  }
  const impact = resolveNewsImpact(entry, moduleMap);
  host.classList.add("news-impact");
  const moduleList = createElement("div", "news-impact__modules");
  moduleList.append(createElement("span", "news-impact__modules-label", "Затронутые части"));
  impact.modules.forEach((module) => moduleList.append(createModuleChip(module, createElement, options.modulePage)));
  const details = createImpactDetails(impact, createElement);
  if (!options.collapsible) {
    host.append(moduleList, details);
    return;
  }
  const disclosure = createElement("details", "news-impact__disclosure");
  disclosure.append(createElement("summary", "", "Что использовано и что изменено"), details);
  host.append(moduleList, disclosure);
}

function appendDailyImpact(host, entry, moduleMap, createElement, options) {
  host.classList.add("news-impact", "news-impact--digest");
  host.append(createDailyOverview(entry.dailyGroups, moduleMap, createElement, options.modulePage));
  const disclosure = createElement("details", "news-impact__disclosure news-impact__disclosure--digest");
  const groupCount = entry.dailyGroups.length;
  disclosure.append(
    createElement("summary", "", `Разобрать ${entry.dailyEntryCount} ${changeWord(entry.dailyEntryCount)} по ${groupCount} ${blockWord(groupCount)}`),
    createDailyDigest(entry.dailyGroups, moduleMap, createElement, options.modulePage)
  );
  host.append(disclosure);
}

function createDailyOverview(groups, moduleMap, createElement, modulePage) {
  const overview = createElement("div", "news-impact__overview");
  overview.append(createElement("span", "news-impact__modules-label", "По функциональным блокам"));
  groups.forEach((group) => {
    const module = moduleMap.get(group.moduleId);
    if (!module) return;
    const chip = createModuleChip(module, createElement, modulePage);
    chip.classList.add("news-impact__module--count");
    chip.append(` · ${group.entryCount}`);
    chip.setAttribute("aria-label", `Открыть описание части программы «${module.label}»; изменений: ${group.entryCount}`);
    overview.append(chip);
  });
  return overview;
}

function createDailyDigest(groups, moduleMap, createElement, modulePage) {
  const digest = createElement("div", "news-impact__digest");
  groups.forEach((group) => digest.append(createDailyGroup(group, moduleMap, createElement, modulePage)));
  return digest;
}

function createDailyGroup(group, moduleMap, createElement, modulePage) {
  const module = moduleMap.get(group.moduleId);
  const section = createElement("section", "news-impact__group");
  section.dataset.domain = group.moduleId;
  const heading = createElement("div", "news-impact__group-heading");
  const title = createElement("div");
  title.append(
    createElement("h4", "", module?.label || group.moduleId),
    createElement("p", "", module?.description || "")
  );
  heading.append(title, createElement("span", "news-impact__group-count", `${group.entryCount} ${changeWord(group.entryCount)}`));
  section.append(heading, createRelatedModules(group, moduleMap, createElement, modulePage));
  const list = createElement("ol", "news-impact__items");
  group.entries.forEach((entry) => list.append(createDailyItem(entry, moduleMap, createElement)));
  section.append(list);
  return section;
}

function createRelatedModules(group, moduleMap, createElement, modulePage) {
  const related = group.moduleIds.filter((id) => id !== group.moduleId).map((id) => moduleMap.get(id)).filter(Boolean);
  const row = createElement("div", "news-impact__related");
  if (related.length === 0) return row;
  row.append(createElement("span", "", "Связано с"));
  related.forEach((module) => row.append(createModuleChip(module, createElement, modulePage)));
  return row;
}

function createDailyItem(entry, moduleMap, createElement) {
  const item = createElement("li", "news-impact__item");
  const article = createElement("article");
  const impact = resolveNewsImpact(entry, moduleMap);
  article.append(createElement("h5", "", entry.title), createElement("p", "news-impact__change", impact.changed));
  const source = createElement("details", "news-impact__source");
  source.append(createElement("summary", "", "На чём основано"), createElement("p", "", impact.used));
  article.append(source);
  item.append(article);
  return item;
}

function changeWord(value) {
  return word(value, "изменение", "изменения", "изменений");
}

function blockWord(value) {
  return word(value, "блоку", "блокам", "блокам");
}

function createModuleChip(module, createElement, modulePage) {
  const chip = createElement("a", "module-tag news-impact__module", module.label);
  chip.dataset.domain = module.id;
  chip.href = moduleExplanationHref(module.id, modulePage);
  chip.setAttribute("aria-label", `Открыть описание части программы «${module.label}»`);
  chip.title = module.description;
  return chip;
}

function createImpactDetails(impact, createElement) {
  const details = createElement("dl", "news-impact__details");
  details.append(
    createDetail("Что использовано", impact.used, createElement),
    createDetail("Что изменено", impact.changed, createElement)
  );
  return details;
}

function createDetail(label, value, createElement) {
  const row = createElement("div");
  row.append(createElement("dt", "", label), createElement("dd", "", value));
  return row;
}
