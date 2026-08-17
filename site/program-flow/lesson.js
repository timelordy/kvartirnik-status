const checkAnswers = {
  ui: { text: "После изменения экрана или кнопок сначала проверьте страницу в браузере.", gate: "npm run test:fast", commands: ["npm run test:browser"] },
  solver: { text: "После изменения правил подсчёта проверьте подбор и размещение квартир.", gate: "npm run test:fast", commands: ["npm run smoke", "npm run solver:layout"] },
  planning: { text: "После изменения размещения проверьте состав квартир и заполнение требований.", gate: "npm run test:fast", commands: ["npm run solution:mix", "npm run requirements:autofill"] },
  layout: { text: "После изменения размеров проверьте размещение, расстояния и привязки.", gate: "npm run test:fast", commands: ["npm run solver:layout", "npm run manual:validation", "npm run placement:space", "npm run llu:snap"] },
  render: { text: "После изменения схемы, подписей, дверей или коридора проверьте готовое изображение.", gate: "npm run test:fast", commands: ["npm run test:render"] },
  assets: { text: "После изменения квартир, дверей или стен проверьте каталог квартир.", gate: "npm run test:release", commands: ["npm run test:assets"] }
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
      if (result?.gate) {
        const gate = document.createElement("p");
        gate.className = "quiz-answer__gate";
        gate.append(document.createTextNode("Затем общий прогон перед публикацией: "));
        const command = document.createElement("code");
        command.textContent = result.gate;
        gate.append(command);
        answer.append(gate);
      }
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
