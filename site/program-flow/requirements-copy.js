const TYPE_LABELS = Object.freeze({
  studio: "ст",
  one: "1к",
  two: "2к",
  three: "3к",
  four: "4к"
});

export function requirementTypesLabel(input) {
  if (!Array.isArray(input?.requirements)) {
    throw new Error("evidence input requirements are missing");
  }
  const labels = input.requirements
    .filter((item) => item.strictness === "required" && Number.isInteger(item.count) && item.count > 0)
    .map((item) => {
      const label = TYPE_LABELS[item.typeKey];
      if (!label) throw new Error(`unknown apartment requirement type: ${item.typeKey}`);
      return item.count === 1 ? label : `${item.count} × ${label}`;
    });
  if (labels.length === 0) throw new Error("evidence input has no required apartment types");
  return labels.join(" + ");
}
