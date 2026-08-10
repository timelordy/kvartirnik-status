openContractFromHash();
window.addEventListener("hashchange", openContractFromHash);

function openContractFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById(id);
  if (!(target instanceof HTMLDetailsElement) || !target.classList.contains("module-contract")) return;
  target.open = true;
  requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
}
