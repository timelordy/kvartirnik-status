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
  ["evidenceInputHash", "evidenceInputHash"],
  ["evidenceGeneratedAt", "evidenceGeneratedAt"]
]);

/* `now` передаёт страница, а не сборка. Возраст доказательства раньше считался
   один раз при сборке и застывал в разметке: витрина от 13 августа месяцами
   утверждала «15 дней», хотя доказательству шёл двадцатый. Без `now` (снимок
   без JS, контракты в узле) подпись сама называет дату отсчёта, чтобы застывшее
   число не выдавало себя за сегодняшнее. */
export function versionLineageCopy(lineage, options = {}) {
  const portalBuild = lineage?.portalBuild ?? {};
  const application = lineage?.application ?? {};
  const evidence = lineage?.evidence ?? {};
  const freshness = lineage?.freshness ?? {};
  const portalRemoteCheck = portalBuild.remoteCheck ?? {};
  return {
    portalCommit: publicRevision(portalBuild, "publicationId", "sourceCommit"),
    portalCommitFull: publicRevision(portalBuild, "publicationId", "sourceCommit", ""),
    portalGeneratedAt: formatPublicDateTime(portalBuild.generatedAt),
    portalPublishedAt: publishedAtLabel(portalBuild),
    portalMode: { local: "предварительная сборка", production: "публикационная сборка" }[portalBuild.metadataMode] ?? UNKNOWN,
    portalRemoteCheck: remoteCheckLabel(portalRemoteCheck.result),
    portalRemoteCheckedAt: formatPublicDateTime(portalRemoteCheck.checkedAt),
    portalRemoteCheckRunUrl: portalRemoteCheck.runUrl ?? "",
    applicationCommit: publicRevision(application, "publicationId", "commit"),
    applicationCommitFull: publicRevision(application, "publicationId", "commit", ""),
    applicationRelease: releaseLabel(application.releaseResult),
    applicationCheckedAt: checkedAtLabel(application),
    evidenceCommit: publicRevision(evidence, "publicationId", "applicationCommit"),
    evidenceCommitFull: publicRevision(evidence, "publicationId", "applicationCommit", ""),
    evidenceGeneratedAt: formatPublicDateTime(evidence.generatedAt),
    evidenceInputHash: typeof evidence.inputHash === "string" ? evidence.inputHash.slice(0, 12) : UNKNOWN,
    evidenceAge: evidenceAgeLabel(evidence, portalBuild, freshness, options.now),
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
    /* «Нет данных о публикации» читалось как сбой сбора данных. Состояние
       другое: удалённая проверка публикации просто не запускалась в этой
       сборке — и так это и называется. */
    publicationLabel: {
      success: "файлы публикации проверены",
      failure: "проверка публикации не пройдена",
      unknown: "удалённая проверка публикации не запускалась"
    }[releaseState],
    publicationTitle: releaseState !== "unknown"
      ? `Исходник портала: ${copy.portalCommit}; удалённая проверка: ${copy.portalRemoteCheckedAt}`
      : `Исходник портала: ${copy.portalCommit}; удалённая проверка не запускалась`,
    releaseLabel: `Автоматическая проверка публикации: ${{
      success: "пройдена",
      failure: "есть ошибка",
      unknown: "не запускалась"
    }[releaseState]}`,
    /* Страница статуса показывала только результат проверки публикации и ни
       слова о самой публикации: режим сборки и дату выкладки приходилось искать
       в протоколе на главной. Для статусной страницы это основная функция. */
    publicationSummary: `${sentenceStart(copy.portalMode)} · собран ${copy.portalGeneratedAt}`
      + ` · ${publicationStateSentence(copy.portalPublishedAt)}`,
    releaseState
  };
}

function sentenceStart(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function publicationStateSentence(publishedAt) {
  if (publishedAt === "предварительная сборка не публикуется") return "не опубликован";
  if (publishedAt === UNKNOWN) return "дата публикации не записана";
  return `опубликован ${publishedAt}`;
}

function shortSha(value) {
  if (/^publication-[a-z0-9-]+$/u.test(value ?? "")) return value;
  return /^[0-9a-f]{40}$/u.test(value ?? "") ? value.slice(0, 12) : UNKNOWN;
}

/* `undisclosed` — машинная метка политики публичного артефакта, и раньше она
   доезжала до страницы как есть: «Версия расчёта: undisclosed». Метка остаётся в
   данных, чтобы витрина отличала скрытую версию от неизвестной, а человеку
   показывается, что версия скрыта намеренно. */
export const REDACTED_REVISION = "не публикуется";

/* Сборка без метаданных репозитория — обычный предварительный просмотр, а не
   потеря данных: происхождение просто не записано. Публикационную сборку без
   полной версии отклоняет строгий режим, так что на витрине это состояние
   встречается только у предварительной. */
const UNRECORDED_REVISION = "в этой сборке не записано";

function publicRevision(owner, publicKey, privateKey, unknown = UNRECORDED_REVISION) {
  if (publicKey && /^publication-[a-z0-9-]+$/u.test(owner?.[publicKey] ?? "")) return owner[publicKey];
  if (owner?.revisionLabel === "undisclosed") return REDACTED_REVISION;
  return privateKey && owner?.[privateKey] ? shortSha(owner[privateKey]) : unknown;
}

export function formatPublicDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return UNKNOWN;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow"
  }).format(new Date(value));
}

function formatPublicDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return UNKNOWN;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Europe/Moscow" })
    .format(new Date(value));
}

/* Пустая дата публикации — это не «нет данных», а два разных состояния.
   Предварительная сборка публикацией не является и говорит об этом прямо;
   публикационная сборка без даты публикации сборку роняет, поэтому UNKNOWN
   здесь недостижим на публичной витрине и остаётся страховкой. */
function publishedAtLabel(portalBuild) {
  if (portalBuild.publishedAt) return formatPublicDateTime(portalBuild.publishedAt);
  return portalBuild.metadataMode === "local" ? "предварительная сборка не публикуется" : UNKNOWN;
}

/* Непроверенное приложение — отдельное состояние, а не серая строка. Дата
   существует ровно тогда, когда есть результат: это гарантирует контракт
   родословной, а не совпадение. */
function checkedAtLabel(application) {
  if (application.releaseResult === "unknown") return "проверка не запускалась";
  return formatPublicDateTime(application.checkedAt);
}

function evidenceAgeLabel(evidence, portalBuild, freshness, now) {
  if (Number.isFinite(now) && Number.isFinite(Date.parse(evidence.generatedAt ?? ""))) {
    return formatAge(Math.floor((now - Date.parse(evidence.generatedAt)) / 1000));
  }
  const age = formatAge(freshness.ageSeconds);
  if (age === UNKNOWN) return UNKNOWN;
  return `${age} на момент сборки ${formatPublicDate(portalBuild.generatedAt)}`;
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
    unknown: "не запускалась в этой сборке"
  }[value] ?? "не запускалась в этой сборке";
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
