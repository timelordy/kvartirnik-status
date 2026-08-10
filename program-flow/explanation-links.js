const DEFAULT_MODULE_PAGE = "teams.html";

export function moduleExplanationHref(moduleId, modulePage = DEFAULT_MODULE_PAGE) {
  return `${modulePage}#module-${encodeURIComponent(moduleId)}`;
}

export function moduleMapHref(modulePage = DEFAULT_MODULE_PAGE) {
  return `${modulePage}#части-программы`;
}

export function historyStatusExplanationHref(status, roadmapPage = "") {
  const anchors = {
    blocked: "что-значит-приостановлено",
    doing: "что-значит-в-работе",
    done: "что-значит-готово"
  };
  const anchor = anchors[status] ?? anchors.done;
  return `${roadmapPage}#${anchor}`;
}
