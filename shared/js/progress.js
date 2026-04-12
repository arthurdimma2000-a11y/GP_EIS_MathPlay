(function(global){
  "use strict";

  function getPageId(pathname){
    return ((pathname || global.location.pathname || "").split("/").pop() || "Activity")
      .replace(/\.html$/i, "");
  }

  function inferLevel(pageFile){
    return (/^(LA|LevelA|Level_A)/i.test(pageFile))
      ? "A"
      : (/^(LB|LevelB|Level_B)/i.test(pageFile))
        ? "B"
        : (/^(LC|LevelC|Level_C)/i.test(pageFile))
          ? "C"
          : "A";
  }

  function inferActivityType(pageFile){
    return (/quiz/i.test(pageFile))
      ? "quiz"
      : (/game/i.test(pageFile))
        ? "game"
        : (/revision/i.test(pageFile))
          ? "revision"
          : (/(trace|tracing)/i.test(pageFile))
            ? "tracing"
            : "lesson";
  }

  function installTracker(options){
    const opts = options || {};
    const saveActivityResult = opts.saveActivityResult;
    const markLoginPing = opts.markLoginPing;

    if (typeof saveActivityResult !== "function" || typeof markLoginPing !== "function") {
      throw new Error("GPProgress.installTracker requires saveActivityResult and markLoginPing");
    }

    const defaultPageId = opts.defaultPageId || getPageId();
    const defaultLevel = opts.defaultLevel || inferLevel(defaultPageId);
    const defaultActivityType = opts.defaultActivityType || inferActivityType(defaultPageId);
    const defaultScore = typeof opts.defaultScore === "number" ? opts.defaultScore : 100;
    const defaultStars = typeof opts.defaultStars === "number" ? opts.defaultStars : 1;
    const defaultSkills = opts.defaultSkills || {
      reading: 1,
      writing: 0,
      speaking: 1,
      listening: 1
    };

    global.GPTrack = {
      async start(pageId){
        try{
          await markLoginPing();
          console.log("GPTrack start:", pageId);
        }catch(err){
          console.warn("GPTrack.start error:", err);
        }
      },

      async finish(payload = {}){
        try{
          const pageId = payload.pageId || getPageId();
          const result = await saveActivityResult({
            pageId,
            level: payload.level || defaultLevel || inferLevel(pageId),
            activityType: payload.activityType || defaultActivityType || inferActivityType(pageId),
            score: typeof payload.score === "number" ? payload.score : defaultScore,
            stars: typeof payload.stars === "number" ? payload.stars : defaultStars,
            skills: payload.skills || defaultSkills,
            ...payload
          });

          console.log("GPTrack finish:", result);
          return result;
        }catch(err){
          console.error("GPTrack.finish error:", err);
          return { ok:false, error:err };
        }
      },

      async realtime(payload = {}){
        try{
          const pageId = payload.pageId || getPageId();
          const result = await saveActivityResult({
            pageId,
            level: payload.level || defaultLevel || inferLevel(pageId),
            activityType: payload.activityType || defaultActivityType || inferActivityType(pageId),
            score: typeof payload.score === "number" ? payload.score : defaultScore,
            stars: typeof payload.stars === "number" ? payload.stars : defaultStars,
            skills: payload.skills || defaultSkills,
            completed: typeof payload.completed === "boolean" ? payload.completed : false,
            realtime: true,
            ...payload
          });
          return result;
        }catch(err){
          return { ok:false, error:err };
        }
      }
    };

    global.finishActivity = async function(overrides = {}){
      const pageId = overrides.pageId || getPageId();
      return await global.GPTrack.finish({
        pageId,
        level: overrides.level || defaultLevel || inferLevel(pageId),
        activityType: overrides.activityType || defaultActivityType || inferActivityType(pageId),
        score: defaultScore,
        stars: defaultStars,
        skills: defaultSkills,
        ...overrides
      });
    };

    global.addEventListener("load", async () => {
      const pageId = getPageId();
      await global.GPTrack.start(pageId || global.document.title || "Activity");
    });

    return global.GPTrack;
  }

  global.GPProgress = {
    getPageId,
    inferLevel,
    inferActivityType,
    installTracker
  };
})(window);
