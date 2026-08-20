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

/* Обработчик выпадающих подменю удалён вместе с самим подменю: селектор
   details.nav-menu не находил ничего ни на одной странице. */
