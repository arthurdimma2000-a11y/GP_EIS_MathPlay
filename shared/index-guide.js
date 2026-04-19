(() => {
  "use strict";

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    const suppressAutoWelcomeSpeech = window.__GP_SKIP_INDEX_GUIDE_WELCOME__ === true;

    const finger = document.getElementById("gpGuideFinger");
    const bubble = document.getElementById("gpGuideBubble");

    if (!finger || !bubble) return;

    const GUIDE_TEXT = {
      goHomeTop: "Tap Home to return to the main page.",
      signupTopBtn: "Tap Signup to create an account.",
      demoUnlockBtn: "Tap Demo Progress to preview the learning journey.",
      logoutBtn: "Tap Logout to safely sign out.",
      installBtn: "Tap Install App to add GP EIS to your device.",

      heroStartBtn: "Tap Start Learning to begin your adventure.",
      heroContinueBtn: "Tap Continue to return to your last lesson.",
      heroLoginBtn: "Tap Login or Signup to open your account section.",
      heroInstallBtn: "Tap Install App to save this app on your device.",

      sidebarStartBtn: "Tap Start Learning to open the levels.",
      sidebarContinueBtn: "Tap Continue to resume where you stopped.",
      sidebarFirstLessonBtn: "Tap First Lesson to begin from the start."
    };

    const WELCOME_STEPS = [
      { id: "heroLoginBtn", text: "Welcome to GP EIS. Tap Login or Signup first if you already have an account." },
      { id: "heroStartBtn", text: "Or tap Start Learning to explore the levels." },
      { id: "sidebarFirstLessonBtn", text: "You can also tap First Lesson to begin quickly." }
    ];

    const GUIDE_FLOW = [
      { selector: "#heroLoginBtn", text: GUIDE_TEXT.heroLoginBtn },
      { selector: "#heroStartBtn", text: GUIDE_TEXT.heroStartBtn },
      { selector: "#sidebarFirstLessonBtn", text: GUIDE_TEXT.sidebarFirstLessonBtn },
      { selector: ".side-link[data-panel='panel-levels']", text: "Tap Levels to open the weekly lesson activities." },
      { selector: ".month-card.month-clickable[data-month='1']", text: "Tap Month 1 to open the weekly lesson activity contents." },
      { selector: "#quickGrid .day-lesson-btn[data-file]", text: "Tap a lesson name to open the lesson activity page." },
      { selector: "#quickGrid button[data-action='open-week-first'][data-file]", text: "Or tap Open First Lesson in Week to go straight into the lesson." }
    ];

    let guideSequenceTimer = 0;
    let activeGuideIndex = -1;
    let hasPlayedWelcomeSpeech = false;
    let hasAutoGuidedOnce = false;
    let repositionQueued = false;

    function isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }

    function clearGlow() {
      document.querySelectorAll(".guide-glow").forEach((el) => el.classList.remove("guide-glow"));
    }

    function hideGuide() {
      clearTimeout(guideSequenceTimer);
      finger.classList.add("hidden");
      bubble.classList.add("hidden");
      clearGlow();
    }

    function placeGuide(target, text) {
      if (!target || !isVisible(target)) return;

      clearGlow();
      target.classList.add("guide-glow");

      const rect = target.getBoundingClientRect();

      finger.classList.remove("hidden");
      bubble.classList.remove("hidden");

      finger.style.left = `${window.scrollX + rect.right - 28}px`;
      finger.style.top = `${window.scrollY + rect.top - 18}px`;

      bubble.textContent = text || "Tap here to continue.";

      const bubbleWidth = Math.min(260, window.innerWidth - 24);
      const bubbleLeft = Math.max(
        12,
        Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - bubbleWidth - 12)
      );
      const bubbleTop = Math.max(window.scrollY + 12, window.scrollY + rect.top - 78);

      bubble.style.left = `${bubbleLeft}px`;
      bubble.style.top = `${bubbleTop}px`;
    }

    function speak(text) {
      if (!text || !("speechSynthesis" in window)) return;

      try {
        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "en-US";
        utter.rate = 0.96;
        utter.pitch = 1.12;
        utter.volume = 0.9;

        const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
        const preferred =
          voices.find(v => /en/i.test(v.lang) && /female|zira|aria|samantha|google us english/i.test(v.name)) ||
          voices.find(v => /en/i.test(v.lang));

        if (preferred) utter.voice = preferred;

        window.speechSynthesis.speak(utter);
      } catch (_) {}
    }

    function getFlowTarget(entry) {
      if (!entry) return null;
      if (entry.id) return document.getElementById(entry.id);
      if (entry.selector) return document.querySelector(entry.selector);
      return null;
    }

    function scheduleGuideMove(index, delay = 2200) {
      clearTimeout(guideSequenceTimer);
      guideSequenceTimer = setTimeout(() => {
        moveGuideTo(index);
      }, delay);
    }

    function moveGuideTo(index, options = {}) {
      const { speakNow = false, continueFlow = false } = options;
      if (!GUIDE_FLOW.length) return;
      const total = GUIDE_FLOW.length;
      for (let offset = 0; offset < total; offset += 1) {
        const nextIndex = (index + offset + total) % total;
        const entry = GUIDE_FLOW[nextIndex];
        const el = getFlowTarget(entry);
        if (!el || !isVisible(el) || el.disabled) continue;
        activeGuideIndex = nextIndex;
        placeGuide(el, entry.text || "Tap here to continue.");
        if (speakNow) speak(entry.text || "Tap here to continue.");
        if (continueFlow) scheduleGuideMove(nextIndex + 1, 3200);
        return;
      }
    }

    function repositionActiveGuide() {
      if (activeGuideIndex < 0 || repositionQueued) return;
      repositionQueued = true;
      requestAnimationFrame(() => {
        repositionQueued = false;
        const entry = GUIDE_FLOW[activeGuideIndex];
        const el = getFlowTarget(entry);
        if (el && isVisible(el) && !el.disabled) {
          placeGuide(el, entry.text || "Tap here to continue.");
        }
      });
    }

    function moveGuideFromElement(currentEl, delay = 900) {
      if (!currentEl) return;
      const currentIndex = GUIDE_FLOW.findIndex((entry) => {
        const el = getFlowTarget(entry);
        return el === currentEl;
      });
      if (currentIndex >= 0) {
        scheduleGuideMove(currentIndex + 1, delay);
        return;
      }
      if (activeGuideIndex >= 0) {
        scheduleGuideMove(activeGuideIndex + 1, delay);
      }
    }

    function addDecorations() {
      const hero = document.querySelector(".hero");
      if (hero && !hero.dataset.decorated) {
        hero.dataset.decorated = "1";

        const dog = document.createElement("img");
        dog.className = "kid-sticker medium";
        dog.src = "ProfDog.png";
        dog.alt = "";
        dog.style.right = "18px";
        dog.style.bottom = "14px";

        const tangram = document.createElement("img");
        tangram.className = "kid-sticker small";
        tangram.src = "ProfTangramC.png";
        tangram.alt = "";
        tangram.style.left = "22px";
        tangram.style.bottom = "16px";
        tangram.style.animationDelay = ".7s";

        hero.append(dog, tangram);
      }

      const welcomeBox = document.querySelector(".welcome-box");
      if (welcomeBox && !welcomeBox.dataset.decorated) {
        welcomeBox.dataset.decorated = "1";

        const star = document.createElement("div");
        star.textContent = "⭐";
        star.style.position = "absolute";
        star.style.right = "18px";
        star.style.top = "16px";
        star.style.fontSize = "34px";
        star.style.filter = "drop-shadow(0 8px 10px rgba(0,0,0,.14))";
        star.style.animation = "kidFloat 3s ease-in-out infinite";

        const heart = document.createElement("div");
        heart.textContent = "💖";
        heart.style.position = "absolute";
        heart.style.right = "60px";
        heart.style.top = "56px";
        heart.style.fontSize = "22px";
        heart.style.animation = "kidFloat 3.4s ease-in-out infinite";

        welcomeBox.append(star, heart);
      }
    }

    function bindGuides() {
      const ids = [
        "goHomeTop","signupTopBtn","demoUnlockBtn","logoutBtn","installBtn",
        "heroStartBtn","heroContinueBtn","heroLoginBtn","heroInstallBtn",
        "sidebarStartBtn","sidebarContinueBtn","sidebarFirstLessonBtn"
      ];

      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.guideBound === "1") return;

        el.dataset.guideBound = "1";
        const text = GUIDE_TEXT[id] || "Tap here to continue.";

        el.addEventListener("mouseenter", () => placeGuide(el, text));
        el.addEventListener("focus", () => placeGuide(el, text));
        el.addEventListener("mouseleave", hideGuide);

        el.addEventListener("click", () => {
          placeGuide(el, text);
          moveGuideFromElement(el, 1200);
        });
      });

      document.querySelectorAll(".tab[data-panel], .side-link[data-panel]").forEach((el) => {
        if (el.dataset.guideBound === "1") return;
        el.dataset.guideBound = "1";

        const panelName = (el.dataset.panel || "").replace("panel-", "");
        const text = `Tap to open the ${panelName || "next"} section.`;

        el.addEventListener("mouseenter", () => placeGuide(el, text));
        el.addEventListener("focus", () => placeGuide(el, text));
        el.addEventListener("mouseleave", hideGuide);
        el.addEventListener("click", () => {
          placeGuide(el, text);
          moveGuideFromElement(el, 1200);
        });
      });

      document.querySelectorAll(".month-card.month-clickable, .month-week-btn, .lesson-btn, .day-lesson-btn").forEach((el) => {
        if (el.dataset.guideBound === "1") return;
        el.dataset.guideBound = "1";

        const text = "Tap to open this learning part.";

        el.addEventListener("mouseenter", () => placeGuide(el, text));
        el.addEventListener("focus", () => placeGuide(el, text));
        el.addEventListener("mouseleave", hideGuide);
        el.addEventListener("click", () => {
          speak("Opening your learning activity.");
          moveGuideFromElement(el, 1200);
        });
      });

      document.querySelectorAll("input, select, textarea").forEach((el) => {
        if (el.dataset.guideBound === "1") return;
        el.dataset.guideBound = "1";

        let labelText = "Please fill this field.";
        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label) {
            labelText = `Please enter your ${label.textContent.trim()}.`;
          }
        }

        el.addEventListener("focus", () => {
          placeGuide(el, labelText);
          speak(labelText);
        });
      });
    }

    function playWelcomeGuide() {
      const startGuideFlow = (index) => {
        moveGuideTo(index, { continueFlow: !hasAutoGuidedOnce });
        hasAutoGuidedOnce = true;
      };

      if (WELCOME_STEPS.length) {
        const firstVisible = WELCOME_STEPS.find((step) => {
          const el = document.getElementById(step.id);
          return el && isVisible(el);
        });
        if (firstVisible) {
          const entryIndex = GUIDE_FLOW.findIndex((entry) => entry.selector === `#${firstVisible.id}`);
          setTimeout(() => {
            if (entryIndex >= 0) {
              startGuideFlow(entryIndex);
            } else {
              const el = document.getElementById(firstVisible.id);
              if (el) {
                placeGuide(el, firstVisible.text);
                if (!hasPlayedWelcomeSpeech && !suppressAutoWelcomeSpeech) {
                  hasPlayedWelcomeSpeech = true;
                  speak(firstVisible.text);
                }
              }
            }
          }, 1200);
          return;
        }
      }
      setTimeout(() => startGuideFlow(0), 1200);
    }

    function bindHideEvents() {
      window.addEventListener("resize", () => {
        repositionActiveGuide();
      });

      document.addEventListener("scroll", () => {
        repositionActiveGuide();
      }, { passive: true });

      document.addEventListener("click", (event) => {
        const target = event.target.closest("button, .btn, .tab, .side-link, input, select, textarea");
        if (target) {
          moveGuideFromElement(target, 1200);
        }
      });
    }

    addDecorations();
    bindGuides();
    bindHideEvents();
    playWelcomeGuide();

    setTimeout(() => {
      if (!hasPlayedWelcomeSpeech && !suppressAutoWelcomeSpeech) {
        hasPlayedWelcomeSpeech = true;
        speak("Welcome to G P E I S Kids Adventure. Tap login or signup, or tap start learning.");
      }
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
