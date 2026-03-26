
    let deferredPrompt = null;
    function isStandaloneApp(){
      return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    }

    function syncInstallButtons(){
      const installed = isStandaloneApp();
      const btn = document.getElementById("installBtn");
      const heroBtn = document.getElementById("heroInstallBtn");
      [btn, heroBtn].forEach((node) => {
        if (!node) return;
        node.classList.toggle("hidden", installed);
        node.disabled = installed;
        node.textContent = installed ? "App Installed" : "Install App";
      });
    }

    function showInstallHelp(){
      const ua = navigator.userAgent || "";
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isAndroid = /Android/i.test(ua);
      let message = "Install is not ready yet. Open this app in a supported browser and wait a few seconds.";
      if (isIOS) {
        message = "To install on iPhone or iPad, tap Share and choose Add to Home Screen.";
      } else if (isAndroid) {
        message = "To install on Android, open the browser menu and choose Install app or Add to Home screen.";
      } else {
        message = "To install on PC, use the browser menu and choose Install App or Create Shortcut.";
      }
      if (window.FX && typeof FX.toast === "function") FX.toast(message, "📲", 5200);
      else alert(message);
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      syncInstallButtons();
    });

    async function installPWA(){
      if (!deferredPrompt){
        showInstallHelp();
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      syncInstallButtons();
    }

    window.addEventListener("appinstalled", () => {
      syncInstallButtons();
      if (window.FX && typeof FX.toast === "function") FX.toast("App installed successfully.", "📲", 3200);
    });

    window.addEventListener("load", () => {
      syncInstallButtons();
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js").catch(err => {
          console.warn("Service Worker registration failed:", err);
        });
      }
    });
  


    const ASSET_MAP = {
      "gplogo.jpeg": "assets/images/avatars/gplogo.png",
      "gplogo.png": "assets/images/avatars/gplogo.png",
      "ProfDog.png": "assets/images/avatars/ProfDog.png",
      "ProfBearB.png": "assets/images/shapes/ProfBearB.transparent.png",
      "ProfTangramC.png": "assets/images/shapes/ProfTangramC.png"
    };

    const ASSET = (name) => encodeURI(ASSET_MAP[name] || name || "");
    const HIGHLIGHT_VIDEOS = {
      shape: {
        title: "Click Shapes Video",
        subtitle: "Shape highlights",
        src: "assets/video/ShapeHighlights.mp4"
      },
      polygon: {
        title: "Click Polygon Video",
        subtitle: "Polygon highlights",
        src: "assets/video/PolygonHighlights.mp4"
      },
      tangram: {
        title: "Click Tangram Video",
        subtitle: "Tangram highlights",
        src: "assets/video/TangramHighlights.mp4"
      }
    };

    const REPORT_PAGE = "./ProgressReport.html";

      const STORAGE_KEYS = {
        session: "GP_EIS_STUDENT_SESSION",
        role: "GP_EIS_SELECTED_ROLE",
        level: "gpeis_selected_level",
      activities: "GP_EIS_ACTIVITY_RESULTS",
      progress: "GP_EIS_PROGRESS_MAP",
      lastFile: "GP_EIS_LAST_FILE",
      localStudents: "GP_EIS_LOCAL_STUDENTS",
      localStudentsBackup: "GP_EIS_LOCAL_STUDENTS_BACKUP",
      authGate: "GP_EIS_AUTH_GATE",
      teachers: "GP_EIS_TEACHERS",
      teachersBackup: "GP_EIS_TEACHERS_BACKUP",
        parents: "GP_EIS_PARENTS",
        parentsBackup: "GP_EIS_PARENTS_BACKUP",
        teacherSession: "GP_EIS_TEACHER_SESSION",
        parentSession: "GP_EIS_PARENT_SESSION",
        authVault: "GP_EIS_AUTH_VAULT",
        appOrigin: "GP_EIS_APP_ORIGIN",
        lastTeacherEmail: "GP_EIS_LAST_TEACHER_EMAIL",
        lastParentEmail: "GP_EIS_LAST_PARENT_EMAIL",
        credentialCache: "GP_EIS_CREDENTIAL_CACHE"
      };

      function getCredentialCache(){
        const raw = readStorageCandidates([STORAGE_KEYS.credentialCache], {});
        return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      }

      function setCredentialCache(cache){
        writeStorageMirrors([STORAGE_KEYS.credentialCache], cache && typeof cache === "object" ? cache : {});
      }

      function rememberCredential(role, email, password){
        const normalizedRole = String(role || "").trim().toLowerCase();
        const normalizedEmail = normalizeEmail(email);
        const plainPassword = String(password || "").trim();
        if (!normalizedRole || !normalizedEmail || !plainPassword) return;
        const current = getCredentialCache();
        current[normalizedRole] = current[normalizedRole] && typeof current[normalizedRole] === "object" ? current[normalizedRole] : {};
        current[normalizedRole][normalizedEmail] = {
          email: normalizedEmail,
          password: plainPassword,
          updatedAt: new Date().toISOString()
        };
        setCredentialCache(current);
      }

      function getRememberedCredential(role, email){
        const normalizedRole = String(role || "").trim().toLowerCase();
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedRole || !normalizedEmail) return null;
        const current = getCredentialCache();
        return current && current[normalizedRole] && current[normalizedRole][normalizedEmail]
          ? current[normalizedRole][normalizedEmail]
          : null;
      }

    function storageGetItem(key){
      try{
        const localValue = localStorage.getItem(key);
        if (localValue != null) return localValue;
      }catch(e){}
      try{
        return sessionStorage.getItem(key);
      }catch(e){
        return null;
      }
    }

    function storageSetItem(key, value){
      try{ localStorage.setItem(key, value); }catch(e){}
      try{ sessionStorage.setItem(key, value); }catch(e){}
    }

    function storageRemoveItem(key){
      try{ localStorage.removeItem(key); }catch(e){}
      try{ sessionStorage.removeItem(key); }catch(e){}
    }

    const APP_CONFIG = {
      A: {
        label: "Level A",
        subtitle: "Starter Learning Path",
        avatar: ASSET("ProfDog.png"),
        first: [
          "levels/level-a/week-1/monday/LA2.html",
          "levels/level-a/week-1/monday/LA3.html"
        ],
        weeks: {
          1: [
            "levels/level-a/week-1/monday/LA2.html",
            "levels/level-a/week-1/monday/LA3.html",
            "levels/level-a/week-1/tuesday/LA4.html",
            "levels/level-a/week-1/tuesday/LA5.html",
            "levels/level-a/week-1/wednesday/LA6.html",
            "levels/level-a/week-1/wednesday/LA7.html",
            "levels/level-a/week-1/thursday/LA_Revision1.html",
            "levels/level-a/week-1/friday/LA_Game1.html",
            "levels/level-a/week-1/friday/LA_Quiz1.html"
          ],
          2: [
            "levels/level-a/week-2/monday/LA8.html",
            "levels/level-a/week-2/monday/LA9.html",
            "levels/level-a/week-2/tuesday/LA10.html",
            "levels/level-a/week-2/tuesday/LA11.html",
            "levels/level-a/week-2/wednesday/LA12.html",
            "levels/level-a/week-2/wednesday/LA13.html",
            "levels/level-a/week-2/thursday/LA_Revision2.html",
            "levels/level-a/week-2/friday/LA_Game2.html",
            "levels/level-a/week-2/friday/LA_Quiz2.html"
          ],
          3: [
            "levels/level-a/week-3/monday/LA14.html",
            "levels/level-a/week-3/monday/LA15.html",
            "levels/level-a/week-3/tuesday/LA16.html",
            "levels/level-a/week-3/tuesday/LA17.html",
            "levels/level-a/week-3/wednesday/LA18.html",
            "levels/level-a/week-3/wednesday/LA19.html",
            "levels/level-a/week-3/thursday/LA_Revision3.html",
            "levels/level-a/week-3/friday/LA_Game3.html",
            "levels/level-a/week-3/friday/LA_Quiz3.html"
          ],
          4: [
            "levels/level-a/week-4/monday/LA20.html",
            "levels/level-a/week-4/monday/LA21.html",
            "levels/level-a/week-4/tuesday/LA22.html",
            "levels/level-a/week-4/tuesday/LA23.html",
            "levels/level-a/week-4/wednesday/LA24.html",
            "levels/level-a/week-4/wednesday/LA25.html",
            "levels/level-a/week-4/thursday/LA_Revision4.html",
            "levels/level-a/week-4/friday/LA_Game4.html",
            "levels/level-a/week-4/friday/LA_FinalQuiz.html"
          ]
        }
      },

      B: {
        label: "Level B",
        subtitle: "Intermediate Learning Path",
        avatar: ASSET("ProfBearB.png"),
        first: [
          "levels/level-b/week-1/monday/LB2.html",
          "levels/level-b/week-1/monday/LB3.html"
        ],
        weeks: {
          1: [
            "levels/level-b/week-1/monday/LB2.html",
            "levels/level-b/week-1/monday/LB3.html",
            "levels/level-b/week-1/tuesday/LB4.html",
            "levels/level-b/week-1/tuesday/LB5.html",
            "levels/level-b/week-1/wednesday/LB6.html",
            "levels/level-b/week-1/wednesday/LB7.html",
            "levels/level-b/week-1/thursday/LB_Revision1.html",
            "levels/level-b/week-1/friday/LB_Game1.html",
            "levels/level-b/week-1/friday/LB_Quiz1.html"
          ],
          2: [
            "levels/level-b/week-2/monday/LB8.html",
            "levels/level-b/week-2/monday/LB9.html",
            "levels/level-b/week-2/tuesday/LB10.html",
            "levels/level-b/week-2/tuesday/LB11.html",
            "levels/level-b/week-2/wednesday/LB12.html",
            "levels/level-b/week-2/wednesday/LB13.html",
            "levels/level-b/week-2/thursday/LB_Revision2.html",
            "levels/level-b/week-2/friday/LB_Game2.html",
            "levels/level-b/week-2/friday/LB_Quiz2.html"
          ],
          3: [
            "levels/level-b/week-3/monday/LB14.html",
            "levels/level-b/week-3/monday/LB15.html",
            "levels/level-b/week-3/tuesday/LB16.html",
            "levels/level-b/week-3/tuesday/LB17.html",
            "levels/level-b/week-3/wednesday/LB18.html",
            "levels/level-b/week-3/wednesday/LB19.html",
            "levels/level-b/week-3/thursday/LB_Revision3.html",
            "levels/level-b/week-3/friday/LB_Game3.html",
            "levels/level-b/week-3/friday/LB_Quiz3.html"
          ],
          4: [
            "levels/level-b/week-4/monday/LB20.html",
            "levels/level-b/week-4/monday/LB21.html",
            "levels/level-b/week-4/tuesday/LB22.html",
            "levels/level-b/week-4/tuesday/LB23.html",
            "levels/level-b/week-4/wednesday/LB24.html",
            "levels/level-b/week-4/wednesday/LB25.html",
            "levels/level-b/week-4/thursday/LB_Revision4.html",
            "levels/level-b/week-4/friday/LB_FinalQuiz.html"
          ]
        }
      },

      C: {
        label: "Level C",
        subtitle: "Advanced Learning Path",
        avatar: ASSET("ProfTangramC.png"),
        first: [
          "levels/level-c/week-1/monday/LevelC2.html",
          "levels/level-c/week-1/monday/LevelC3.html"
        ],
        weeks: {
          1: [
            "levels/level-c/week-1/monday/LevelC2.html",
            "levels/level-c/week-1/monday/LevelC3.html",
            "levels/level-c/week-1/tuesday/LevelC4.html",
            "levels/level-c/week-1/tuesday/LevelC5.html",
            "levels/level-c/week-1/wednesday/LevelC6.html",
            "levels/level-c/week-1/wednesday/LevelC7.html",
            "levels/level-c/week-1/thursday/LevelC_Revision1.html",
            "levels/level-c/week-1/friday/LevelC_Game1.html",
            "levels/level-c/week-1/friday/LevelC_Quiz1.html"
          ],
          2: [
            "levels/level-c/week-2/monday/LevelC8.html",
            "levels/level-c/week-2/monday/LevelC9.html",
            "levels/level-c/week-2/tuesday/LevelC10.html",
            "levels/level-c/week-2/tuesday/LevelC11.html",
            "levels/level-c/week-2/wednesday/LevelC12.html",
            "levels/level-c/week-2/wednesday/LevelC13.html",
            "levels/level-c/week-2/thursday/LevelC_Revision2.html",
            "levels/level-c/week-2/friday/LevelC_Game2.html",
            "levels/level-c/week-2/friday/LevelC_Quiz2.html"
          ],
          3: [
            "levels/level-c/week-3/monday/LevelC14.html",
            "levels/level-c/week-3/monday/LevelC15.html",
            "levels/level-c/week-3/tuesday/LevelC16.html",
            "levels/level-c/week-3/tuesday/LevelC17.html",
            "levels/level-c/week-3/wednesday/LevelC18.html",
            "levels/level-c/week-3/wednesday/LevelC19.html",
            "levels/level-c/week-3/thursday/LevelC_Revision3.html",
            "levels/level-c/week-3/friday/LevelC_Game3.html",
            "levels/level-c/week-3/friday/LevelC_Quiz3.html"
          ],
          4: [
            "levels/level-c/week-4/monday/LevelC20.html",
            "levels/level-c/week-4/monday/LevelC21.html",
            "levels/level-c/week-4/tuesday/LevelC22.html",
            "levels/level-c/week-4/tuesday/LevelC23.html",
            "levels/level-c/week-4/wednesday/LevelC24.html",
            "levels/level-c/week-4/wednesday/LevelC25.html",
            "levels/level-c/week-4/thursday/LevelC_Revision4.html",
            "levels/level-c/week-4/friday/LevelC_Game4.html",
            "levels/level-c/week-4/friday/LevelC_Quiz4.html"
          ]
        }
      }
    };

    const DEFAULT_PROGRESS = {
      A: { openWeeks:1, lessons:18, quizzes:10, tracing:14 },
      B: { openWeeks:1, lessons:10, quizzes:6, tracing:8 },
      C: { openWeeks:1, lessons:5, quizzes:2, tracing:3 }
    };

    const DEMO_STUDENTS = {
      "GP-A-001": { pin:"1234", level:"A", name:"Student A1" },
      "GP-B-001": { pin:"1234", level:"B", name:"Student B1" },
      "GP-C-001": { pin:"1234", level:"C", name:"Student C1" }
    };

    const DAY_ORDER = ["monday","tuesday","wednesday","thursday","friday"];
    const DAY_LABELS = {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday"
    };

    const MONTH_HUMAN_IMAGES = [
      "assets/images/roadmap/humans/Aamazing.png",
      "assets/images/roadmap/humans/BabyDog.png",
      "assets/images/roadmap/humans/Beautiful.png",
      "assets/images/roadmap/humans/Beautiful2.png",
      "assets/images/roadmap/humans/BestFriendsForever.png",
      "assets/images/roadmap/humans/BrainStorm2.png",
      "assets/images/roadmap/humans/CalmKid.png",
      "assets/images/roadmap/humans/CoolFam.png",
      "assets/images/roadmap/humans/CuteBoy1.png",
      "assets/images/roadmap/humans/KidCouple.png",
      "assets/images/roadmap/humans/Pretty1.png",
      "assets/images/roadmap/humans/Princess2.png",
      "assets/images/roadmap/humans/Summer.png"
    ];

    function buildMonthHumanPool(){
      const pool = MONTH_HUMAN_IMAGES.slice();
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
      }
      return pool;
    }

    const MONTH_HUMAN_POOL = buildMonthHumanPool();

    const WEEK_STYLE_MAP = {
      1: "red",
      2: "pink",
      3: "orange",
      4: "green"
    };

    const ROADMAP_ANIMALS = [
      "assets/images/roadmap/animals/Elephant.jpg",
      "assets/images/roadmap/animals/Puppy.jpg",
      "assets/images/roadmap/animals/Goat.jpg",
      "assets/images/roadmap/animals/Owl.jpg",
      "assets/images/roadmap/animals/Fox.jpg",
      "assets/images/roadmap/animals/Turtle.jpg",
      "assets/images/roadmap/animals/Lion.jpg",
      "assets/images/roadmap/animals/Parrot.jpg",
      "assets/images/roadmap/animals/Deer.jpg",
      "assets/images/roadmap/animals/Kitten.jpg",
      "assets/images/roadmap/animals/BabyTiger.jpg",
      "assets/images/roadmap/animals/Dolphin.jpg",
      "assets/images/roadmap/animals/Rabbit.jpg",
      "assets/images/roadmap/animals/Pandas.jpg",
      "assets/images/roadmap/animals/Zebra.jpg",
      "assets/images/roadmap/animals/Jaguar.jpg",
      "assets/images/roadmap/animals/Butterfly.jpg",
      "assets/images/roadmap/animals/Rino.jpg",
      "assets/images/roadmap/animals/Coalar.jpg",
      "assets/images/roadmap/animals/Chammeleon.jpg"
    ];

    let selectedLevel = storageGetItem(STORAGE_KEYS.level) || "A";
    let selectedRole = storageGetItem(STORAGE_KEYS.role) || "student";
    let selectedMonth = 1;
    let latestGeneratedStudents = [];
    let modalFiles = [];

    const tabs = Array.from(document.querySelectorAll(".tab"));
    const panels = Array.from(document.querySelectorAll(".panel"));
    const sideLinks = Array.from(document.querySelectorAll(".side-link"));

    const selectedLevelBadge = document.getElementById("selectedLevelBadge");
    const quickLevelText = document.getElementById("quickLevelText");
    const quickGrid = document.getElementById("quickGrid");
    const monthRoadmapGrid = document.getElementById("monthRoadmapGrid");

    const sidebarAvatar = document.getElementById("sidebarAvatar");
    const sidebarLevelTitle = document.getElementById("sidebarLevelTitle");
    const sidebarLevelSub = document.getElementById("sidebarLevelSub");
    const sidebarMonth = document.getElementById("sidebarMonth");
    const sidebarRoleBadge = document.getElementById("sidebarRoleBadge");
    const sidebarWeekBadge = document.getElementById("sidebarWeekBadge");

    const homeSelectedBadge = document.getElementById("homeSelectedBadge");
    const summaryLevel = document.getElementById("summaryLevel");
    const summaryRole = document.getElementById("summaryRole");
    const summaryOpenWeeks = document.getElementById("summaryOpenWeeks");
    const summaryLastLesson = document.getElementById("summaryLastLesson");

    const roleBadgeTop = document.getElementById("roleBadgeTop");

    const lessonsMeta = document.getElementById("lessonsMeta");
    const quizzesMeta = document.getElementById("quizzesMeta");
    const tracingMeta = document.getElementById("tracingMeta");
    const lessonsFill = document.getElementById("lessonsFill");
    const quizzesFill = document.getElementById("quizzesFill");
    const tracingFill = document.getElementById("tracingFill");

    const studentClassIdInput = document.getElementById("studentClassIdInput");
    const studentIdInput = document.getElementById("studentIdInput");
    const studentPinInput = document.getElementById("studentPinInput");
    const studentLevelInput = document.getElementById("studentLevelInput");
    const studentLoginBtn = document.getElementById("studentLoginBtn");
    const studentLoginStatus = document.getElementById("studentLoginStatus");
    const fillDemoStudentBtn = document.getElementById("fillDemoStudentBtn");

    const lessonModal = document.getElementById("lessonModal");
    const lessonChips = document.getElementById("lessonChips");
    const lessonModalTitle = document.getElementById("lessonModalTitle");
    const lessonModalSub = document.getElementById("lessonModalSub");
    const openFirstLessonBtn = document.getElementById("openFirstLessonBtn");

    const highlightVideoModal = document.getElementById("highlightVideoModal");
    const highlightVideoTitle = document.getElementById("highlightVideoTitle");
    const highlightVideoSub = document.getElementById("highlightVideoSub");
    const highlightVideoPlayer = document.getElementById("highlightVideoPlayer");

    const teacherSignupName = document.getElementById("teacherSignupName");
    const teacherSignupSchool = document.getElementById("teacherSignupSchool");
    const teacherSignupEmail = document.getElementById("teacherSignupEmail");
    const teacherSignupPassword = document.getElementById("teacherSignupPassword");
    const teacherSignupStatus = document.getElementById("teacherSignupStatus");
    const teacherLoginEmail = document.getElementById("teacherLoginEmail");
    const teacherLoginPassword = document.getElementById("teacherLoginPassword");
    const teacherLoginStatus = document.getElementById("teacherLoginStatus");
    const teacherForgotPasswordBtn = document.getElementById("teacherForgotPasswordBtn");
    const teacherResetPasswordBtn = document.getElementById("teacherResetPasswordBtn");
    const teacherClassIdInput = document.getElementById("teacherClassIdInput");
    const teacherLevelInput = document.getElementById("teacherLevelInput");
    const teacherStudentCountInput = document.getElementById("teacherStudentCountInput");
    const teacherGeneratorStatus = document.getElementById("teacherGeneratorStatus");
    const studentTableBody = document.getElementById("studentTableBody");

    const parentSignupName = document.getElementById("parentSignupName");
    const parentChildName = document.getElementById("parentChildName");
    const parentChildStudentId = document.getElementById("parentChildStudentId");
    const parentSignupEmail = document.getElementById("parentSignupEmail");
    const parentSignupPassword = document.getElementById("parentSignupPassword");
    const parentSignupStatus = document.getElementById("parentSignupStatus");
    const parentLoginEmail = document.getElementById("parentLoginEmail");
    const parentLoginPassword = document.getElementById("parentLoginPassword");
    const parentLoginStatus = document.getElementById("parentLoginStatus");
    const parentForgotPasswordBtn = document.getElementById("parentForgotPasswordBtn");
    const parentResetPasswordBtn = document.getElementById("parentResetPasswordBtn");

    const sessionBannerTitle = document.getElementById("sessionBannerTitle");
    const sessionBannerSub = document.getElementById("sessionBannerSub");
    const signupTopBtn = document.getElementById("signupTopBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    (function fixImages(){
      document.querySelectorAll("img[src]").forEach(el => {
        const src = el.getAttribute("src");
        if (src) el.src = ASSET(src);
      });
    })();

    const FX = (() => {
      const toastBox = document.getElementById("toasts");
      let audioCtx = null;

      function ctx(){
        if (!audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          audioCtx = new AudioCtx();
        }
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        return audioCtx;
      }

      function beep(freq, start, duration, type="sine", gain=0.04){
        const c = ctx();
        if (!c) return;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.value = 0.0001;
        osc.connect(g);
        g.connect(c.destination);
        const t = c.currentTime + start;
        osc.start(t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.stop(t + duration + 0.02);
      }

      function click(){ beep(720, 0, 0.06, "triangle", 0.035); }
      function soft(){
        beep(540, 0, 0.08, "sine", 0.03);
        beep(680, 0.05, 0.08, "sine", 0.025);
      }
      function success(){
        beep(740, 0, 0.10, "triangle", 0.05);
        beep(988, 0.10, 0.11, "triangle", 0.05);
        beep(1318, 0.22, 0.15, "triangle", 0.055);
      }
      function cheer(){
        beep(523, 0, 0.09, "sine", 0.045);
        beep(659, 0.08, 0.09, "sine", 0.05);
        beep(784, 0.16, 0.10, "sine", 0.055);
        beep(1046, 0.28, 0.14, "triangle", 0.06);
      }
      function warning(){
        beep(380, 0, 0.08, "sawtooth", 0.035);
        beep(300, 0.08, 0.08, "sawtooth", 0.03);
      }

      function toast(message, icon="✨", ms=2600){
        if (!toastBox) return;
        const el = document.createElement("div");
        el.className = "toast";
        el.innerHTML = `<div class="ico">${icon}</div><div class="txt">${message}</div>`;
        toastBox.appendChild(el);
        setTimeout(() => {
          el.style.opacity = "0";
          el.style.transform = "translateY(-6px)";
        }, Math.max(900, ms - 500));
        setTimeout(() => el.remove(), ms);
      }

      return { click, soft, success, cheer, warning, toast };
    })();

    function safePlay(kind){
      try{ if (FX[kind]) FX[kind](); }catch(e){}
    }

    function structuredCloneSafe(obj){
      return JSON.parse(JSON.stringify(obj));
    }

    function getSavedProgress(){
      try{
        const raw = localStorage.getItem(STORAGE_KEYS.progress);
        if (!raw) return structuredCloneSafe(DEFAULT_PROGRESS);
        const parsed = JSON.parse(raw);
        return {
          A: {...DEFAULT_PROGRESS.A, ...(parsed.A || {})},
          B: {...DEFAULT_PROGRESS.B, ...(parsed.B || {})},
          C: {...DEFAULT_PROGRESS.C, ...(parsed.C || {})}
        };
      }catch(e){
        return structuredCloneSafe(DEFAULT_PROGRESS);
      }
    }

    function setSavedProgress(map){
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(map));
    }

    function getActivityResults(){
      try{
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.activities) || "{}");
      }catch(e){
        return {};
      }
    }

    function safeJsonParse(raw, fallback){
      try{
        return raw ? JSON.parse(raw) : fallback;
      }catch(e){
        return fallback;
      }
    }

    function readStorageCandidates(keys, fallback){
      for (const key of keys) {
        const raw = storageGetItem(key);
        if (!raw) continue;
        const parsed = safeJsonParse(raw, fallback);
        if (parsed == null) continue;
        if (Array.isArray(parsed) && !parsed.length) continue;
        if (!Array.isArray(parsed) && typeof parsed === "object" && !Object.keys(parsed || {}).length) continue;
        return parsed;
      }
      return fallback;
    }

    function writeStorageMirrors(keys, value){
      const text = JSON.stringify(value);
      keys.forEach(key => storageSetItem(key, text));
    }

    function getAuthVault(){
      const raw = readStorageCandidates([STORAGE_KEYS.authVault], {});
      const vault = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      return {
        teachers: toRecordList(vault.teachers),
        parents: toRecordList(vault.parents),
        students: Array.isArray(vault.students) ? vault.students.filter(Boolean) : [],
        meta: vault.meta && typeof vault.meta === "object" ? vault.meta : {}
      };
    }

    function setAuthVault(vault){
      const current = getAuthVault();
      const nextVault = {
        teachers: toRecordList(vault && vault.teachers != null ? vault.teachers : current.teachers),
        parents: toRecordList(vault && vault.parents != null ? vault.parents : current.parents),
        students: Array.isArray(vault && vault.students) ? vault.students.filter(Boolean) : current.students,
        meta: {
          ...(current.meta || {}),
          ...(vault && vault.meta && typeof vault.meta === "object" ? vault.meta : {}),
          updatedAt: new Date().toISOString()
        }
      };
      writeStorageMirrors([STORAGE_KEYS.authVault], nextVault);
    }

    function rememberCurrentOrigin(){
        const originValue = window.location.origin || window.location.href || "unknown-origin";
        storageSetItem(STORAGE_KEYS.appOrigin, originValue);
        setAuthVault({
          meta: {
          origin: originValue
        }
      });
        if (navigator.storage && typeof navigator.storage.persist === "function") {
          navigator.storage.persist().catch(() => {});
        }
      }

    let authSyncLoadPromise = null;
    async function getAuthSync(){
        try {
          if (window.GPAuthSyncReady && typeof window.GPAuthSyncReady.then === "function") {
            return await window.GPAuthSyncReady;
          }
          if (window.GPAuthSync) {
            return window.GPAuthSync;
          }
          if (!authSyncLoadPromise) {
            authSyncLoadPromise = import("./shared/js/auth-sync-shared.js")
              .then(() => window.GPAuthSyncReady || window.GPAuthSync || null)
              .catch(() => null);
          }
          const loaded = await authSyncLoadPromise;
          if (loaded && typeof loaded.then === "function") {
            return await loaded;
          }
          return loaded || window.GPAuthSync || null;
        } catch (_) {
          return window.GPAuthSync || null;
        }
      }

    function buildCloudHint(authSync){
      if (authSync) return "";
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return " Cloud sync is currently offline, so only this device's saved records can be used right now.";
      }
      return " Cloud sync is not reachable right now, so saved accounts from other devices may not load until the network or Firestore access is available.";
    }

    function rememberAuthEmail(role, email){
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return;
        if (role === "teacher") {
          storageSetItem(STORAGE_KEYS.lastTeacherEmail, normalizedEmail);
        }
        if (role === "parent") {
          storageSetItem(STORAGE_KEYS.lastParentEmail, normalizedEmail);
        }
      }

      function hydrateRememberedAuthEmails(){
        const rememberedTeacherEmail =
          normalizeEmail(localStorage.getItem(STORAGE_KEYS.lastTeacherEmail)) ||
          normalizeEmail(sessionStorage.getItem(STORAGE_KEYS.lastTeacherEmail)) ||
          normalizeEmail(getTeacherSession()?.email) ||
          normalizeEmail(teacherLoginEmail.value);
        const rememberedParentEmail =
          normalizeEmail(localStorage.getItem(STORAGE_KEYS.lastParentEmail)) ||
          normalizeEmail(sessionStorage.getItem(STORAGE_KEYS.lastParentEmail)) ||
          normalizeEmail(getParentSession()?.email) ||
          normalizeEmail(parentLoginEmail.value);

        if (rememberedTeacherEmail) {
          teacherLoginEmail.value = rememberedTeacherEmail;
          if (!teacherSignupEmail.value) teacherSignupEmail.value = rememberedTeacherEmail;
        }
        if (rememberedParentEmail) {
          parentLoginEmail.value = rememberedParentEmail;
          if (!parentSignupEmail.value) parentSignupEmail.value = rememberedParentEmail;
        }
      }

    function toTimeValue(value){
        const parsed = Date.parse(value || "");
        return Number.isFinite(parsed) ? parsed : 0;
      }

      function preferLatestRecord(current, candidate, fields){
        if (!current) return candidate;
        if (!candidate) return current;
        const keys = Array.isArray(fields) ? fields : [];
        const currentScore = keys.reduce((sum, key) => sum + (String(current[key] || "").trim() ? 1 : 0), 0);
        const candidateScore = keys.reduce((sum, key) => sum + (String(candidate[key] || "").trim() ? 1 : 0), 0);
        if (candidateScore > currentScore) return candidate;
        if (candidateScore < currentScore) return current;
        const currentTime = toTimeValue(current.updatedAt || current.createdAt || current.loginAt);
        const candidateTime = toTimeValue(candidate.updatedAt || candidate.createdAt || candidate.loginAt);
        return candidateTime >= currentTime ? candidate : current;
      }

      function dedupeStudents(list){
        const map = new Map();
        toRecordList(list).forEach(student => {
          if (!student || typeof student !== "object") return;
          const normalized = {
            ...student,
            classId: String(student.classId || "").trim(),
            studentId: String(student.studentId || "").trim().toUpperCase(),
            pin: String(student.pin || "").trim(),
            level: String(student.level || inferLevelFromStudentId(student.studentId) || "").trim().toUpperCase(),
            teacherEmail: normalizeEmail(student.teacherEmail),
            teacherName: String(student.teacherName || "").trim(),
            displayName: String(student.displayName || student.name || "").trim(),
            createdAt: student.createdAt || student.loginAt || new Date().toISOString()
          };
          if (!normalized.studentId) return;
          const key = canonicalStudentId(normalized.studentId);
          const current = map.get(key) || null;
          map.set(
            key,
            preferLatestRecord(current, normalized, ["pin", "classId", "teacherEmail", "teacherName", "displayName", "level"])
          );
        });
        return Array.from(map.values()).filter(Boolean);
      }

      function getLocalStudents(){
        const primary = readStorageCandidates(
          [STORAGE_KEYS.localStudents, STORAGE_KEYS.localStudentsBackup],
          []
        );
        const vaultStudents = getAuthVault().students;
        return dedupeStudents(
          []
            .concat(Array.isArray(primary) ? primary : [])
            .concat(Array.isArray(vaultStudents) ? vaultStudents : [])
            .filter(Boolean)
        );
      }

    function setLocalStudents(list){
        const normalized = dedupeStudents(Array.isArray(list) ? list.filter(Boolean) : []);
        writeStorageMirrors([STORAGE_KEYS.localStudents, STORAGE_KEYS.localStudentsBackup], normalized);
        setAuthVault({ students: normalized });
        rememberCurrentOrigin();
      }

    function normalizeEmail(value){
      return String(value || "").trim().toLowerCase();
    }

    function toRecordList(raw){
      if (Array.isArray(raw)) return raw.filter(Boolean);
      if (raw && typeof raw === "object") {
        if (Array.isArray(raw.items)) return raw.items.filter(Boolean);
        if (Array.isArray(raw.list)) return raw.list.filter(Boolean);
        const values = Object.values(raw).filter(Boolean);
        if (values.length && values.every(v => v && typeof v === "object")) return values;
        return [raw];
      }
      return [];
    }

    function normalizeTeacherRecord(record){
      if (!record || typeof record !== "object") return null;
      const email = normalizeEmail(record.email || record.teacherEmail || record.username);
      if (!email) return null;
      return {
        id: String(record.id || record.teacherId || ("T-" + Date.now())),
        name: String(record.name || record.teacherName || record.fullName || email.split("@")[0] || "").trim(),
        school: String(record.school || record.schoolName || record.center || "").trim(),
        email,
        password: String(record.password || record.passcode || record.pin || "").trim(),
        createdAt: record.createdAt || record.loginAt || new Date().toISOString()
      };
    }

    function normalizeParentRecord(record){
      if (!record || typeof record !== "object") return null;
      const email = normalizeEmail(record.email || record.parentEmail || record.username);
      if (!email) return null;
      return {
        id: String(record.id || record.parentId || ("P-" + Date.now())),
        name: String(record.name || record.parentName || record.fullName || email.split("@")[0] || "").trim(),
        childName: String(record.childName || record.studentName || "").trim(),
        childStudentId: String(record.childStudentId || record.studentId || "").trim().toUpperCase(),
        email,
        password: String(record.password || record.passcode || record.pin || "").trim(),
        createdAt: record.createdAt || record.loginAt || new Date().toISOString()
      };
    }

    function uniqueByEmail(list){
        const map = new Map();
        toRecordList(list).forEach(item => {
          const email = normalizeEmail(item && item.email);
          if (!email) return;
          const current = map.get(email) || null;
          map.set(
            email,
            preferLatestRecord(current, item, ["password", "school", "childStudentId", "childName", "name"])
          );
        });
        return Array.from(map.values()).filter(Boolean);
      }

    function getTeachers(){
      const raw = readStorageCandidates(
        [STORAGE_KEYS.teachers, STORAGE_KEYS.teachersBackup],
        []
      );
      const vaultTeachers = getAuthVault().teachers;
      return uniqueByEmail(
        toRecordList(raw)
          .concat(toRecordList(vaultTeachers))
          .map(normalizeTeacherRecord)
          .filter(Boolean)
      );
    }

    function setTeachers(list){
      const normalized = uniqueByEmail(toRecordList(list).map(normalizeTeacherRecord).filter(Boolean));
      writeStorageMirrors([STORAGE_KEYS.teachers, STORAGE_KEYS.teachersBackup], normalized);
      setAuthVault({ teachers: normalized });
      rememberCurrentOrigin();
    }

    function getParents(){
      const raw = readStorageCandidates(
        [STORAGE_KEYS.parents, STORAGE_KEYS.parentsBackup],
        []
      );
      const vaultParents = getAuthVault().parents;
      return uniqueByEmail(
        toRecordList(raw)
          .concat(toRecordList(vaultParents))
          .map(normalizeParentRecord)
          .filter(Boolean)
      );
    }

    function setParents(list){
      const normalized = uniqueByEmail(toRecordList(list).map(normalizeParentRecord).filter(Boolean));
      writeStorageMirrors([STORAGE_KEYS.parents, STORAGE_KEYS.parentsBackup], normalized);
      setAuthVault({ parents: normalized });
      rememberCurrentOrigin();
    }

    function getTeacherCandidatesByEmail(email){
        const target = normalizeEmail(email);
        if (!target) return [];
        const relatedStudents = getLocalStudents().filter(s => normalizeEmail(s && s.teacherEmail) === target);
        return uniqueByEmail(
          getTeachers()
            .filter(t => normalizeEmail(t.email) === target)
            .concat(
              relatedStudents.map(student => normalizeTeacherRecord({
                id: "T-RECOVER-" + target,
                email: target,
                teacherName: student.teacherName || "",
                school: student.classId || "",
                createdAt: student.createdAt || new Date().toISOString()
              }))
            )
            .filter(Boolean)
        );
      }

      function findTeacherByEmail(email){
        return getTeacherCandidatesByEmail(email)[0] || null;
      }

      function getParentCandidatesByEmail(email){
        const target = normalizeEmail(email);
        if (!target) return [];
        return uniqueByEmail(
          getParents().filter(p => normalizeEmail(p.email) === target)
        );
      }

      function findParentByEmail(email){
        return getParentCandidatesByEmail(email)[0] || null;
      }

    function getStorageSnapshot(){
      const students = getLocalStudents();
      return {
        teachers: getTeachers(),
        parents: getParents(),
        students,
        origin: storageGetItem(STORAGE_KEYS.appOrigin) || (window.location.origin || "")
      };
    }

    function buildStorageHint(role, email){
      const snapshot = getStorageSnapshot();
      const normalizedEmail = normalizeEmail(email);
      if (role === "teacher") {
        const relatedStudents = snapshot.students.filter(s => normalizeEmail(s && s.teacherEmail) === normalizedEmail);
        if (relatedStudents.length) {
          return ` ${relatedStudents.length} student record(s) exist for this teacher email, so the account can be restored from this browser storage.`;
        }
      }
      if (!snapshot.teachers.length && !snapshot.parents.length && !snapshot.students.length) {
        return ` No saved login records were found in the current browser storage. If you used a different app address before, browser data is separate for each address like 127.0.0.1 and localhost.`;
      }
      return "";
    }

    function reconcileAuthRecords(){
      const teachers = getTeachers();
      const parents = getParents();
      const students = getLocalStudents();
      const teacherSession = getTeacherSession();
      const parentSession = getParentSession();

      const teacherMap = new Map(teachers.map(t => [normalizeEmail(t.email), t]));
      students.forEach(student => {
        const email = normalizeEmail(student && student.teacherEmail);
        if (!email || teacherMap.has(email)) return;
        teacherMap.set(email, normalizeTeacherRecord({
          id: "T-LEGACY-" + email,
          email,
          teacherEmail: email,
          teacherName: student.teacherName || "",
          school: student.classId || "",
          createdAt: student.createdAt || new Date().toISOString()
        }));
      });
      if (teacherSession && normalizeEmail(teacherSession.email) && !teacherMap.has(normalizeEmail(teacherSession.email))) {
        teacherMap.set(normalizeEmail(teacherSession.email), normalizeTeacherRecord(teacherSession));
      } else if (teacherSession && normalizeEmail(teacherSession.email)) {
        const existingTeacher = teacherMap.get(normalizeEmail(teacherSession.email));
        teacherMap.set(normalizeEmail(teacherSession.email), normalizeTeacherRecord({
          ...(existingTeacher || {}),
          ...(teacherSession || {})
        }));
      }

      const parentMap = new Map(parents.map(p => [normalizeEmail(p.email), p]));
      if (parentSession && normalizeEmail(parentSession.email) && !parentMap.has(normalizeEmail(parentSession.email))) {
        parentMap.set(normalizeEmail(parentSession.email), normalizeParentRecord(parentSession));
      } else if (parentSession && normalizeEmail(parentSession.email)) {
        const existingParent = parentMap.get(normalizeEmail(parentSession.email));
        parentMap.set(normalizeEmail(parentSession.email), normalizeParentRecord({
          ...(existingParent || {}),
          ...(parentSession || {})
        }));
      }

      setTeachers(Array.from(teacherMap.values()).filter(Boolean));
      setParents(Array.from(parentMap.values()).filter(Boolean));
      setLocalStudents(students);
      rememberCurrentOrigin();
    }

    function getTeacherSession(){
      try{
        return JSON.parse(storageGetItem(STORAGE_KEYS.teacherSession) || "null");
      }catch(e){
        return null;
      }
    }

    function setTeacherSession(data){
      storageSetItem(STORAGE_KEYS.teacherSession, JSON.stringify(data));
      storageSetItem(STORAGE_KEYS.authGate, "1");
      rememberCurrentOrigin();
    }

    function clearTeacherSession(){
      storageRemoveItem(STORAGE_KEYS.teacherSession);
    }

    function getParentSession(){
      try{
        return JSON.parse(storageGetItem(STORAGE_KEYS.parentSession) || "null");
      }catch(e){
        return null;
      }
    }

    function setParentSession(data){
      storageSetItem(STORAGE_KEYS.parentSession, JSON.stringify(data));
      storageSetItem(STORAGE_KEYS.authGate, "1");
      rememberCurrentOrigin();
    }

    function clearParentSession(){
      storageRemoveItem(STORAGE_KEYS.parentSession);
    }

    reconcileAuthRecords();

    function capitalize(word){
      return String(word || "").charAt(0).toUpperCase() + String(word || "").slice(1);
    }

    function getRoleLabel(){
      return capitalize(selectedRole);
    }

    function getSession(){
      try{
        const raw = storageGetItem(STORAGE_KEYS.session);
        return raw ? JSON.parse(raw) : null;
      }catch(e){
        return null;
      }
    }

    function setSession(session){
      storageSetItem(STORAGE_KEYS.session, JSON.stringify(session));
      storageSetItem(STORAGE_KEYS.authGate, "1");
      rememberCurrentOrigin();
    }

    function clearSession(){
      storageRemoveItem(STORAGE_KEYS.session);
      storageRemoveItem(STORAGE_KEYS.authGate);
    }

    async function hydrateCloudSession(){
      const authSync = await getAuthSync().catch(() => null);
      if (!authSync || typeof authSync.getCurrentAuthState !== "function") return;
      try {
        const state = await authSync.getCurrentAuthState();
        if (!state || !state.role) return;
        if (state.role === "teacher") {
          const teacher = normalizeTeacherRecord(state.profile || {});
          if (!teacher || !teacher.email) return;
          setTeachers(getTeachers().filter(t => normalizeEmail(t.email) !== teacher.email).concat(teacher));
          selectedRole = "teacher";
          storageSetItem(STORAGE_KEYS.role, "teacher");
          setTeacherSession({
            id: teacher.uid || teacher.id,
            name: teacher.name,
            school: teacher.school,
            email: teacher.email,
            loginAt: new Date().toISOString()
          });
          clearSession();
          clearParentSession();
        } else if (state.role === "parent") {
          const parent = normalizeParentRecord(state.profile || {});
          if (!parent || !parent.email) return;
          const resolvedLevel = String(inferLevelFromStudentId(parent.childStudentId) || selectedLevel || "A").toUpperCase();
          setParents(getParents().filter(p => normalizeEmail(p.email) !== parent.email).concat(parent));
          selectedRole = "parent";
          selectedLevel = resolvedLevel;
          storageSetItem(STORAGE_KEYS.role, "parent");
          storageSetItem(STORAGE_KEYS.level, resolvedLevel);
          setParentSession({
            id: parent.uid || parent.id,
            name: parent.name,
            email: parent.email,
            childName: parent.childName,
            childStudentId: parent.childStudentId,
            level: resolvedLevel,
            loginAt: new Date().toISOString()
          });
          clearSession();
          clearTeacherSession();
        } else if (state.role === "student") {
          const student = state.profile || {};
          const resolvedLevel = String(student.level || inferLevelFromStudentId(student.studentId) || selectedLevel || "A").toUpperCase();
          selectedRole = "student";
          selectedLevel = resolvedLevel;
          storageSetItem(STORAGE_KEYS.role, "student");
          storageSetItem(STORAGE_KEYS.level, resolvedLevel);
          setSession({
            classId: student.classId || "",
            studentId: student.studentId || "",
            pinMasked: "****",
            level: resolvedLevel,
            authUid: student.authUid || "",
            teacherUid: student.teacherUid || "",
            teacherEmail: student.teacherEmail || "",
            teacherName: student.teacherName || "",
            displayName: student.displayName || student.studentId || "",
            name: student.displayName || student.studentId || "",
            loginAt: new Date().toISOString()
          });
          clearTeacherSession();
          clearParentSession();
        }
      } catch (_) {}
    }

    function normalizeFileKey(file){
      return String(file || "").replace(/^.*[\\/]/, "").trim();
    }

    function inferActivityKind(file, entry){
      const name = normalizeFileKey(file).toLowerCase();
      if (entry && entry.type) {
        const t = String(entry.type).toLowerCase();
        if (t.includes("quiz") || t.includes("final")) return "quiz";
        if (t.includes("trace")) return "tracing";
        if (t.includes("lesson")) return "lesson";
        if (t.includes("game")) return "lesson";
      }
      if (name.includes("quiz") || name.includes("finalquiz") || name.includes("final")) return "quiz";
      if (entry && Number(entry.tracing || 0) > 0) return "tracing";
      if (name.includes("game")) return "lesson";
      if (name.includes("revision")) return "lesson";
      return "lesson";
    }

    function fileBelongsToLevel(file, level){
      const normalized = normalizeFileKey(file);
      const config = APP_CONFIG[level];
      if (!config) return false;
      const all = []
        .concat(config.first || [])
        .concat(...Object.values(config.weeks || {}));
      return all.some(item => normalizeFileKey(item) === normalized);
    }

    function buildLevelTotals(){
      const totals = { A:{ lessons:0, quizzes:0, tracing:0 }, B:{ lessons:0, quizzes:0, tracing:0 }, C:{ lessons:0, quizzes:0, tracing:0 } };

      ["A","B","C"].forEach(level => {
        const conf = APP_CONFIG[level];
        const seen = new Set();
        const files = []
          .concat(conf.first || [])
          .concat(...Object.values(conf.weeks || {}));

        files.forEach(file => {
          const key = normalizeFileKey(file);
          if (!key || seen.has(key)) return;
          seen.add(key);

          const lower = key.toLowerCase();
          if (lower.includes("quiz") || lower.includes("finalquiz") || lower.includes("final")) {
            totals[level].quizzes += 1;
          } else {
            totals[level].lessons += 1;
          }

          if (
            /^la\d+\.html$/i.test(key) ||
            /^lb\d+\.html$/i.test(key) ||
            /^levelc\d+\.html$/i.test(key)
          ) {
            totals[level].tracing += 1;
          }
        });
      });

      return totals;
    }

    const LEVEL_TOTALS = buildLevelTotals();

    function computeProgressFromActivityResults(level){
      const results = getActivityResults();
      const totals = LEVEL_TOTALS[level] || { lessons:1, quizzes:1, tracing:1 };

      let lessonDone = 0;
      let quizDone = 0;
      let tracingDone = 0;
      let foundAny = false;
      let highestWeek = 1;

      Object.entries(results).forEach(([file, entry]) => {
        entry = entry || {};
        const entryLevel = String(entry.level || "").toUpperCase();
        const belongs = entryLevel ? entryLevel === level : fileBelongsToLevel(file, level);
        if (!belongs) return;

        const completed = entry.completed === true || Number(entry.score || 0) > 0 || Number(entry.tracing || 0) > 0;
        if (!completed) return;

        foundAny = true;

        const kind = inferActivityKind(file, entry);
        if (kind === "quiz") quizDone += 1;
        if (kind === "lesson") lessonDone += 1;
        if (kind === "tracing") tracingDone += 1;

        const weekNum = Math.max(1, Number(entry.week || 1));
        if (weekNum > highestWeek) highestWeek = weekNum;
      });

      if (!foundAny) return null;

      return {
        openWeeks: Math.max(1, Math.min(4, highestWeek)),
        lessons: Math.min(100, Math.round((lessonDone / Math.max(1, totals.lessons)) * 100)),
        quizzes: Math.min(100, Math.round((quizDone / Math.max(1, totals.quizzes)) * 100)),
        tracing: Math.min(100, Math.round((tracingDone / Math.max(1, totals.tracing)) * 100))
      };
    }

    function getMergedProgressForLevel(level){
      const realTime = computeProgressFromActivityResults(level);
      if (realTime) {
        const fallback = getSavedProgress()[level] || DEFAULT_PROGRESS[level];
        return {
          openWeeks: Math.max(realTime.openWeeks || 1, Number(fallback.openWeeks || 1)),
          lessons: realTime.lessons,
          quizzes: realTime.quizzes,
          tracing: realTime.tracing
        };
      }
      return getSavedProgress()[level] || DEFAULT_PROGRESS[level];
    }

    function showPanel(id){
      panels.forEach(p => p.classList.remove("active"));
      const panel = document.getElementById(id);
      if (panel) panel.classList.add("active");

      tabs.forEach(tab => {
        tab.setAttribute("aria-selected", tab.dataset.panel === id ? "true" : "false");
      });

      sideLinks.forEach(link => {
        link.classList.toggle("active", link.dataset.panel === id);
      });

      safePlay("click");
    }

    tabs.forEach(tab => tab.addEventListener("click", () => showPanel(tab.dataset.panel)));
    sideLinks.forEach(link => link.addEventListener("click", () => showPanel(link.dataset.panel)));

    function showAuthSubpanel(id){
      document.querySelectorAll(".auth-subpanel").forEach(el => el.classList.remove("active"));
      document.querySelectorAll(".auth-mini-tab").forEach(el => el.classList.remove("active"));
      const sub = document.getElementById(id);
      if (sub) sub.classList.add("active");
      const btn = document.querySelector(`.auth-mini-tab[data-auth-panel="${id}"]`);
      if (btn) btn.classList.add("active");
      showPanel("panel-login");
      safePlay("click");
    }

    document.querySelectorAll(".auth-mini-tab").forEach(btn => {
      btn.addEventListener("click", () => showAuthSubpanel(btn.dataset.authPanel));
    });
    installFieldToggles();

    function syncProgressUI(){
      const current = getMergedProgressForLevel(selectedLevel);
      const openWeeks = Math.max(1, Math.min(4, Number(current.openWeeks || 1)));

      lessonsMeta.textContent = `${current.lessons}%`;
      quizzesMeta.textContent = `${current.quizzes}%`;
      tracingMeta.textContent = `${current.tracing}%`;

      lessonsFill.style.width = `${current.lessons}%`;
      quizzesFill.style.width = `${current.quizzes}%`;
      tracingFill.style.width = `${current.tracing}%`;

      document.getElementById("levelAWeeks").textContent = getMergedProgressForLevel("A").openWeeks;
      document.getElementById("levelBWeeks").textContent = getMergedProgressForLevel("B").openWeeks;
      document.getElementById("levelCWeeks").textContent = getMergedProgressForLevel("C").openWeeks;

      summaryOpenWeeks.textContent = openWeeks;
      sidebarWeekBadge.textContent = `Open Weeks: ${openWeeks}`;
    }

    function shorten(text, len){
      const t = String(text || "");
      return t.length > len ? t.slice(0, len - 1) + "…" : t;
    }

    function syncSessionBanner(){
      const studentSession = getSession();
      const teacherSession = getTeacherSession();
      const parentSession = getParentSession();

      if (teacherSession) {
        sessionBannerTitle.textContent = `Teacher logged in: ${teacherSession.name || teacherSession.email}`;
        sessionBannerSub.textContent = `School: ${teacherSession.school || "N/A"} • You can now generate Student IDs and PINs.`;
        return;
      }

      if (parentSession) {
        sessionBannerTitle.textContent = `Parent logged in: ${parentSession.name || parentSession.email}`;
        sessionBannerSub.textContent = `Child: ${parentSession.childName || "N/A"} • Student ID: ${parentSession.childStudentId || "N/A"}`;
        return;
      }

      if (studentSession) {
        sessionBannerTitle.textContent = `Student logged in: ${studentSession.studentId}`;
        sessionBannerSub.textContent = `Level ${studentSession.level} • Name: ${studentSession.name || studentSession.studentId}`;
        return;
      }

      sessionBannerTitle.textContent = "No active user session";
      sessionBannerSub.textContent = "Please login or signup to continue.";
    }

    function syncLevelUI(){
        reconcileAuthRecords();
        const conf = APP_CONFIG[selectedLevel] || APP_CONFIG.A;
        const lastFile = storageGetItem(STORAGE_KEYS.lastFile) || "None";
        const studentSession = getSession();
        const teacherSession = getTeacherSession();
        const parentSession = getParentSession();
        const hasActiveLogin = !!(
          (studentSession && studentSession.studentId) ||
          (teacherSession && teacherSession.email) ||
          (parentSession && parentSession.email)
        );

        storageSetItem(STORAGE_KEYS.level, selectedLevel);
        storageSetItem(STORAGE_KEYS.role, selectedRole);

      selectedLevelBadge.textContent = "Selected Level: " + selectedLevel;
      quickLevelText.textContent = `Quick Links for ${conf.label} • Month ${selectedMonth}`;
      sidebarAvatar.src = conf.avatar;
      sidebarLevelTitle.textContent = conf.label + " Selected";
      sidebarLevelSub.textContent = conf.subtitle;
      sidebarMonth.textContent = "Month 1";
      sidebarRoleBadge.textContent = "Role: " + getRoleLabel();

      homeSelectedBadge.textContent = conf.label + " • " + getRoleLabel();
      summaryLevel.textContent = selectedLevel;
      summaryRole.textContent = getRoleLabel();
      summaryLastLesson.textContent = shorten(lastFile, 18);
      roleBadgeTop.textContent = "Current Role: " + getRoleLabel();

      if (studentLevelInput && studentLevelInput.dataset.userSelected !== "1") {
        studentLevelInput.value = selectedLevel;
      }

      syncProgressUI();
      renderMonthRoadmap();
      renderQuickLinks();
        syncLoginBoxFromSession();
        syncSessionBanner();
        renderStudentTable();

        signupTopBtn.textContent = hasActiveLogin ? "Login" : "Signup";
        signupTopBtn.classList.toggle("hidden", hasActiveLogin);
        logoutBtn.classList.toggle("hidden", !hasActiveLogin);
      }

    function syncLoginBoxFromSession(){
      const session = getSession();
      const teacherSession = getTeacherSession();
      const parentSession = getParentSession();

      if (session && session.studentId) {
        studentLoginStatus.innerHTML = `<span class="ok">Logged in as ${session.studentId} • ${session.level}</span>`;
      } else {
        studentLoginStatus.innerHTML = `<span class="muted">No active student session yet.</span>`;
      }

      if (teacherSession) {
        teacherLoginStatus.innerHTML = `<span class="ok">Teacher logged in as ${teacherSession.email}</span>`;
      } else {
        teacherLoginStatus.innerHTML = `<span class="muted">No active teacher session yet.</span>`;
      }

      if (parentSession) {
        parentLoginStatus.innerHTML = `<span class="ok">Parent logged in as ${parentSession.email}</span>`;
      } else {
        parentLoginStatus.innerHTML = `<span class="muted">No active parent session yet.</span>`;
      }
    }

    function setRoleOnly(role){
      selectedRole = role;
      storageSetItem(STORAGE_KEYS.role, role);
      syncLevelUI();
      safePlay("soft");
      FX.toast(`${capitalize(role)} mode selected.`, "🎯");
    }

    function selectLevel(level){
      selectedLevel = level;
      syncLevelUI();
      showPanel("panel-links");
      safePlay("soft");
      FX.toast(`${APP_CONFIG[level].label} selected.`, "📚");
    }

    function hasAppAccess(){
      try{
        return !!(
          storageGetItem(STORAGE_KEYS.authGate) ||
          getSession() ||
          getTeacherSession() ||
          getParentSession()
        );
      }catch(e){
        return false;
      }
    }

    function rememberLastFile(file){
      try{
        const normalized = String(file || "").replace(/\\/g, "/").replace(/^\/+/, "");
        storageSetItem(STORAGE_KEYS.lastFile, normalized);
      }catch(e){}
    }

    function resolveAppUrl(target){
      const cleaned = String(target || "").trim().replace(/\\/g, "/");
      if (!cleaned) return "";
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      const relativeTarget = cleaned.replace(/^\/+/, "");
      return new URL(relativeTarget, window.location.origin + "/").toString();
    }

    function gotoFile(file){
      if (!file){
        FX.toast("No lesson file is mapped yet.", "⚠️");
        safePlay("warning");
        return;
      }

      const targetFile = String(file).replace(/\\/g, "/").replace(/^\/+/, "");
      const targetUrl = resolveAppUrl(targetFile);
      rememberLastFile(targetFile);

      const accessCheck = canAccessLessonFile(targetFile);
      if (!accessCheck.ok){
        if (!hasAppAccess()) showPanel("panel-login");
        studentLoginStatus.innerHTML = `<span class="danger">${accessCheck.message}</span>`;
        safePlay("warning");
        FX.toast(accessCheck.message, hasAppAccess() ? "🔒" : "🔐");
        return;
      }

      safePlay("soft");
      window.location.assign(targetUrl);
    }

    function prettyLabel(filename){
      const base = String(filename || "").replace(/^.*[\\/]/,"").replace(/\.html$/i,"");
      if (/Revision/i.test(base)) return "Revision";
      if (/Final/i.test(base)) return "Final Quiz";
      if (/Quiz/i.test(base)) return "Quiz";
      if (/Game/i.test(base)) return "Game";
      return "Lesson";
    }

    function showLessonChooser(title, subtitle, files){
      modalFiles = Array.isArray(files) ? files.slice() : [];
      lessonModalTitle.textContent = title || "Choose a Lesson";
      lessonModalSub.textContent = subtitle || "";
      lessonChips.innerHTML = "";

      if (!modalFiles.length){
        lessonChips.innerHTML = '<div class="muted" style="font-weight:900;">No mapped lesson files yet.</div>';
      } else {
        modalFiles.forEach((file, idx) => {
          const chip = document.createElement("div");
          chip.className = "chip";
          chip.setAttribute("role","button");
          chip.setAttribute("tabindex","0");
          chip.innerHTML = '<span class="n">' + (idx + 1) + '</span><span>' + getLessonDisplayName(file) + '</span>';
          chip.addEventListener("click", () => gotoFile(file));
          chip.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              gotoFile(file);
            }
          });
          lessonChips.appendChild(chip);
        });
      }

      lessonModal.classList.add("show");
      safePlay("click");
    }

    function hideLessonModal(){
      lessonModal.classList.remove("show");
      safePlay("click");
    }

    function closeHighlightVideoModal(){
      highlightVideoModal.classList.remove("show");
      try{
        highlightVideoPlayer.pause();
        highlightVideoPlayer.removeAttribute("src");
        highlightVideoPlayer.load();
      }catch(e){}
      safePlay("click");
    }

    function openHighlightVideo(key){
      const conf = HIGHLIGHT_VIDEOS[key];
      if (!conf) return;
      highlightVideoTitle.textContent = conf.title;
      highlightVideoSub.textContent = conf.subtitle;
      highlightVideoPlayer.src = encodeURI(conf.src);
      try{
        highlightVideoPlayer.currentTime = 0;
        highlightVideoPlayer.load();
      }catch(e){}
      highlightVideoModal.classList.add("show");
      const playPromise = highlightVideoPlayer.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      safePlay("soft");
    }

    document.getElementById("closeLessonModal").addEventListener("click", hideLessonModal);
    lessonModal.addEventListener("click", (e) => {
      if (e.target === lessonModal) hideLessonModal();
    });

    quickGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".day-lesson-btn[data-file]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      gotoFile(btn.dataset.file);
    }, true);

    document.getElementById("closeHighlightVideoModal").addEventListener("click", closeHighlightVideoModal);
    highlightVideoModal.addEventListener("click", (e) => {
      if (e.target === highlightVideoModal) closeHighlightVideoModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lessonModal.classList.contains("show")) hideLessonModal();
      if (e.key === "Escape" && highlightVideoModal.classList.contains("show")) closeHighlightVideoModal();
    });

    document.querySelectorAll("[data-highlight-video]").forEach((btn) => {
      btn.addEventListener("click", () => openHighlightVideo(btn.dataset.highlightVideo));
    });

    openFirstLessonBtn.addEventListener("click", () => {
      if (modalFiles.length) gotoFile(modalFiles[0]);
    });

    function weekFiles(level, week){
      return (APP_CONFIG[level]?.weeks?.[week] || []).filter(Boolean);
    }

    function isWeekUnlocked(level, week){
      return week <= getMergedProgressForLevel(level).openWeeks;
    }

    function getDayFromPath(file){
      const lower = String(file || "").toLowerCase();
      for (const day of DAY_ORDER){
        if (lower.includes(`/${day}/`) || lower.includes(`\\${day}\\`)) return day;
      }
      return "";
    }

    function getWeekFromPath(file){
      const match = String(file || "").replace(/\\/g, "/").match(/\/week-(\d+)\//i);
      return match ? Number(match[1]) : 0;
    }

    function canAccessLessonFile(file){
      if (!hasAppAccess()) return { ok: false, message: "Please login first to open lesson pages." };
      if (selectedMonth !== 1) return { ok: false, message: `Month ${selectedMonth} is not open for lessons yet.` };
      const week = getWeekFromPath(file);
      if (week && !isWeekUnlocked(selectedLevel, week)) {
        return { ok: false, message: `Week ${week} is locked. Complete the open weeks first.` };
      }
      return { ok: true, message: "" };
    }

    function getLessonDisplayName(file){
      const base = String(file || "").replace(/^.*[\\/]/,"").replace(/\.html$/i,"");
      const lower = base.toLowerCase();

      if (lower.includes("revision")) return "Revision";
      if (lower.includes("finalquiz")) return "Final Quiz";
      if (lower.includes("quiz")) return "Quiz";
      if (lower.includes("game")) return "Game";
      return base;
    }

    function groupFilesByDay(files){
      const grouped = {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: []
      };

      (files || []).forEach(file => {
        const day = getDayFromPath(file);
        if (grouped[day]) grouped[day].push(file);
      });

      return grouped;
    }

    function getMonthHumanImage(month){
      return MONTH_HUMAN_POOL[(Math.max(1, month) - 1) % MONTH_HUMAN_POOL.length];
    }

    function buildAnimalPlanForLevel(level){
      const seed = String(level || "A").charCodeAt(0);
      const pool = ROADMAP_ANIMALS.slice();

      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = (seed + (i * 11)) % (i + 1);
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }

      const plan = {};
      let idx = 0;
      for (let week = 1; week <= 4; week += 1) {
        plan[week] = {};
        DAY_ORDER.forEach(day => {
          plan[week][day] = pool[idx % pool.length];
          idx += 1;
        });
      }
      return plan;
    }

    function renderMonthRoadmap(){
      if (!monthRoadmapGrid) return;
      monthRoadmapGrid.innerHTML = "";

      for (let month = 1; month <= 12; month += 1) {
        const monthCard = document.createElement("article");
        monthCard.className = "month-card " + (month === selectedMonth ? "active-month" : "future-month");
        monthCard.classList.add("month-clickable");

        const monthHead = document.createElement("div");
        monthHead.className = "month-head month-simple";
        monthHead.innerHTML = `<h4 class="month-title">Month ${month}</h4>`;

        const monthBody = document.createElement("div");
        monthBody.className = "month-body month-body-simple";

        const figure = document.createElement("div");
        figure.className = "month-figure";
        figure.innerHTML = `<img src="${getMonthHumanImage(month)}" alt="Month ${month} character">`;

        monthBody.appendChild(figure);
        monthCard.appendChild(monthHead);
        monthCard.appendChild(monthBody);
        monthCard.tabIndex = 0;
        monthCard.setAttribute("role", "button");
        monthCard.setAttribute("aria-label", hasAppAccess() ? `Open Month ${month} weeks` : `Login required before opening Month ${month}`);
        monthCard.addEventListener("click", () => {
          if (!hasAppAccess()) {
            showPanel("panel-login");
            studentLoginStatus.innerHTML = `<span class="danger">Please login first before opening Months and Weeks.</span>`;
            FX.toast("Login first to open Months and Weeks.", "🔐");
            safePlay("warning");
            return;
          }
          selectedMonth = month;
          renderMonthRoadmap();
          renderQuickLinks();
          showPanel("panel-links");
          if (month !== 1) {
            FX.toast(`Month ${month} weeks are ready for future lesson planning.`, "📅");
          }
        });
        monthCard.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          monthCard.click();
        });
        monthRoadmapGrid.appendChild(monthCard);
      }
    }

    function renderQuickLinks(){
      quickGrid.innerHTML = "";
      const conf = APP_CONFIG[selectedLevel] || APP_CONFIG.A;
      const animalPlan = buildAnimalPlanForLevel(selectedLevel);
      const monthHasLessons = selectedMonth === 1;
      const accessUnlocked = hasAppAccess();

        for(let week = 1; week <= 4; week++){
          const unlocked = accessUnlocked && monthHasLessons && isWeekUnlocked(selectedLevel, week);
        const files = monthHasLessons ? weekFiles(selectedLevel, week) : [];
        const grouped = groupFilesByDay(files);
        const weekStyle = WEEK_STYLE_MAP[week] || "red";

        const weekCard = document.createElement("article");
        weekCard.className = "week-card";

        const weekTop = document.createElement("div");
        weekTop.className = "week-top";

        const left = document.createElement("div");
        left.innerHTML = `
          <div class="quick-chip">${conf.label}</div>
          <h4 class="week-title">Month ${selectedMonth} • Week ${week}</h4>
        `;

        const right = document.createElement("div");
        right.className = "lock-pill " + (unlocked ? "open" : "locked");
        right.textContent = !accessUnlocked
          ? "Login Required"
          : monthHasLessons
          ? (unlocked ? `Week ${week} Open` : `Week ${week} Locked`)
          : `Planned Week ${week}`;

        weekTop.appendChild(left);
        weekTop.appendChild(right);
        weekCard.appendChild(weekTop);

        const daysGrid = document.createElement("div");
        daysGrid.className = "week-format-grid";

        const weekLabel = document.createElement("div");
        weekLabel.className = `week-label-tv ${weekStyle}`;
        weekLabel.innerHTML = `<div><strong>Week</strong><span>${week}</span></div>`;
        daysGrid.appendChild(weekLabel);

        DAY_ORDER.forEach(day => {
          const dayCard = document.createElement("div");
          dayCard.className = `day-tv ${weekStyle}`;

          const dayHead = document.createElement("div");
          dayHead.className = "day-tv-head";
          dayHead.innerHTML = `
            <div>
              <div class="day-tv-week">Week ${week}</div>
              <h5 class="day-tv-title">${DAY_LABELS[day].slice(0,3).toUpperCase()}</h5>
            </div>
          `;

          const dots = document.createElement("div");
          dots.className = "tv-dots";
          const dotCount = week === 4 ? 6 : 3;
          for (let i = 0; i < dotCount; i += 1) {
            const dot = document.createElement("span");
            dots.appendChild(dot);
          }
          dayHead.appendChild(dots);
          dayCard.appendChild(dayHead);

          const body = document.createElement("div");
          body.className = "day-tv-body";

          const animalPath = animalPlan[week]?.[day];
          const animalVisual = document.createElement("div");
          animalVisual.className = "animal-visual" + (animalPath ? "" : " pending");
          animalVisual.innerHTML = animalPath
            ? `<img src="${animalPath}" alt="" loading="lazy">`
            : `Animal image pending`;
          body.appendChild(animalVisual);

          const lessonStack = document.createElement("div");
          lessonStack.className = "day-lesson-list";

          if (!accessUnlocked) {
            const empty = document.createElement("div");
            empty.className = "empty-day";
            empty.textContent = "Login to reveal lessons.";
            lessonStack.appendChild(empty);
          } else if (!monthHasLessons) {
            const empty = document.createElement("div");
            empty.className = "empty-day";
            empty.textContent = `${DAY_LABELS[day]} plan coming soon.`;
            lessonStack.appendChild(empty);
          } else if (!grouped[day].length){
            const empty = document.createElement("div");
            empty.className = "empty-day";
            empty.textContent = "No lesson listed for this day.";
            lessonStack.appendChild(empty);
          } else {
            grouped[day].forEach(file => {
              const btn = document.createElement("button");
              btn.className = "day-lesson-btn";
              btn.type = "button";
              btn.disabled = !unlocked;
              btn.dataset.file = file;
              btn.textContent = getLessonDisplayName(file);
              lessonStack.appendChild(btn);
            });
          }

          body.appendChild(lessonStack);
          dayCard.appendChild(body);
          daysGrid.appendChild(dayCard);
        });

        weekCard.appendChild(daysGrid);

        const row = document.createElement("div");
        row.className = "row";

        const openWeekBtn = document.createElement("button");
        openWeekBtn.className = "btn " + (unlocked ? "btn-primary" : "btn-soft");
        openWeekBtn.textContent = !accessUnlocked ? "Login Required" : monthHasLessons ? (unlocked ? "Open Week Lessons" : "Week Locked") : "Week Plan";
        openWeekBtn.disabled = !accessUnlocked || !monthHasLessons || !unlocked;
        openWeekBtn.addEventListener("click", () => {
          if (!unlocked) return;
          showLessonChooser(`${conf.label} • Week ${week}`, "Choose a lesson", files);
        });

        const openFirstBtn = document.createElement("button");
        openFirstBtn.className = "btn btn-soft";
        openFirstBtn.textContent = !accessUnlocked ? "Login Required" : monthHasLessons ? "Open First Lesson in Week" : "Coming Soon";
        openFirstBtn.disabled = !accessUnlocked || !monthHasLessons || !unlocked || !files.length;
        openFirstBtn.addEventListener("click", () => {
          if (!unlocked || !files.length) return;
          gotoFile(files[0]);
        });

        row.appendChild(openWeekBtn);
        row.appendChild(openFirstBtn);
        weekCard.appendChild(row);

        quickGrid.appendChild(weekCard);
      }
    }

    function openFirstMappedLesson(level){
      selectedLevel = level;
      syncLevelUI();

      if (!hasAppAccess()) {
        showPanel("panel-login");
        studentLoginStatus.innerHTML = `<span class="danger">Please login first before opening lesson pages.</span>`;
        safePlay("warning");
        FX.toast("Login first to open lessons.", "🔐");
        return;
      }

      const files = APP_CONFIG[level]?.first || [];
      if (files.length === 1) gotoFile(files[0]);
      else showLessonChooser(APP_CONFIG[level].label + " • First Lesson", "Choose a starting lesson", files);
    }

    function goToLogin(role){
      selectedRole = role;
      storageSetItem(STORAGE_KEYS.role, role);
      syncLevelUI();

      safePlay("soft");
      window.location.assign(
        resolveAppUrl(
          REPORT_PAGE + "?role=" + encodeURIComponent(role) +
          "&level=" + encodeURIComponent(selectedLevel)
        )
      );
    }

    function goPortal(portal){
      const base = {
        "report": REPORT_PAGE + "?portal=report",
        "analysis": "./PerformanceAnalysis.html?portal=analysis",
        "teacher-ids": REPORT_PAGE + "?portal=teacher-ids",
        "parent-dashboard": REPORT_PAGE + "?portal=parent-dashboard",
        "admin-dashboard": REPORT_PAGE + "?portal=admin-dashboard"
      }[portal] || (REPORT_PAGE + "?portal=report");

      safePlay("soft");
      window.location.assign(
        resolveAppUrl(
          base +
          "&level=" + encodeURIComponent(selectedLevel) +
          "&role=" + encodeURIComponent(selectedRole)
        )
      );
    }

    function continueLearning(){
      const lastFile = storageGetItem(STORAGE_KEYS.lastFile);
      if (!lastFile){
        showPanel("panel-levels");
        safePlay("warning");
        FX.toast("No recent lesson yet.", "📘");
        return;
      }
      gotoFile(lastFile);
    }

    function unlockDemoProgress(){
      const map = getSavedProgress();
      map.A = { openWeeks:4, lessons:92, quizzes:88, tracing:94 };
      map.B = { openWeeks:3, lessons:68, quizzes:60, tracing:72 };
      map.C = { openWeeks:2, lessons:34, quizzes:28, tracing:31 };
      setSavedProgress(map);
      syncLevelUI();
      safePlay("success");
      FX.toast("Demo progress unlocked.", "🔓");
    }

    function fillDemoStudent(){
      studentClassIdInput.value = "demo-class";
      studentIdInput.value = "GP-A-001";
      studentPinInput.value = "1234";
      studentLevelInput.value = "A";
      studentLevelInput.dataset.userSelected = "1";
      safePlay("click");
      FX.toast("Demo student filled.", "👧");
    }

    function normalizeClassId(value){
      return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
    }

    function canonicalClassId(value){
      return normalizeClassId(value).replace(/[^A-Z0-9]/g, "");
    }

    function normalizeStudentId(value){
      return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    }

    function canonicalStudentId(value){
      return normalizeStudentId(value).replace(/[^A-Z0-9]/g, "");
    }

    function normalizePin(value){
      return String(value || "").trim().replace(/\s+/g, "");
    }

    function inferLevelFromStudentId(studentId){
      const match = String(studentId || "").toUpperCase().match(/^GP-([ABC])-|^GP([ABC])-/);
      return match ? (match[1] || match[2] || "").toUpperCase() : "";
    }

    function installFieldToggles(){
      document.querySelectorAll("[data-toggle-target]").forEach(btn => {
        btn.addEventListener("click", () => {
          const target = document.getElementById(btn.dataset.toggleTarget || "");
          if (!target) return;
          const nextType = target.type === "password" ? "text" : "password";
          target.type = nextType;
          btn.textContent = nextType === "password" ? "Show" : "Hide";
          target.focus({ preventScroll:true });
        });
      });
    }

    function speakAnnouncement(text){
      const message = String(text || "").trim();
      if (!message || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") return;
      try {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = "en-US";
        utterance.rate = 0.96;
        utterance.pitch = 1.02;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (_) {}
    }

    function formatAuthError(roleLabel, error){
      const code = String(error && error.code || "").toLowerCase();
      if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login-credentials")) {
        return `${roleLabel} password is incorrect for that email.`;
      }
      if (code.includes("user-not-found")) {
        return `${roleLabel} account was not found for that email.`;
      }
      if (code.includes("email-already-in-use")) {
        return `${roleLabel} email already exists. Use login or reset password.`;
      }
      if (code.includes("network-request-failed")) {
        return `Network error while contacting ${roleLabel.toLowerCase()} cloud login. Check internet and try again.`;
      }
      if (code.includes("too-many-requests")) {
        return `Too many ${roleLabel.toLowerCase()} login attempts. Please wait and try again.`;
      }
      return `${roleLabel} authentication failed.`;
    }

    async function handleStudentLogin(){
      const classId = normalizeClassId(studentClassIdInput.value);
      const studentId = normalizeStudentId(studentIdInput.value);
      const canonicalId = canonicalStudentId(studentId);
      const pin = normalizePin(studentPinInput.value);
      const selectedInputLevel = (studentLevelInput.value || "A").trim().toUpperCase();

      if (!canonicalId || !pin) {
        studentLoginStatus.innerHTML = `<span class="danger">Please enter Student ID and PIN.</span>`;
        safePlay("warning");
        FX.toast("Enter Student ID and PIN.", "⚠️");
        return;
      }

      let matchedStudent = null;
      const authSync = await getAuthSync();

      const demo = Object.entries(DEMO_STUDENTS).find(([key, value]) =>
        canonicalStudentId(key) === canonicalId && normalizePin(value.pin) === pin
      )?.[1];
      if (demo) {
        matchedStudent = {
          classId: classId || "demo-class",
          studentId: Object.keys(DEMO_STUDENTS).find(key => canonicalStudentId(key) === canonicalId) || studentId,
          pin,
          level: demo.level,
          name: demo.name || studentId
        };
      }

      if (!matchedStudent && authSync && typeof authSync.verifyStudentLogin === "function") {
        try {
          let remoteStudent = await authSync.verifyStudentLogin(studentId, pin, classId);
          if (!remoteStudent && classId) {
            remoteStudent = await authSync.verifyStudentLogin(studentId, pin, "");
          }
          if (remoteStudent) {
            matchedStudent = {
              classId: remoteStudent.classId || classId || "",
              studentId: remoteStudent.studentId || studentId,
              pin,
              level: remoteStudent.level || selectedInputLevel,
              teacherUid: remoteStudent.teacherUid || "",
              teacherEmail: remoteStudent.teacherEmail || "",
              teacherName: remoteStudent.teacherName || "",
              authUid: remoteStudent.authUid || "",
              displayName: remoteStudent.displayName || remoteStudent.name || studentId,
              createdAt: remoteStudent.createdAt || new Date().toISOString()
            };
          }
        } catch (_) {}
      }

      if (!matchedStudent) {
        const localStudents = dedupeStudents(latestGeneratedStudents.concat(getLocalStudents()));
        const primaryMatches = localStudents.filter(s =>
          canonicalStudentId(s.studentId) === canonicalId &&
          normalizePin(s.pin) === pin
        );

        if (primaryMatches.length) {
          const preferred = classId
            ? primaryMatches.find(s => canonicalClassId(s.classId) === canonicalClassId(classId))
            : null;
          matchedStudent = preferred || primaryMatches[0];
        }
      }

      if (!matchedStudent) {
        studentLoginStatus.innerHTML = `<span class="danger">Student ID or PIN not found.${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        FX.toast("Student ID or PIN not found.", "❌");
        return;
      }

      const resolvedLevel = String(
        matchedStudent.level ||
        inferLevelFromStudentId(matchedStudent.studentId || studentId) ||
        selectedInputLevel
      ).toUpperCase();

      selectedLevel = resolvedLevel;
      selectedRole = "student";
      studentLevelInput.value = resolvedLevel;
      studentClassIdInput.value = matchedStudent.classId || classId || "";
      studentIdInput.value = matchedStudent.studentId || studentId;
      studentPinInput.value = matchedStudent.pin || pin;

      setSession({
        classId: matchedStudent.classId || classId || "demo-class",
        studentId: matchedStudent.studentId || studentId,
        pinMasked: "****",
        level: resolvedLevel,
        authUid: matchedStudent.authUid || "",
        teacherUid: matchedStudent.teacherUid || "",
        teacherEmail: matchedStudent.teacherEmail || "",
        teacherName: matchedStudent.teacherName || "",
        displayName: matchedStudent.displayName || matchedStudent.name || studentId,
        name: matchedStudent.displayName || matchedStudent.name || studentId,
        loginAt: new Date().toISOString()
      });
      setLocalStudents(getLocalStudents().concat({
        ...matchedStudent,
        pin,
        level: resolvedLevel,
        classId: matchedStudent.classId || classId || ""
      }));

      clearTeacherSession();
      clearParentSession();

      storageSetItem(STORAGE_KEYS.role, "student");
      storageSetItem(STORAGE_KEYS.level, resolvedLevel);

      const classHint = classId && matchedStudent.classId && canonicalClassId(matchedStudent.classId) !== canonicalClassId(classId)
        ? ` Stored class corrected to ${matchedStudent.classId}.`
        : "";
      studentLoginStatus.innerHTML = `<span class="ok">Login successful for ${matchedStudent.studentId || studentId}.${classHint}</span>`;
      syncLevelUI();
      showPanel("panel-links");
      safePlay("success");
      setTimeout(() => safePlay("cheer"), 140);
      FX.toast(`Welcome ${matchedStudent.displayName || matchedStudent.name || studentId}!`, "🎉", 3200);
      speakAnnouncement("Welcome to GP EIS Online Learning. A bright and professional learning home for students.");
    }

    async function handleTeacherSignup(){
      const name = (teacherSignupName.value || "").trim();
      const school = (teacherSignupSchool.value || "").trim();
      const email = normalizeEmail(teacherSignupEmail.value);
      const password = (teacherSignupPassword.value || "").trim();

      if (!name || !school || !email || !password) {
        teacherSignupStatus.innerHTML = `<span class="danger">Please fill all teacher signup fields.</span>`;
        safePlay("warning");
        return;
      }

      if (password.length < 6) {
        teacherSignupStatus.innerHTML = `<span class="danger">Teacher password must be at least 6 characters.</span>`;
        safePlay("warning");
        return;
      }

      const authSync = await getAuthSync();
      if (!authSync || typeof authSync.saveTeacherAccount !== "function") {
        teacherSignupStatus.innerHTML = `<span class="danger">Teacher cloud signup is not available right now.${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        return;
      }

      try {
        const teacherRecord = normalizeTeacherRecord(await authSync.saveTeacherAccount({
          name,
          school,
          email,
          password,
          createdAt: new Date().toISOString()
        }));

        setTeachers(
          getTeachers()
            .filter(t => normalizeEmail(t.email) !== email)
            .concat(teacherRecord)
        );
        rememberAuthEmail("teacher", email);
        selectedRole = "teacher";
        storageSetItem(STORAGE_KEYS.role, "teacher");
        setTeacherSession({
          id: teacherRecord.uid || teacherRecord.id,
          name: teacherRecord.name,
          school: teacherRecord.school,
          email: teacherRecord.email,
          loginAt: new Date().toISOString()
        });
        clearSession();
        clearParentSession();
        syncLevelUI();
        showAuthSubpanel("teacher-auth");

        teacherSignupStatus.innerHTML = teacherRecord.mode === "existing"
          ? `<span class="ok">Teacher account updated and logged in successfully.</span>`
          : `<span class="ok">Teacher signup successful and logged in.</span>`;
        teacherLoginStatus.innerHTML = `<span class="ok">Teacher login successful.</span>`;
        teacherLoginEmail.value = email;
        teacherLoginPassword.value = "";
        teacherSignupPassword.value = "";
        safePlay("success");
        FX.toast(teacherRecord.mode === "existing" ? "Teacher account restored." : "Teacher signup successful.", "👩‍🏫");
        speakAnnouncement(`Hello Teacher ${teacherRecord.name || teacherRecord.email || ""}.`);
      } catch (error) {
        teacherSignupStatus.innerHTML = `<span class="danger">${formatAuthError("Teacher", error)}</span>`;
        safePlay("warning");
        FX.toast("Teacher signup failed.", "❌");
      }
    }

    async function handleTeacherLogin(){
      const email = normalizeEmail(teacherLoginEmail.value);
      const password = (teacherLoginPassword.value || "").trim();

      if (!email || !password) {
        teacherLoginStatus.innerHTML = `<span class="danger">Please enter teacher email and password.</span>`;
        safePlay("warning");
        return;
      }

      const authSync = await getAuthSync();
      if (!authSync || typeof authSync.verifyTeacherLogin !== "function") {
        teacherLoginStatus.innerHTML = `<span class="danger">Teacher cloud login is not available right now.${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        return;
      }

      try {
        const teacher = normalizeTeacherRecord(await authSync.verifyTeacherLogin(email, password));
        if (!teacher) {
          teacherLoginStatus.innerHTML = `<span class="danger">Teacher account not found or password is incorrect.${buildCloudHint(authSync)}</span>`;
          safePlay("warning");
          FX.toast("Teacher login failed.", "❌");
          return;
        }

        selectedRole = "teacher";
        rememberAuthEmail("teacher", email);
        storageSetItem(STORAGE_KEYS.role, "teacher");
        setTeachers(getTeachers().filter(t => normalizeEmail(t.email) !== email).concat(teacher));
        setTeacherSession({
          id: teacher.uid || teacher.id,
          name: teacher.name,
          school: teacher.school,
          email: teacher.email,
          loginAt: new Date().toISOString()
        });
        clearSession();
        clearParentSession();

        teacherLoginStatus.innerHTML = `<span class="ok">Teacher login successful.</span>`;
        syncLevelUI();
        showAuthSubpanel("teacher-auth");
        safePlay("success");
        FX.toast(`Welcome Teacher ${teacher.name}!`, "🎓");
        speakAnnouncement(`Hello Teacher ${teacher.name || teacher.email || ""}.`);
      } catch (error) {
        teacherLoginStatus.innerHTML = `<span class="danger">${formatAuthError("Teacher", error)}${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        FX.toast("Teacher login failed.", "❌");
      }
    }

    async function handleTeacherForgotPassword(){
      const email = normalizeEmail(teacherLoginEmail.value);
      if (!email) {
        teacherLoginStatus.innerHTML = `<span class="danger">Enter your teacher email first.</span>`;
        safePlay("warning");
        return;
      }
      const authSync = await getAuthSync();
      if (!authSync || typeof authSync.sendTeacherPasswordReset !== "function") {
        teacherLoginStatus.innerHTML = `<span class="danger">Teacher password reset email is not available right now.${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        return;
      }
      try {
        await authSync.sendTeacherPasswordReset(email);
        teacherLoginStatus.innerHTML = `<span class="ok">Teacher password reset email sent to ${email}.</span>`;
        safePlay("success");
        FX.toast("Teacher reset email sent.", "📧");
      } catch (error) {
        teacherLoginStatus.innerHTML = `<span class="danger">${formatAuthError("Teacher", error)}</span>`;
        safePlay("warning");
        FX.toast("Teacher reset email failed.", "❌");
      }
    }

      async function handleTeacherResetPassword(){
        return await handleTeacherForgotPassword();
      }

    async function handleParentSignup(){
      const name = (parentSignupName.value || "").trim();
      const childName = (parentChildName.value || "").trim();
      const childStudentId = normalizeStudentId(parentChildStudentId.value);
      const email = normalizeEmail(parentSignupEmail.value);
      const password = (parentSignupPassword.value || "").trim();

      if (!name || !childName || !childStudentId || !email || !password) {
        parentSignupStatus.innerHTML = `<span class="danger">Please fill all parent signup fields.</span>`;
        safePlay("warning");
        return;
      }

      if (password.length < 6) {
        parentSignupStatus.innerHTML = `<span class="danger">Parent password must be at least 6 characters.</span>`;
        safePlay("warning");
        return;
      }

      const authSync = await getAuthSync();
      if (!authSync || typeof authSync.saveParentAccount !== "function") {
        parentSignupStatus.innerHTML = `<span class="danger">Parent cloud signup is not available right now.${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        return;
      }

      try {
        const parentRecord = normalizeParentRecord(await authSync.saveParentAccount({
          name,
          childName,
          childStudentId,
          email,
          password,
          createdAt: new Date().toISOString()
        }));

        setParents(
          getParents()
            .filter(p => normalizeEmail(p.email) !== email)
            .concat(parentRecord)
        );
        rememberAuthEmail("parent", email);
        selectedRole = "parent";
        storageSetItem(STORAGE_KEYS.role, "parent");
        const resolvedLevel = String(
          inferLevelFromStudentId(parentRecord.childStudentId) || "A"
        ).toUpperCase();
        setParentSession({
          id: parentRecord.uid || parentRecord.id,
          name: parentRecord.name,
          email: parentRecord.email,
          childName: parentRecord.childName,
          childStudentId: parentRecord.childStudentId,
          level: resolvedLevel,
          loginAt: new Date().toISOString()
        });
        clearSession();
        clearTeacherSession();
        syncLevelUI();
        showAuthSubpanel("parent-auth");

        parentSignupStatus.innerHTML = parentRecord.mode === "existing"
          ? `<span class="ok">Parent account updated and logged in successfully.</span>`
          : `<span class="ok">Parent signup successful and logged in.</span>`;
        parentLoginStatus.innerHTML = `<span class="ok">Parent login successful.</span>`;
        parentLoginEmail.value = email;
        parentLoginPassword.value = "";
        parentSignupPassword.value = "";
        safePlay("success");
        FX.toast(parentRecord.mode === "existing" ? "Parent account restored." : "Parent signup successful.", "👨‍👩‍👧");
        speakAnnouncement("Welcome to GP EIS Online Learning. A bright and professional learning home for students.");
      } catch (error) {
        parentSignupStatus.innerHTML = `<span class="danger">${formatAuthError("Parent", error)}</span>`;
        safePlay("warning");
        FX.toast("Parent signup failed.", "❌");
      }
    }

      async function handleParentLogin(){
        const email = normalizeEmail(parentLoginEmail.value);
        const password = (parentLoginPassword.value || "").trim();

      if (!email || !password) {
        parentLoginStatus.innerHTML = `<span class="danger">Please enter parent email and password.</span>`;
        safePlay("warning");
        return;
      }

      const authSync = await getAuthSync();
      if (!authSync || typeof authSync.verifyParentLogin !== "function") {
        parentLoginStatus.innerHTML = `<span class="danger">Parent cloud login is not available right now.${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        return;
      }

      try {
        const parent = normalizeParentRecord(await authSync.verifyParentLogin(email, password));
        if (!parent) {
          parentLoginStatus.innerHTML = `<span class="danger">Parent account not found or password is incorrect.${buildCloudHint(authSync)}</span>`;
          safePlay("warning");
          FX.toast("Parent login failed.", "❌");
          return;
        }

        const linkedStudent = getLocalStudents().find(s => normalizeStudentId(s.studentId) === normalizeStudentId(parent.childStudentId));
        const resolvedLevel = String(
          linkedStudent?.level ||
          inferLevelFromStudentId(parent.childStudentId) ||
          selectedLevel ||
          "A"
        ).toUpperCase();

        selectedRole = "parent";
        rememberAuthEmail("parent", email);
        selectedLevel = resolvedLevel;
        storageSetItem(STORAGE_KEYS.role, "parent");
        storageSetItem(STORAGE_KEYS.level, resolvedLevel);
        setParents(getParents().filter(p => normalizeEmail(p.email) !== email).concat(parent));
        setParentSession({
          id: parent.uid || parent.id,
          name: parent.name,
          email: parent.email,
          childName: parent.childName,
          childStudentId: parent.childStudentId,
          level: resolvedLevel,
          loginAt: new Date().toISOString()
        });
        clearSession();
        clearTeacherSession();

        parentLoginStatus.innerHTML = `<span class="ok">Parent login successful.</span>`;
        syncLevelUI();
        showAuthSubpanel("parent-auth");
        safePlay("success");
        FX.toast(`Welcome ${parent.name}!`, "💖");
        speakAnnouncement("Welcome to GP EIS Online Learning. A bright and professional learning home for students.");
      } catch (error) {
        parentLoginStatus.innerHTML = `<span class="danger">${formatAuthError("Parent", error)}${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        FX.toast("Parent login failed.", "❌");
      }
    }

    async function handleParentForgotPassword(){
      const email = normalizeEmail(parentLoginEmail.value);
      if (!email) {
        parentLoginStatus.innerHTML = `<span class="danger">Enter your parent email first.</span>`;
        safePlay("warning");
        return;
      }
      const authSync = await getAuthSync();
      if (!authSync || typeof authSync.sendParentPasswordReset !== "function") {
        parentLoginStatus.innerHTML = `<span class="danger">Parent password reset email is not available right now.${buildCloudHint(authSync)}</span>`;
        safePlay("warning");
        return;
      }
      try {
        await authSync.sendParentPasswordReset(email);
        parentLoginStatus.innerHTML = `<span class="ok">Parent password reset email sent to ${email}.</span>`;
        safePlay("success");
        FX.toast("Parent reset email sent.", "📧");
      } catch (error) {
        parentLoginStatus.innerHTML = `<span class="danger">${formatAuthError("Parent", error)}</span>`;
        safePlay("warning");
        FX.toast("Parent reset email failed.", "❌");
      }
    }

      async function handleParentResetPassword(){
        return await handleParentForgotPassword();
      }

    function randomPin(){
      return String(Math.floor(1000 + Math.random() * 9000));
    }

    function nextStudentSerial(level, currentStudents){
      const prefix = `GP-${level}-`;
      const sameLevel = currentStudents
        .filter(s => String(s.studentId || "").startsWith(prefix))
        .map(s => parseInt(String(s.studentId).replace(prefix, ""), 10))
        .filter(n => !Number.isNaN(n));

      const next = (sameLevel.length ? Math.max(...sameLevel) : 0) + 1;
      return String(next).padStart(3, "0");
    }

    async function handleGenerateStudents(){
      const teacher = getTeacherSession();
      if (!teacher) {
        teacherGeneratorStatus.innerHTML = `<span class="danger">Teacher must login first before generating Student IDs.</span>`;
        safePlay("warning");
        FX.toast("Teacher login required.", "🔐");
        return;
      }

      const classId = normalizeClassId(teacherClassIdInput.value);
      const level = (teacherLevelInput.value || "A").trim().toUpperCase();
      const count = Math.max(1, Math.min(40, Number(teacherStudentCountInput.value || 1)));

      if (!classId) {
        teacherGeneratorStatus.innerHTML = `<span class="danger">Please enter a Class ID.</span>`;
        safePlay("warning");
        return;
      }

      const students = getLocalStudents();
      const newStudents = [];

      for (let i = 0; i < count; i++) {
        const serial = nextStudentSerial(level, students.concat(newStudents));
        const studentId = `GP-${level}-${serial}`;
        newStudents.push({
          classId,
          studentId,
          pin: randomPin(),
          level,
          teacherEmail: teacher.email,
          teacherName: teacher.name,
          displayName: `${level} Student ${serial}`,
          createdAt: new Date().toISOString()
        });
      }

      const combinedStudents = students.concat(newStudents);
      latestGeneratedStudents = combinedStudents.slice();
      setLocalStudents(combinedStudents);
      renderStudentTable(combinedStudents);
      teacherGeneratorStatus.innerHTML = `<span class="ok">${newStudents.length} Student ID(s) created successfully.</span>`;

      if (newStudents[0]) {
        studentClassIdInput.value = newStudents[0].classId;
        studentIdInput.value = newStudents[0].studentId;
        studentPinInput.value = newStudents[0].pin;
        studentLevelInput.value = newStudents[0].level;
        studentLevelInput.dataset.userSelected = "1";
      }

      safePlay("success");
      setTimeout(() => safePlay("cheer"), 100);
      FX.toast(`${newStudents.length} Student ID(s) generated.`, "🪪", 3200);

      const authSync = await getAuthSync();
      if (authSync && typeof authSync.saveStudents === "function") {
        try {
          await authSync.saveStudents(newStudents);
        } catch (_) {
          teacherGeneratorStatus.innerHTML = `<span class="danger">${newStudents.length} Student ID(s) were created locally, but cloud sync failed. Teacher login may need to be refreshed before students can use the IDs on other devices.</span>`;
        }
      }
    }

    function renderStudentTable(studentList){
      const teacher = getTeacherSession();
      const sourceStudents = Array.isArray(studentList) ? studentList.filter(Boolean) : getLocalStudents();
      const students = teacher && teacher.email
        ? sourceStudents.filter((s) => normalizeEmail(s && s.teacherEmail) === normalizeEmail(teacher.email))
        : sourceStudents;

      if (!students.length) {
        studentTableBody.innerHTML = `<tr><td colspan="6" class="muted">No student IDs generated yet.</td></tr>`;
        return;
      }

      studentTableBody.innerHTML = students.map((s, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${s.classId || ""}</td>
          <td>${s.studentId || ""}</td>
          <td>${s.pin || ""}</td>
          <td>${s.level || ""}</td>
          <td>${s.teacherName || s.teacherEmail || ""}</td>
        </tr>
      `).join("");
    }

    function copyGeneratedStudents(){
      const students = getLocalStudents();
      if (!students.length) {
        FX.toast("No student list to copy yet.", "📋");
        safePlay("warning");
        return;
      }

      const text = students.map((s, i) =>
        `${i + 1}. Class ID: ${s.classId} | Student ID: ${s.studentId} | PIN: ${s.pin} | Level: ${s.level} | Teacher: ${s.teacherName || s.teacherEmail || ""}`
      ).join("\n");

      navigator.clipboard.writeText(text).then(() => {
        teacherGeneratorStatus.innerHTML = `<span class="ok">Student list copied to clipboard.</span>`;
        safePlay("soft");
        FX.toast("Student list copied.", "📋");
      }).catch(() => {
        teacherGeneratorStatus.innerHTML = `<span class="danger">Could not copy automatically. Please copy manually from the table.</span>`;
        safePlay("warning");
      });
    }

    function openParentPortal(){
      const parent = getParentSession();
      if (!parent) {
        parentLoginStatus.innerHTML = `<span class="danger">Please login as parent first.</span>`;
        safePlay("warning");
        FX.toast("Parent login required.", "🔐");
        return;
      }
      goPortal("parent-dashboard");
    }

    async function logoutUser(){
      const authSync = await getAuthSync().catch(() => null);
      if (authSync && typeof authSync.signOutCurrentUser === "function") {
        try { await authSync.signOutCurrentUser(); } catch (_) {}
      }
      clearSession();
      clearTeacherSession();
      clearParentSession();
      storageRemoveItem(STORAGE_KEYS.authGate);
      selectedRole = "student";
      storageSetItem(STORAGE_KEYS.role, "student");
      syncLevelUI();
      studentLoginStatus.innerHTML = `<span class="muted">Logged out.</span>`;
      teacherLoginStatus.innerHTML = `<span class="muted">Logged out.</span>`;
      parentLoginStatus.innerHTML = `<span class="muted">Logged out.</span>`;
      safePlay("soft");
      FX.toast("Logged out successfully.", "👋");
    }

    document.getElementById("goHomeTop").addEventListener("click", () => showPanel("panel-home"));
    document.getElementById("signupTopBtn").addEventListener("click", () => {
      showPanel("panel-login");
      showAuthSubpanel("teacher-auth");
    });
    document.getElementById("demoUnlockBtn").addEventListener("click", unlockDemoProgress);
    document.getElementById("logoutBtn").addEventListener("click", logoutUser);

    document.getElementById("heroStartBtn").addEventListener("click", () => showPanel("panel-levels"));
    document.getElementById("heroContinueBtn").addEventListener("click", continueLearning);
    document.getElementById("heroLoginBtn").addEventListener("click", () => showPanel("panel-login"));

    document.getElementById("sidebarStartBtn").addEventListener("click", () => showPanel("panel-levels"));
    document.getElementById("sidebarContinueBtn").addEventListener("click", continueLearning);
    document.getElementById("sidebarFirstLessonBtn").addEventListener("click", () => openFirstMappedLesson(selectedLevel));

    fillDemoStudentBtn.addEventListener("click", fillDemoStudent);
    studentLoginBtn.addEventListener("click", handleStudentLogin);
    studentLevelInput.addEventListener("change", () => {
      studentLevelInput.dataset.userSelected = "1";
    });
    [
      ["selectLevelABtn", () => selectLevel("A")],
      ["selectLevelBBtn", () => selectLevel("B")],
      ["selectLevelCBtn", () => selectLevel("C")],
      ["openFirstLevelABtn", () => openFirstMappedLesson("A")],
      ["openFirstLevelBBtn", () => openFirstMappedLesson("B")],
      ["openFirstLevelCBtn", () => openFirstMappedLesson("C")]
    ].forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        handler();
      });
    });
    document.getElementById("teacherSignupBtn").addEventListener("click", handleTeacherSignup);
    document.getElementById("teacherLoginBtn").addEventListener("click", handleTeacherLogin);
    teacherForgotPasswordBtn.addEventListener("click", handleTeacherForgotPassword);
    teacherResetPasswordBtn.addEventListener("click", handleTeacherResetPassword);
    document.getElementById("parentSignupBtn").addEventListener("click", handleParentSignup);
    document.getElementById("parentLoginBtn").addEventListener("click", handleParentLogin);
    parentForgotPasswordBtn.addEventListener("click", handleParentForgotPassword);
    parentResetPasswordBtn.addEventListener("click", handleParentResetPassword);
    document.getElementById("generateStudentsBtn").addEventListener("click", handleGenerateStudents);
    document.getElementById("copyStudentsBtn").addEventListener("click", copyGeneratedStudents);
    document.getElementById("openParentPortalBtn").addEventListener("click", openParentPortal);

    studentPinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleStudentLogin();
    });
    teacherLoginPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleTeacherLogin();
    });
    parentLoginPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleParentLogin();
    });

    document.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("pointerdown", () => {
        if (btn.disabled) return;
        safePlay("click");
      }, { passive:true });
    });

    window.addEventListener("storage", syncLevelUI);
    window.addEventListener("focus", syncLevelUI);
    window.addEventListener("pageshow", syncLevelUI);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncLevelUI();
    });

    getAuthSync().then(() => hydrateCloudSession()).then(() => syncLevelUI()).catch(() => null);
    hydrateRememberedAuthEmails();
    syncLevelUI();
    showPanel("panel-home");
  
