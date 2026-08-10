const menu = document.querySelector(".site-menu");
const desktop = window.matchMedia("(min-width: 961px)");

if (menu) {
  const trigger = menu.querySelector(":scope > summary");
  const sync = () => {
    if (desktop.matches) menu.open = true;
    else if (!menu.dataset.mobileReady) {
      menu.open = false;
      menu.dataset.mobileReady = "true";
    }
  };

  sync();
  desktop.addEventListener("change", () => {
    delete menu.dataset.mobileReady;
    sync();
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || desktop.matches || !menu.open) return;
    menu.open = false;
    trigger.focus();
  });
}

const dropdowns = [...document.querySelectorAll("details.nav-menu")];
if (dropdowns.length) {
  document.addEventListener("click", (event) => {
    dropdowns.forEach((dropdown) => {
      if (dropdown.open && !dropdown.contains(event.target)) dropdown.open = false;
    });
  });
  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !dropdown.open) return;
      dropdown.open = false;
      dropdown.querySelector("summary").focus();
    });
  });
}
