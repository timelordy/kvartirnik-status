import { versionLineageCopy } from "./version-lineage-copy.js";

export function evidenceCopy(manifest, lineage = {}) {
  const result = manifest.result;
  const area = Math.round(result.usableAreaM2);
  const gross = Math.round(result.grossAreaM2);
  const efficiency = Math.round(result.efficiency * 100);
  const efficiencyExact = formatDecimal(result.efficiency * 100);
  const passedChecks = manifest.checks.filter((check) => check.status === "passed").length;
  const warningErrors = manifest.warnings.filter((warning) => warning.severity === "error").length;
  const warningCount = manifest.warnings.length - warningErrors;
  const violationCount = warningErrors + manifest.violations.length;
  const version = versionLineageCopy(lineage);
  return {
    area,
    automatic: `${passedChecks} из ${manifest.checks.length} машинных проверок пройдено`,
    duration: formatDuration(manifest.durationMs),
    efficiency,
    efficiencyExact,
    formula: `${formatDecimal(result.usableAreaM2)} м² квартир / ${formatDecimal(result.grossAreaM2)} м² всей секции × 100`,
    generatedAt: formatGeneratedAt(manifest.generatedAt),
    metricLabel: manifest.efficiencyMetric.label,
    result: `${result.apartmentCount} квартир · ${area} м² · потеряно обязательных: ${result.requiredApartmentsLost}`,
    sourceLabel: `manifest ${manifest.scenarioId}`,
    freshness: version.evidenceStateLabel,
    freshnessState: version.evidenceState,
    warningGroups: manifest.warningGroups.map((group) => {
      const reasons = group.warningIndexes.map((index) => manifest.warnings[index]);
      const errors = reasons.filter((warning) => warning.severity === "error").length;
      return {
        id: group.id,
        label: group.label,
        state: group.state,
        summary: group.summary,
        heading: warningGroupHeading(group, reasons.length, errors),
        reasons
      };
    }),
    warnings: `${warningCount} ${word(warningCount, "предупреждение", "предупреждения", "предупреждений")} · нарушений: ${violationCount}`
  };
}

function warningGroupHeading(group, warningCount, errorCount) {
  if (errorCount > 0) {
    return `${group.label}: ${errorCount} ${word(errorCount, "нарушение", "нарушения", "нарушений")}`;
  }
  if (warningCount > 0) {
    return `${group.label}: ${warningCount} ${word(warningCount, "предупреждение", "предупреждения", "предупреждений")}`;
  }
  if (group.state === "not-checked") return `${group.label}: не проверялись`;
  if (group.state === "passed") return `${group.label}: 0 критических нарушений`;
  return `${group.label}: ${group.summary}`;
}

function formatDecimal(value) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).replace(/\u00a0/gu, " ");
}

function word(value, one, few, many) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function formatDuration(durationMs) {
  if (durationMs < 1000) return `${durationMs} мс`;
  return `${(durationMs / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} с`;
}

function formatGeneratedAt(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow"
  }).format(new Date(value));
}
