const UNKNOWN = "нет данных";
export const VERSION_LINEAGE_FACTS = Object.freeze([
  ["portalBuildCommit", "portalCommit"],
  ["portalBuildGeneratedAt", "portalGeneratedAt"],
  ["portalBuildPublishedAt", "portalPublishedAt"],
  ["portalBuildMode", "portalMode"],
  ["applicationCommit", "applicationCommit"],
  ["applicationRelease", "applicationRelease"],
  ["applicationCheckedAt", "applicationCheckedAt"],
  ["evidenceProducedBy", "evidenceCommit"],
  ["evidenceFreshness", "evidenceStateLabel"],
  ["evidenceAge", "evidenceAge"],
  ["evidenceRevisionDelta", "evidenceRevisionDelta"],
  ["evidenceInputHash", "evidenceInputHash"],
  ["evidenceGeneratedAt", "evidenceGeneratedAt"]
]);

export function versionLineageCopy(lineage) {
  const portalBuild = lineage?.portalBuild ?? {};
  const application = lineage?.application ?? {};
  const evidence = lineage?.evidence ?? {};
  const freshness = lineage?.freshness ?? {};
  const portalRemoteCheck = portalBuild.remoteCheck ?? {};
  return {
    portalCommit: publicRevision(portalBuild, "publicationId", "sourceCommit"),
    portalCommitFull: publicRevision(portalBuild, "publicationId", "sourceCommit", ""),
    portalGeneratedAt: formatDateTime(portalBuild.generatedAt),
    portalPublishedAt: formatDateTime(portalBuild.publishedAt),
    portalMode: { local: "локальная сборка", production: "публикационная сборка" }[portalBuild.metadataMode] ?? UNKNOWN,
    portalRemoteCheck: remoteCheckLabel(portalRemoteCheck.result),
    portalRemoteCheckedAt: formatDateTime(portalRemoteCheck.checkedAt),
    portalRemoteCheckRunUrl: portalRemoteCheck.runUrl ?? "",
    applicationCommit: publicRevision(application, "publicationId", "commit"),
    applicationCommitFull: publicRevision(application, "publicationId", "commit", ""),
    applicationRelease: releaseLabel(application.releaseResult),
    applicationCheckedAt: formatDateTime(application.checkedAt),
    evidenceCommit: publicRevision(evidence, "publicationId", "applicationCommit"),
    evidenceCommitFull: publicRevision(evidence, "publicationId", "applicationCommit", ""),
    evidenceGeneratedAt: formatDateTime(evidence.generatedAt),
    evidenceInputHash: typeof evidence.inputHash === "string" ? evidence.inputHash.slice(0, 12) : UNKNOWN,
    evidenceAge: formatAge(freshness.ageSeconds),
    /* Расстояние в коммитах наружу не выходит: публичная витрина сообщает, что
       доказательство свежее или устарело, а не насколько приватный репозиторий
       ушёл вперёд. Политика публичного артефакта это запрещает и роняла сборку,
       поэтому в опубликованной копии функцию когда-то вырезали руками — витрина
       разошлась с источником, а конвейер перестал собираться вовсе. */
    evidenceRevisionDelta: UNKNOWN,
    evidenceState: ["fresh", "stale", "unknown"].includes(freshness.state) ? freshness.state : "unknown",
    evidenceStateLabel: {
      fresh: "соответствует версии приложения",
      stale: "устарело относительно версии приложения",
      unknown: "сравнение невозможно: версия приложения неизвестна"
    }[freshness.state] ?? "сравнение невозможно: версия приложения неизвестна"
  };
}

export function versionLineageFacts(copy) {
  return Object.fromEntries(VERSION_LINEAGE_FACTS.map(([id, key]) => [id, copy[key]]));
}

export function roadmapVersionCopy(lineage) {
  const copy = versionLineageCopy(lineage);
  const releaseState = ["success", "failure", "unknown"].includes(lineage?.portalBuild?.remoteCheck?.result)
    ? lineage.portalBuild.remoteCheck.result
    : "unknown";
  return {
    publicationLabel: {
      success: "файлы публикации проверены",
      failure: "проверка публикации не пройдена",
      unknown: "нет данных о публикации"
    }[releaseState],
    publicationTitle: releaseState !== "unknown"
      ? `Исходник портала: ${copy.portalCommit}; удалённая проверка: ${copy.portalRemoteCheckedAt}`
      : `Исходник портала: ${copy.portalCommit}; удалённая проверка: нет данных`,
    releaseLabel: `Автоматическая проверка публикации: ${{
      success: "пройдена",
      failure: "есть ошибка",
      unknown: "нет данных"
    }[releaseState]}`,
    releaseState
  };
}

function shortSha(value) {
  if (/^publication-[a-z0-9-]+$/u.test(value ?? "")) return value;
  return /^[0-9a-f]{40}$/u.test(value ?? "") ? value.slice(0, 12) : UNKNOWN;
}

function publicRevision(owner, publicKey, privateKey, unknown = UNKNOWN) {
  if (publicKey && /^publication-[a-z0-9-]+$/u.test(owner?.[publicKey] ?? "")) return owner[publicKey];
  if (owner?.revisionLabel === "undisclosed") return "undisclosed";
  return privateKey && owner?.[privateKey] ? shortSha(owner[privateKey]) : unknown;
}

function formatDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return UNKNOWN;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow"
  }).format(new Date(value));
}

function formatAge(value) {
  if (!Number.isInteger(value) || value < 0) return UNKNOWN;
  if (value < 3600) return "меньше часа";
  if (value < 86_400) return `${Math.floor(value / 3600)} ч`;
  const days = Math.floor(value / 86_400);
  return `${days} ${word(days, "день", "дня", "дней")}`;
}

function releaseLabel(value) {
  return {
    success: "автоматическая проверка пройдена",
    failure: "автоматическая проверка завершилась ошибкой",
    unknown: "подтверждённого результата проверки нет"
  }[value] ?? "подтверждённого результата проверки нет";
}

function remoteCheckLabel(value) {
  return {
    success: "удалённая проверка публикации пройдена",
    failure: "удалённая проверка публикации завершилась ошибкой",
    unknown: "подтверждённого результата удалённой проверки публикации нет"
  }[value] ?? "подтверждённого результата удалённой проверки публикации нет";
}

function word(value, one, few, many) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
