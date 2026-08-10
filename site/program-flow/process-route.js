const route = document.querySelector(".process-route");
const steps = Array.from(document.querySelectorAll(".conveyor-step"));
const mobile = window.matchMedia("(max-width: 760px)");

if (route && steps.length > 0) {
  const links = Array.from(route.querySelectorAll("a"));
  route.dataset.enhanced = "true";
  links.forEach((link) => link.addEventListener("click", (event) => {
    const step = findStep(link.hash);
    if (!step) return;
    event.preventDefault();
    selectStep(step, links, true);
  }));
  steps.forEach((step) => step.addEventListener("toggle", () => keepSingleMobileStep(step)));
  window.addEventListener("hashchange", () => syncMode(links));
  mobile.addEventListener("change", () => syncMode(links));
  syncMode(links);
}

function findStep(hash) {
  if (!hash) return null;
  const id = decodeURIComponent(hash.slice(1));
  return steps.find((step) => step.id === id) || null;
}

function selectStep(selected, links, updateLocation = false) {
  steps.forEach((step) => {
    step.hidden = step !== selected;
    step.open = step === selected;
  });
  links.forEach((link) => {
    if (findStep(link.hash) === selected) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
  if (!updateLocation) return;
  window.history.replaceState(null, "", `#${encodeURIComponent(selected.id)}`);
  selected.tabIndex = -1;
  selected.focus({ preventScroll: true });
  selected.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncMode(links) {
  const selected = findStep(window.location.hash) || steps.find((step) => step.open) || steps[0];
  if (!mobile.matches) {
    selectStep(selected, links);
    return;
  }
  steps.forEach((step) => {
    step.hidden = false;
  });
  if (!steps.some((step) => step.open)) selected.open = true;
}

function keepSingleMobileStep(selected) {
  if (!mobile.matches || !selected.open) return;
  steps.forEach((step) => {
    if (step !== selected) step.open = false;
  });
}
