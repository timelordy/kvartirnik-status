const checkAnswers = {
  ui: { text: "После изменения экрана или кнопок сначала проверьте страницу в браузере.", commands: ["npm run test:browser"] },
  solver: { text: "После изменения правил подсчёта проверьте подбор и размещение квартир.", commands: ["npm run smoke", "npm run solver:layout"] },
  planning: { text: "После изменения размещения проверьте состав квартир и заполнение требований.", commands: ["npm run solution:mix", "npm run requirements:autofill"] },
  layout: { text: "После изменения размеров проверьте размещение, расстояния и привязки.", commands: ["npm run solver:layout", "npm run manual:validation", "npm run placement:space", "npm run llu:snap"] },
  render: { text: "После изменения схемы, подписей, дверей или коридора проверьте готовое изображение.", commands: ["npm run test:render"] },
  assets: { text: "После изменения квартир, дверей или стен проверьте каталог квартир.", commands: ["npm run test:assets"] }
};

function setupChecks(root) {
  const answer = root.querySelector("[data-check-answer]");
  const commands = root.querySelector("[data-check-commands]");
  const technical = commands?.closest("details");
  const buttons = [...root.querySelectorAll("[data-check]")];
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const result = checkAnswers[button.dataset.check];
      answer.textContent = result?.text || "Сначала найдите изменённую часть на странице устройства программы.";
      commands?.replaceChildren(...(result?.commands || []).map((command) => {
        const code = document.createElement("code");
        code.textContent = command;
        return code;
      }));
      if (technical) technical.hidden = false;
      buttons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    });
  });
}

document.querySelectorAll("[data-check-quiz]").forEach(setupChecks);
