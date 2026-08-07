/* ═══════════════════════════════════════════════════════════════
   Redouane Benomar — portfolio
   Un seul rAF pour tout ce qui suit le scroll ou la souris :
   pas de listener qui recalcule, pas de layout thrashing.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, n) => a + (b - a) * n;

  /* les animations sont voulues partout : aucun réglage système ne les coupe */
  const REDUCED = false;
  const TOUCH = navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches;

  /* ─────── la boucle unique ─────── */
  const jobs = [];
  const onFrame = (fn) => jobs.push(fn);
  let last = performance.now();
  (function tick(now) {
    const dt = Math.min((now - last) / 16.667, 3); /* en « frames de 60 Hz » */
    last = now;
    for (let i = 0; i < jobs.length; i++) jobs[i](dt, now);
    requestAnimationFrame(tick);
  })(last);

  /* ─────── 1. MENU + HORLOGE ─────── */
  const menuButton = $(".menu-button");
  const mobileNav = $(".mobile-nav");
  const closeMenu = () => {
    menuButton.classList.remove("active");
    mobileNav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  };
  menuButton.addEventListener("click", () => {
    const open = mobileNav.classList.toggle("open");
    menuButton.classList.toggle("active", open);
    menuButton.setAttribute("aria-expanded", String(open));
  });
  $$(".mobile-nav a").forEach((a) => a.addEventListener("click", closeMenu));

  const clock = $("#local-time");
  const fmt = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const drawClock = () => { clock.textContent = fmt.format(new Date()); };
  drawClock();
  setInterval(drawClock, 20000);

  /* ─────── 2. LE RIDEAU D'OUVERTURE ─────── */
  const intro = $(".intro");
  const introCount = $(".intro-count");
  const introLine = $(".intro-line");
  let introDone = REDUCED;

  if (REDUCED) {
    if (intro) intro.remove();
    document.body.classList.add("is-ready");
  } else {
    let p = 0;
    onFrame((dt) => {
      if (introDone) return;
      p = Math.min(100, p + (100 - p) * 0.045 * dt + 0.5 * dt);
      introCount.textContent = String(Math.round(p)).padStart(3, "0");
      introLine.style.transform = `scaleX(${p / 100})`;
      if (p > 99.4 && document.readyState === "complete") {
        introDone = true;
        introCount.textContent = "100";
        intro.classList.add("is-done");
        document.body.classList.add("is-ready");
        revealNow(document.querySelector(".hero"));
      }
    });
    /* filet de sécurité : jamais bloqué par une police ou une image */
    setTimeout(() => {
      if (introDone) return;
      introDone = true;
      intro.classList.add("is-done");
      document.body.classList.add("is-ready");
      revealNow(document.querySelector(".hero"));
    }, 2600);
  }

  /* ─────── 2bis. LANGUE — FR / EN ───────
     On mémorise le français tel qu'écrit dans la page, l'anglais vit
     dans data-en. Les titres sont re-scindés à chaque bascule. */
  const LANG_KEY = "rb-lang";
  const i18n = $$("[data-en]");
  i18n.forEach((el) => { el.dataset.fr = el.innerHTML.trim(); });

  let lang = "fr";
  try { lang = localStorage.getItem(LANG_KEY) || "fr"; } catch (e) {}

  function applyLang(next, replay) {
    lang = next === "en" ? "en" : "fr";
    document.documentElement.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}

    i18n.forEach((el) => {
      const html = el.dataset[lang];
      if (html == null) return;
      const wasIn = el.classList.contains("is-in");
      const wasSplit = el.classList.contains("split");
      el.innerHTML = html;
      if (wasSplit) {
        el.classList.remove("split", "is-in");
        splitWords(el);
        if (wasIn && replay) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
        else if (wasIn) el.classList.add("is-in");
      }
    });

    $$(".lang [data-lang]").forEach((b) => b.classList.toggle("is-on", b.dataset.lang === lang));
    document.dispatchEvent(new CustomEvent("rb:lang", { detail: lang }));
  }

  $(".lang").addEventListener("click", (e) => {
    const picked = e.target.closest("[data-lang]");
    applyLang(picked ? picked.dataset.lang : lang === "fr" ? "en" : "fr", true);
  });

  /* ─────── 3. TEXTE SCINDÉ MOT À MOT ─────── */
  function splitWords(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      if (!node.nodeValue.trim()) return;
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach((part) => {
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        const outer = document.createElement("span");
        outer.className = "w";
        const inner = document.createElement("span");
        inner.className = "w-in";
        inner.textContent = part;
        outer.appendChild(inner);
        frag.appendChild(outer);
      });
      node.parentNode.replaceChild(frag, node);
    });

    $$(".w-in", root).forEach((el, i) => el.style.setProperty("--d", i * 48 + "ms"));
    root.classList.add("split");
  }

  if (lang !== "fr") applyLang(lang, false);
  $$("h1, .section > h2, .about-title h2, .large-text").forEach(splitWords);
  applyLang(lang, false); /* pose l'état visuel du sélecteur */

  /* ─────── 4. RÉVÉLATIONS ─────── */
  const tag = (sel, kind, step = 70, root = document) =>
    $$(sel, root).forEach((el, i) => {
      if (el.hasAttribute("data-reveal")) return;
      el.setAttribute("data-reveal", kind);
      el.style.setProperty("--d", i * step + "ms");
    });

  tag(".hero-meta, .hero .kicker", "fade", 90);
  tag(".hero-intro, .hero-actions, .scroll-note", "up", 110);
  tag(".code-card", "scale");
  tag(".section-top, .section-count", "fade", 60);
  tag(".project", "up", 0);
  tag(".project-copy > div, .project-copy > a", "up", 90);
  tag(".worlds-intro, .carousel", "up", 90);
  tag(".stack-grid article", "up", 90);
  tag(".text-columns p, .text-link, .avatar", "up", 90);
  tag(".contact-copy, .email, .contact-links", "up", 100);
  tag("footer p, footer a", "fade", 80);

  function revealNow(scope) {
    if (!scope) return;
    $$("[data-reveal], .split, .chart", scope).forEach((el) => el.classList.add("is-in"));
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const el = e.target;
        if (e.isIntersecting) {
          if (el.classList.contains("is-in")) return;
          el.classList.add("is-in");
          if (el.dataset.count !== undefined) countUp(el);
        } else {
          /* sorti du champ : on remet à zéro, l'animation rejouera au retour */
          el.classList.remove("is-in");
          if (el.dataset.count !== undefined) resetCount(el);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  const watch = () => {
    $$("[data-reveal], .split, .chart, [data-count]").forEach((el) => io.observe(el));
  };

  /* le hero ne dépend pas du scroll : il se dévoile au lever de rideau */
  if (REDUCED) revealNow(document);

  /* ─────── 5. LE GRAPHE POUSSE ─────── */
  $$(".chart i").forEach((bar, i) => bar.style.setProperty("--d", i * 70 + "ms"));

  /* ─────── 6. LES CHIFFRES MONTENT ─────── */
  $$(".metric-row strong, .metric-row em").forEach((el) => {
    const raw = el.textContent.trim();
    const m = raw.match(/^([^\d-]*)(-?[\d.,]+)(.*)$/);
    if (!m) return;
    el.dataset.count = "";
    el.dataset.pre = m[1];
    el.dataset.val = m[2];
    el.dataset.post = m[3];
    el.textContent = m[1] + "0" + m[3];
  });

  function resetCount(el) {
    el.dataset.run = "";
    el.textContent = el.dataset.pre + "0" + el.dataset.post;
  }

  function countUp(el) {
    const run = String(Date.now());
    el.dataset.run = run;
    const raw = el.dataset.val;
    const grouped = raw.includes(",") && !raw.match(/,\d{1,2}$/);
    const target = parseFloat(grouped ? raw.replace(/,/g, "") : raw.replace(",", "."));
    const decimals = (String(target).split(".")[1] || "").length;
    const start = performance.now();
    const dur = 1500;
    const draw = (now) => {
      const t = clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      const shown = grouped
        ? Math.round(v).toLocaleString("en-US")
        : v.toFixed(decimals);
      if (el.dataset.run !== run) return; /* une autre montée a pris la main */
      el.textContent = el.dataset.pre + shown + el.dataset.post;
      if (t < 1) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  /* ─────── 7. SCROLL : jauge, entête, parallaxe, vitesse ─────── */
  const progress = $(".progress");
  const header = $(".header");
  const parallaxItems = [];

  const registerParallax = () => {
    parallaxItems.length = 0;
    $$("[data-parallax]").forEach((el) => {
      parallaxItems.push({ el, speed: parseFloat(el.dataset.parallax), y: 0 });
    });
  };

  let scrollY = window.scrollY;
  let smoothY = scrollY;
  let velocity = 0;
  let lastScroll = scrollY;
  let docH = 1;
  const measure = () => { docH = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  measure();
  addEventListener("resize", () => { measure(); registerParallax(); }, { passive: true });
  addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });

  onFrame((dt) => {
    smoothY = lerp(smoothY, scrollY, clamp(0.14 * dt, 0, 1));
    velocity = lerp(velocity, scrollY - lastScroll, clamp(0.2 * dt, 0, 1));
    lastScroll = scrollY;

    progress.style.transform = `scaleX(${clamp(scrollY / docH, 0, 1)})`;
    header.classList.toggle("is-scrolled", scrollY > 40);
    header.classList.toggle("is-hidden", scrollY > 400 && velocity > 4 && !mobileNav.classList.contains("open"));

    if (REDUCED) return;
    for (const p of parallaxItems) {
      const rect = p.el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > innerHeight + 200) continue;
      const centre = rect.top + rect.height / 2 - innerHeight / 2;
      p.y = lerp(p.y, -centre * p.speed, clamp(0.12 * dt, 0, 1));
      /* `translate` et non `transform` : se compose avec les rotations du CSS */
      p.el.style.translate = `0 ${p.y.toFixed(2)}px`;
    }
  });

  /* ─────── 8. LE BANDEAU RÉAGIT À LA VITESSE ─────── */
  const track = $(".marquee-track");
  if (track && !REDUCED) {
    track.style.animation = "none";
    let x = 0;
    let skew = 0;
    onFrame((dt) => {
      const half = track.scrollWidth / 2 || 1;
      const boost = clamp(velocity * 0.55, -26, 26);
      x -= (1.1 + Math.abs(boost) * 0.5) * dt;
      if (x <= -half) x += half;
      skew = lerp(skew, clamp(-boost * 0.22, -7, 7), clamp(0.1 * dt, 0, 1));
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
    });
  }

  /* ─────── 9. LIEN DE NAVIGATION ACTIF ─────── */
  const navLinks = $$(".desktop-nav a");
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("section[id]").forEach((s) => spy.observe(s));

  /* ─────── 10. SOURIS : curseur, aimants, inclinaison ─────── */
  function initPointer(startEvent) {
    const cursor = $(".dev-cursor");
    if (!cursor) return;
    document.body.classList.add("has-cursor", "cursor-ready");
    let mx = startEvent ? startEvent.clientX : innerWidth / 2;
    let my = startEvent ? startEvent.clientY : innerHeight / 2;
    let cx = mx, cy = my;

    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });
    addEventListener("mouseleave", () => cursor.style.opacity = "0");
    addEventListener("mouseenter", () => cursor.style.opacity = "");
    addEventListener("mousedown", () => cursor.classList.add("is-clicking"));
    addEventListener("mouseup", () => cursor.classList.remove("is-clicking"));

    $$("a, button").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-active"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
    });
    $$(".project-visual").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-view"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-view"));
    });

    /* aimants : le bouton vient à la souris avant le clic */
    const magnets = $$("[data-magnetic]").map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0, on: false }));
    magnets.forEach((m) => {
      m.el.addEventListener("mouseenter", () => { m.on = true; });
      m.el.addEventListener("mousemove", (e) => {
        const r = m.el.getBoundingClientRect();
        m.tx = (e.clientX - (r.left + r.width / 2)) * 0.32;
        m.ty = (e.clientY - (r.top + r.height / 2)) * 0.42;
      });
      m.el.addEventListener("mouseleave", () => { m.on = false; m.tx = 0; m.ty = 0; });
    });

    /* inclinaison : les visuels suivent le regard */
    const tilts = $$(".tilt").map((el) => ({ el, rx: 0, ry: 0, trx: 0, try_: 0, on: false }));
    tilts.forEach((t) => {
      t.el.addEventListener("mouseenter", () => { t.on = true; t.el.classList.add("is-tilting"); });
      t.el.addEventListener("mousemove", (e) => {
        const r = t.el.getBoundingClientRect();
        t.try_ = ((e.clientX - (r.left + r.width / 2)) / r.width) * 11;
        t.trx = -((e.clientY - (r.top + r.height / 2)) / r.height) * 8;
      });
      t.el.addEventListener("mouseleave", () => {
        t.on = false; t.trx = 0; t.try_ = 0;
        t.el.classList.remove("is-tilting");
        t.el.style.transform = "";
      });
    });

    onFrame((dt) => {
      const k = clamp(0.17 * dt, 0, 1);
      cx = lerp(cx, mx, k);
      cy = lerp(cy, my, k);
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;

      for (const m of magnets) {
        m.x = lerp(m.x, m.tx, clamp(0.16 * dt, 0, 1));
        m.y = lerp(m.y, m.ty, clamp(0.16 * dt, 0, 1));
        if (Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && !m.on) { m.el.style.translate = ""; continue; }
        m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
      }

      for (const t of tilts) {
        if (!t.on) continue;
        t.rx = lerp(t.rx, t.trx, clamp(0.12 * dt, 0, 1));
        t.ry = lerp(t.ry, t.try_, clamp(0.12 * dt, 0, 1));
        t.el.style.transform = `perspective(1100px) rotateX(${t.rx.toFixed(2)}deg) rotateY(${t.ry.toFixed(2)}deg)`;
      }
    });
  }

  /* ─────── 12. LE CARROUSEL DES UNIVERS ───────
     Glisser, lancer, retomber sur ses pieds. Profondeur 3D calculée
     par la boucle unique — aucun recalcul de mise en page par image. */
  (function carousel() {
    const root = $(".carousel");
    if (!root) return;

    const stage = $(".carousel-stage", root);
    const track = $(".carousel-track", root);
    const slides = $$(".slide", root);
    const dotsBox = $(".c-dots", root);
    const countEl = $(".c-count b", root);
    const bar = $(".c-progress i", root);
    const prev = $(".c-prev", root);
    const next = $(".c-next", root);
    const headTag = $(".c-current b", root);
    const headName = $(".c-current em", root);
    const visit = $(".c-visit", root);

    slides.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "c-dot";
      b.setAttribute("aria-label", "Univers " + (i + 1));
      b.addEventListener("click", () => { stopAuto(); go(i); });
      dotsBox.appendChild(b);
    });
    const dots = $$(".c-dot", root);

    /* si de vraies captures sont déposées dans shots/, elles se fondent
       par-dessus la miniature ; sinon la miniature codée reste, seule. */
    const SHOT_FILE = { origin: "origin", nebula: "nebula", rock: "black-rock",
                        diamond: "diamond", nature: "nature", neon: "neon" };
    slides.forEach((s) => {
      const mini = $(".mini", s);
      const key = [...mini.classList].map((c) => c.replace("mini--", "")).find((c) => SHOT_FILE[c]);
      if (!key) return;
      const tryExt = ["jpg", "png", "webp"];
      const load = (n) => {
        if (n >= tryExt.length) return;
        const img = new Image();
        img.className = "mini-shot";
        img.alt = "";
        img.decoding = "async";
        img.onload = () => {
          mini.appendChild(img);
          requestAnimationFrame(() => img.classList.add("is-on"));
        };
        img.onerror = () => load(n + 1);
        img.src = "shots/" + SHOT_FILE[key] + "." + tryExt[n];
      };
      load(0);
    });

    let index = 0;
    let step = 1, base = 0, stageW = 1, slideW = 1;
    let x = 0, target = 0, appliedX = 0, spring = 0;
    let dragging = false, captured = false, startX = 0, startTarget = 0, startIndex = 0;
    let moved = 0, vel = 0, lastPointer = 0;
    let suppressClick = false, suppressTimer = null;
    let auto = null;

    /* On ne devine aucune marge : on mesure où se trouve vraiment la
       première carte, transformation en cours déduite. Juste sur tout écran. */
    function measureCarousel() {
      const sr = stage.getBoundingClientRect();
      const fr = slides[0].getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(track).gap) || 24;
      slideW = fr.width;
      step = slideW + gap;
      stageW = sr.width;
      const offset = fr.left - sr.left - appliedX; /* le retrait interne, quel qu'il soit */
      base = stageW / 2 - slideW / 2 - offset;
      /* hauteur du milieu de la scène : les flèches s'y alignent au pixel */
      root.style.setProperty("--mid", (stage.offsetTop + stage.offsetHeight / 2) + "px");
      target = base - index * step;
      if (!dragging) { x = target; spring = 0; }
    }

    function go(i) {
      index = clamp(i, 0, slides.length - 1);
      target = base - index * step;
      countEl.textContent = String(index + 1).padStart(2, "0");
      dots.forEach((d, k) => d.classList.toggle("is-on", k === index));
      slides.forEach((s, k) => s.classList.toggle("is-active", k === index));
      prev.disabled = index === 0;
      next.disabled = index === slides.length - 1;
      syncHead();
    }

    /* le bandeau du haut : toujours l'univers sous les yeux, et un vrai
       lien pour y aller — le glissement ne peut donc jamais gêner la visite */
    function syncHead() {
      const s = slides[index];
      const tagEl = $(".slide-tag", s);
      const nameEl = $("h3", s);
      if (headTag && tagEl) headTag.textContent = tagEl.textContent.trim();
      if (headName && nameEl) headName.textContent = nameEl.textContent.trim();
      if (visit && s.dataset.url) visit.href = s.dataset.url;
    }
    document.addEventListener("rb:lang", () => { syncHead(); });

    /* ── autoplay : il s'efface dès la première main posée ── */
    function startAuto() {
      if (auto) return;
      auto = setInterval(() => {
        if (document.hidden) return;
        go(index >= slides.length - 1 ? 0 : index + 1);
      }, 5200);
    }
    function stopAuto() { clearInterval(auto); auto = null; }
    root.addEventListener("pointerenter", stopAuto);
    root.addEventListener("focusin", stopAuto);

    prev.addEventListener("click", () => { stopAuto(); go(index - 1); });
    next.addEventListener("click", () => { stopAuto(); go(index + 1); });

    /* ── glisser ── */
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      stopAuto();
      dragging = true;
      captured = false;
      moved = 0;
      vel = 0;
      startX = lastPointer = e.clientX;
      startTarget = target;
      startIndex = index;
      root.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.abs(dx);
      /* la capture n'arrive qu'une fois le glissement avéré : prise trop tôt,
         elle confisquerait le clic destiné aux liens des cartes. */
      if (!captured && moved > 6) {
        captured = true;
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (!captured) return;
      vel = e.clientX - lastPointer;
      lastPointer = e.clientX;
      const over = 0.3; /* résistance aux extrémités */
      let want = startTarget + dx;
      const max = base, min = base - (slides.length - 1) * step;
      if (want > max) want = max + (want - max) * over;
      if (want < min) want = min + (want - min) * over;
      target = want;
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove("is-dragging");
      if (captured && e && e.pointerId != null) {
        try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      /* un seul clic est neutralisé, celui qui suit le glissement — et il
         se périme tout seul : plus rien ne reste bloqué ensuite */
      if (moved > 8) {
        suppressClick = true;
        clearTimeout(suppressTimer);
        suppressTimer = setTimeout(() => { suppressClick = false; }, 300);
      }
      moved = 0;
      if (!captured) return;
      /* toujours dans un cran : on compte les crans parcourus, jamais entre deux */
      const dx = lastPointer - startX;
      let steps = Math.round(-dx / step);
      if (steps === 0 && Math.abs(vel) > 5) steps = vel < 0 ? 1 : -1;
      go(startIndex + steps);
    };
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", release);
    /* un glissement n'est pas un clic — mais un seul, et pas les suivants */
    root.addEventListener("click", (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      clearTimeout(suppressTimer);
      e.preventDefault();
      e.stopPropagation();
    }, true);

    /* ── la carte entière est cliquable ──
       de côté : elle vient au centre. Au centre : elle ouvre l'univers. */
    slides.forEach((s, i) => {
      s.addEventListener("click", (e) => {
        if (i !== index) { e.preventDefault(); stopAuto(); go(i); return; }
        if (e.target.closest("a")) return; /* lien natif : on le laisse faire */
        const link = $(".mini-link", s);
        if (link) link.click();
      });
    });

    /* ── molette horizontale (pavés tactiles) ── */
    let wheelTimer = null;
    stage.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      stopAuto();
      target -= e.deltaX;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => go(Math.round((base - target) / step)), 110);
    }, { passive: false });

    /* ── clavier ── */
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { stopAuto(); go(index + 1); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(index - 1); }
    });

    /* ── la boucle : position + profondeur ── */
    onFrame((dt) => {
      if (dragging) {
        x = lerp(x, target, clamp(0.5 * dt, 0, 1));
        spring = 0;
      } else {
        /* ressort légèrement sous-amorti : la carte tombe dans son cran
           avec un petit claquement, au lieu de flotter jusqu'à sa place */
        spring += (target - x) * 0.165 * dt;
        spring *= Math.pow(0.74, dt);
        x += spring * dt;
        if (Math.abs(target - x) < 0.35 && Math.abs(spring) < 0.35) { x = target; spring = 0; }
      }
      appliedX = x;
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;

      const half = stageW / 2;
      for (let i = 0; i < slides.length; i++) {
        const centre = i * step + x + (step / 2);
        const n = clamp((centre - half) / step, -2.2, 2.2);
        const a = Math.abs(n);
        slides[i].style.transform =
          `translate3d(0,0,${(-a * 110).toFixed(1)}px) rotateY(${(-n * 15).toFixed(2)}deg) scale(${(1 - a * 0.06).toFixed(3)})`;
        slides[i].style.opacity = (1 - Math.min(a, 2) * 0.34).toFixed(3);
      }

      const span = (slides.length - 1) * step || 1;
      bar.style.transform = `scaleX(${clamp((base - x) / span, 0, 1).toFixed(3)})`;
    });

    /* Sur mobile, faire apparaître ou disparaître la barre d'URL change la
       hauteur du viewport et déclenche un `resize` — plusieurs fois par
       défilement. Re-mesurer à chaque fois recalait le carrousel en plein
       geste. Seule une vraie variation de largeur justifie une mesure ; et
       jamais pendant un glissement, sinon la carte se bat contre le doigt. */
    let lastW = innerWidth;
    const remeasure = (force) => {
      if (dragging) return;
      if (!force && innerWidth === lastW) return;
      lastW = innerWidth;
      measureCarousel();
      go(index);
    };
    addEventListener("resize", () => remeasure(false), { passive: true });
    addEventListener("orientationchange", () => remeasure(true), { passive: true });
    if (window.ResizeObserver) {
      /* la scène, elle, ne bouge en largeur que sur un vrai changement de
         mise en page : on peut la suivre sans filtre. */
      new ResizeObserver(() => { if (!dragging) { measureCarousel(); go(index); } }).observe(stage);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { measureCarousel(); go(index); });
    }
    addEventListener("load", () => { measureCarousel(); go(index); }, { once: true });
    measureCarousel();
    go(0);
    startAuto();
  })();

  /* Le pointeur se déclare lui-même : ni media query, ni supposition.
     Une souris ou un stylet réveille le curseur maison ; un doigt, jamais.

     Le repli `mousemove` ne peut pas cohabiter avec `pointermove` : un appui
     tactile émet un `mousemove` de compatibilité, dépourvu de `pointerType`,
     que le filtre laissait passer — d'où le curseur qui apparaissait sur
     mobile. Il ne sert donc que si PointerEvent n'existe pas. */
  let pointerReady = false;
  const wakePointer = (e) => {
    if (pointerReady) return;
    if (e.pointerType === "touch") return;
    if (e.type === "pointermove" && e.movementX === 0 && e.movementY === 0) return;
    pointerReady = true;
    removeEventListener("pointermove", wakePointer);
    removeEventListener("mousemove", wakePointer);
    initPointer(e);
  };
  if (window.PointerEvent) {
    addEventListener("pointermove", wakePointer, { passive: true });
  } else {
    addEventListener("mousemove", wakePointer, { passive: true });
  }

  /* ─────── 11. DÉPART ─────── */
  registerParallax();
  watch();
  addEventListener("load", () => { measure(); registerParallax(); }, { once: true });
})();
