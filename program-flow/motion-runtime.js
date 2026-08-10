(function () {
  "use strict";

  var script = document.currentScript;
  var root = document.documentElement;
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var activeAnimations = new Set();
  var animationsByScenario = new Map();
  var activeObservers = new Set();
  var replayTimers = new Set();
  var played = new WeakMap();
  var config = null;

  var EFFECTS = {
    rise: [
      { transform: "translate3d(0, 24px, 0)" },
      { transform: "translate3d(0, 0, 0)" }
    ],
    "soft-scale": [
      { transform: "scale(0.975)" },
      { transform: "scale(1)" }
    ],
    dock: [
      { transform: "translate3d(18px, 12px, 0)" },
      { transform: "translate3d(0, 0, 0)" }
    ],
    "card-settle": [
      { transform: "translate3d(0, 18px, 0) rotate(0.35deg)" },
      { transform: "translate3d(0, 0, 0) rotate(0deg)" }
    ],
    "accent-pop": [
      { transform: "scale(0.88)" },
      { transform: "scale(1)" }
    ],
    "stage-activate": [
      { transform: "scale(0.82)" },
      { transform: "scale(1.08)", offset: 0.72 },
      { transform: "scale(1)" }
    ],
    "progress-draw": [
      { transform: "scaleX(0)" },
      { transform: "scaleX(1)" }
    ],
    "plan-wipe": [
      { clipPath: "inset(0 100% 0 0 round 20px)" },
      { clipPath: "inset(0 0 0 0 round 20px)" }
    ],
    "metric-tick": [
      { transform: "translate3d(0, 18px, 0) scale(0.72)" },
      { transform: "translate3d(0, -2px, 0) scale(1.08)", offset: 0.72 },
      { transform: "translate3d(0, 0, 0) scale(1)" }
    ],
    "check-activate": [
      { transform: "translate3d(-16px, 0, 0)" },
      { transform: "translate3d(0, 0, 0)" }
    ],
    "status-scan": [
      { clipPath: "inset(0 100% 0 0 round 14px)" },
      { clipPath: "inset(0 0 0 0 round 14px)" }
    ],
    "link-ready": [
      { transform: "translate3d(-12px, 0, 0)" },
      { transform: "translate3d(4px, 0, 0)", offset: 0.72 },
      { transform: "translate3d(0, 0, 0)" }
    ],
    "callout-pin": [
      { transform: "scale(0.72)" },
      { transform: "scale(1.08)", offset: 0.72 },
      { transform: "scale(1)" }
    ],
    "copy-reveal": [
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0 0)" }
    ]
  };

  var EASINGS = {
    standard: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    cinematic: "cubic-bezier(0.22, 1, 0.36, 1)",
    snap: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  };

  function setState(state, error) {
    root.dataset.motionState = state;
    if (error) root.dataset.motionError = error;
    else delete root.dataset.motionError;
  }

  function bounded(value, fallback, minimum, maximum) {
    var result = Number(value ?? fallback);
    if (!Number.isFinite(result)) return fallback;
    return Math.min(maximum, Math.max(minimum, result));
  }

  function animationOptions(scene, index, baseDelay) {
    var defaults = config.defaults;
    var ease = scene.ease ?? defaults.ease;
    return {
      duration: bounded(scene.duration, defaults.duration, 160, 3000),
      delay: baseDelay + bounded(scene.delay, 0, 0, 1200)
        + index * bounded(scene.stagger, defaults.stagger, 0, 180),
      easing: EASINGS[ease] ?? EASINGS.cinematic,
      fill: "backwards"
    };
  }

  function hasPlayed(element, sceneId) {
    var sceneIds = played.get(element);
    return sceneIds ? sceneIds.has(sceneId) : false;
  }

  function rememberPlayed(element, sceneId) {
    var sceneIds = played.get(element) ?? new Set();
    sceneIds.add(sceneId);
    played.set(element, sceneIds);
    element.dataset.motionPlayed = Array.from(sceneIds).join(" ");
  }

  function trackAnimation(animation, scenarioId) {
    var scenarioAnimations = animationsByScenario.get(scenarioId) ?? new Set();
    scenarioAnimations.add(animation);
    animationsByScenario.set(scenarioId, scenarioAnimations);
    activeAnimations.add(animation);
    animation.finished.catch(function () {}).finally(function () {
      activeAnimations.delete(animation);
      scenarioAnimations.delete(animation);
      animation.cancel();
    });
  }

  function playElement(element, scenarioId, sceneId, scene, index, baseDelay, force) {
    if (motionQuery.matches || (!force && hasPlayed(element, sceneId))) return;
    rememberPlayed(element, sceneId);
    var animation = element.animate(
      EFFECTS[scene.effect],
      animationOptions(scene, index, baseDelay)
    );
    trackAnimation(animation, scenarioId);
  }

  function queryWithin(scope, selector, maximum) {
    try {
      return Array.from(scope.querySelectorAll(selector)).slice(0, maximum);
    } catch {
      return [];
    }
  }

  function playSequence(scope, scenarioId, scenario, force) {
    var matched = 0;
    scenario.sequence.forEach(function (step, stepIndex) {
      var maximum = bounded(step.maxItems, config.defaults.maxItems, 1, 16);
      var elements = queryWithin(scope, step.selector, maximum);
      var sceneId = scenarioId + ":" + stepIndex;
      var baseDelay = bounded(step.at, 0, 0, 3000);
      elements.forEach(function (element, index) {
        playElement(element, scenarioId, sceneId, step, index, baseDelay, force);
      });
      matched += elements.length;
    });
    return matched;
  }

  function observe(elements, scenarioId, scenario, playVisible) {
    var options = {
      threshold: bounded(scenario.threshold, config.defaults.threshold, 0, 0.75),
      rootMargin: scenario.rootMargin ?? config.defaults.rootMargin
    };
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        playVisible(entry.target, elements.indexOf(entry.target));
        observer.unobserve(entry.target);
      });
    }, options);
    elements.forEach(function (element) { observer.observe(element); });
    activeObservers.add(observer);
  }

  function runSimpleScenario(scenarioId, scenario, elements) {
    var playVisible = function (element, index) {
      playElement(element, scenarioId, scenarioId, scenario, Math.max(index, 0), 0, false);
    };
    if (scenario.trigger === "load") elements.forEach(playVisible);
    else observe(elements, scenarioId, scenario, playVisible);
  }

  function runSequenceScenario(scenarioId, scenario, elements) {
    var playVisible = function (element) {
      playSequence(element, scenarioId, scenario, false);
    };
    if (scenario.trigger === "load") elements.forEach(playVisible);
    else observe(elements, scenarioId, scenario, playVisible);
  }

  function queryScenario(scenario) {
    var maximum = bounded(scenario.maxItems, config.defaults.maxItems, 1, 16);
    return queryWithin(document, scenario.selector, maximum);
  }

  function runScenario(scenarioId) {
    var scenario = config.scenarios[scenarioId];
    var elements = queryScenario(scenario);
    if (elements.length === 0) return 0;
    if (scenario.sequence) runSequenceScenario(scenarioId, scenario, elements);
    else runSimpleScenario(scenarioId, scenario, elements);
    return elements.length;
  }

  function cancelScenario(scenarioId) {
    var scenarioAnimations = animationsByScenario.get(scenarioId);
    if (!scenarioAnimations) return;
    Array.from(scenarioAnimations).forEach(function (animation) { animation.cancel(); });
    scenarioAnimations.clear();
  }

  function sequenceEnd(scenario) {
    return scenario.sequence.reduce(function (latest, step) {
      var duration = bounded(step.duration, config.defaults.duration, 160, 3000);
      var stagger = bounded(step.stagger, config.defaults.stagger, 0, 180);
      var items = bounded(step.maxItems, config.defaults.maxItems, 1, 16);
      return Math.max(latest, bounded(step.at, 0, 0, 3000) + duration + stagger * (items - 1));
    }, 0);
  }

  function bindReplay(scenarioId, scenario) {
    if (!scenario.replaySelector || !scenario.sequence) return;
    queryWithin(document, scenario.replaySelector, 4).forEach(function (button) {
      button.addEventListener("click", function () {
        var scopes = queryScenario(scenario);
        cancelScenario(scenarioId);
        scopes.forEach(function (scope) {
          var count = Number(scope.dataset.motionReplayCount || 0) + 1;
          scope.dataset.motionReplayCount = String(count);
          playSequence(scope, scenarioId, scenario, true);
        });
        button.disabled = true;
        button.dataset.motionReplayState = "playing";
        var timer = window.setTimeout(function () {
          button.disabled = false;
          button.dataset.motionReplayState = "ready";
          replayTimers.delete(timer);
        }, sequenceEnd(scenario) + 120);
        replayTimers.add(timer);
      });
      button.dataset.motionReplayState = "ready";
    });
  }

  function stopMotion() {
    activeObservers.forEach(function (observer) { observer.disconnect(); });
    activeObservers.clear();
    activeAnimations.forEach(function (animation) { animation.cancel(); });
    activeAnimations.clear();
    replayTimers.forEach(function (timer) { window.clearTimeout(timer); });
    replayTimers.clear();
    setState("reduced");
  }

  function validSelector(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 140;
  }

  function validateStep(step) {
    if (!step || typeof step !== "object") return false;
    if (!validSelector(step.selector) || !Object.hasOwn(EFFECTS, step.effect)) return false;
    if (step.at !== undefined && !Number.isFinite(step.at)) return false;
    return true;
  }

  function validateScenario(scenario) {
    if (!scenario || typeof scenario !== "object") return false;
    if (!["load", "view"].includes(scenario.trigger) || !validSelector(scenario.selector)) return false;
    if (scenario.sequence) {
      return Array.isArray(scenario.sequence)
        && scenario.sequence.length > 0
        && scenario.sequence.length <= 8
        && scenario.sequence.every(validateStep);
    }
    return Object.hasOwn(EFFECTS, scenario.effect);
  }

  function validate(nextConfig, routeId) {
    if (!nextConfig || nextConfig.schemaVersion !== 2) return false;
    if (!nextConfig.defaults || !nextConfig.routes || !nextConfig.scenarios) return false;
    var route = nextConfig.routes[routeId];
    if (!Array.isArray(route) || route.length === 0 || route.length > 12) return false;
    return route.every(function (scenarioId) {
      return typeof scenarioId === "string" && validateScenario(nextConfig.scenarios[scenarioId]);
    });
  }

  function start() {
    var routeId = document.body.dataset.motionRoute;
    var scenarioIds = config.routes[routeId];
    var matchCount = scenarioIds.reduce(function (total, scenarioId) {
      return total + runScenario(scenarioId);
    }, 0);
    scenarioIds.forEach(function (scenarioId) {
      bindReplay(scenarioId, config.scenarios[scenarioId]);
    });
    root.dataset.motionScenarioCount = String(scenarioIds.length);
    root.dataset.motionMatchCount = String(matchCount);
    setState("ready");
  }

  async function boot() {
    var routeId = document.body.dataset.motionRoute;
    if (!script || !routeId || !("animate" in Element.prototype) || !("IntersectionObserver" in window)) {
      setState("unavailable", "platform");
      return;
    }
    if (motionQuery.matches) {
      setState("reduced");
      return;
    }
    setState("loading");
    try {
      var url = new URL(script.dataset.motionConfig || "motion-scenarios.json", script.src);
      var response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) throw new Error("motion config HTTP " + response.status);
      var nextConfig = await response.json();
      if (!validate(nextConfig, routeId)) throw new Error("invalid motion config");
      config = nextConfig;
      requestAnimationFrame(start);
    } catch {
      setState("unavailable", "config");
    }
  }

  motionQuery.addEventListener("change", function (event) {
    if (event.matches) stopMotion();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
