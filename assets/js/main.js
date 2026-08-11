/* مذاقي توب — interactions. Progressive enhancement only:
   every piece of content is present & visible without JS. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---------- Theme (light default, respects system + saved choice) ---------- */
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("mt-theme"); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = saved || (prefersDark ? "dark" : "light");
  root.setAttribute("data-theme", theme);

  function setTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("mt-theme", t); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#15110c" : "#faf5ea");
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-theme-toggle]");
    if (!t) return;
    setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  /* ---------- Mobile nav ---------- */
  var burger = document.querySelector(".nav__toggle");
  var links = document.querySelector(".nav__links");
  if (burger && links) {
    function setNav(open) {
      links.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("nav-open", open);
    }
    burger.addEventListener("click", function () { setNav(!links.classList.contains("open")); });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("open")) setNav(false);
    });
  }

  /* ---------- Header shadow on scroll + back-to-top ---------- */
  var header = document.querySelector(".site-header");
  var toTop = document.querySelector(".to-top");
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 20);
    if (toTop) toTop.classList.toggle("show", y > 640);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ---------- Horizontal sliders (menu categories + offers) ----------
     The tracks are native scroll-snap containers, so swiping already works
     with JS off. Here we add arrows, dots and the active-state syncing. */
  var RTL = document.documentElement.getAttribute("dir") === "rtl";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* how far (in px, physical) the track must scroll to bring `el` to its start edge */
  function startDelta(track, el) {
    var t = track.getBoundingClientRect();
    var s = el.getBoundingClientRect();
    var cs = getComputedStyle(track);
    return RTL
      ? s.right - (t.right - parseFloat(cs.paddingRight || 0))
      : s.left - (t.left + parseFloat(cs.paddingLeft || 0));
  }
  function nudge(el, dx) {
    if (Math.abs(dx) < 1) return;
    if (REDUCED || !("scrollBehavior" in document.documentElement.style)) el.scrollLeft += dx;
    else el.scrollBy({ left: dx, behavior: "smooth" });
  }

  function initSlider(root, onChange) {
    var track = root.querySelector("[data-hs-track]");
    if (!track) return null;
    var slides = Array.prototype.slice.call(track.children);
    if (!slides.length) return null;

    var dotsWrap = root.querySelector("[data-hs-dots]");
    var prevBtn = root.querySelector('[data-hs="prev"]');
    var nextBtn = root.querySelector('[data-hs="next"]');
    var dots = [];
    var index = 0;

    function goTo(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      nudge(track, startDelta(track, slides[i]));
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      slides.forEach(function (s, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "hslider__dot" + (i === 0 ? " active" : "");
        b.setAttribute("aria-label", "الشريحة " + (i + 1));
        b.addEventListener("click", function () { goTo(i); });
        dotsWrap.appendChild(b);
        dots.push(b);
      });
    }

    [prevBtn, nextBtn].forEach(function (btn) {
      if (!btn) return;
      btn.removeAttribute("hidden");
      btn.addEventListener("click", function () {
        goTo(index + (btn.getAttribute("data-hs") === "next" ? 1 : -1));
      });
    });

    /* leading visible slide = the one whose start edge sits closest to the track's start */
    function current() {
      var best = 0, bestD = Infinity;
      for (var i = 0; i < slides.length; i++) {
        var d = Math.abs(startDelta(track, slides[i]));
        if (d < bestD - 1) { bestD = d; best = i; }
      }
      return best;
    }

    function sync() {
      index = current();
      dots.forEach(function (d, i) { d.classList.toggle("active", i === index); });
      var max = track.scrollWidth - track.clientWidth;
      var pos = Math.abs(track.scrollLeft);
      if (prevBtn) prevBtn.disabled = pos <= 2;
      if (nextBtn) nextBtn.disabled = pos >= max - 2;
      if (onChange) onChange(index, slides);
    }

    var ticking = false;
    track.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; sync(); });
    }, { passive: true });
    window.addEventListener("resize", sync);

    sync();
    return { goTo: goTo, sync: sync, slides: slides };
  }

  /* menu: chips drive the slides, and the slides drive the chips back */
  function initMenuSlider() {
    var strip = document.querySelector("[data-menu-tabs]");
    var menu = initSlider(document.getElementById("menuSlider"), function (i, slides) {
      if (!strip) return;
      var cat = slides[i].getAttribute("data-cat");
      strip.querySelectorAll(".menu__tab").forEach(function (t) {
        var on = t.getAttribute("data-filter") === cat;
        t.classList.toggle("active", on);
        t.setAttribute("aria-current", on ? "true" : "false");
        if (on) centerChip(t);
      });
      slides.forEach(function (s, si) { s.classList.toggle("is-current", si === i); });
    });
    if (!menu || !strip) return;

    function centerChip(chip) {
      if (strip.scrollWidth <= strip.clientWidth + 4) return;
      var t = strip.getBoundingClientRect();
      var c = chip.getBoundingClientRect();
      nudge(strip, (c.left + c.width / 2) - (t.left + t.width / 2));
    }

    strip.querySelectorAll(".menu__tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var f = tab.getAttribute("data-filter");
        for (var i = 0; i < menu.slides.length; i++) {
          if (menu.slides[i].getAttribute("data-cat") === f) { menu.goTo(i); break; }
        }
        centerChip(tab);
      });
    });
  }

  /* Both sliders. Re-callable: the CMS loader re-renders the tracks from the
     database and then asks for a fresh init on the new DOM. */
  function initSliders() {
    initMenuSlider();
    initSlider(document.getElementById("offersSlider"));
  }
  initSliders();

  /* ---------- Scroll reveal ---------- */
  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  }
  function observeReveals(root) {
    var els = (root || document).querySelectorAll(".reveal:not(.in)");
    if (!io) { els.forEach(function (el) { el.classList.add("in"); }); return; }
    els.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
  }
  observeReveals(document);

  /* ---------- Active nav link (scroll spy) ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); }).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var id = "#" + en.target.id;
          navLinks.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === id); });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Gallery: mark slots that actually have a loaded image ---------- */
  document.querySelectorAll(".shot img").forEach(function (img) {
    function ok() { img.closest(".shot").classList.add("has-img"); }
    if (img.complete && img.naturalWidth > 0) ok();
    else { img.addEventListener("load", ok); img.addEventListener("error", function () {}); }
  });

  /* ---------- Reviews carousel (dynamic) ---------- */
  (function () {
    var carousel = document.getElementById("revCarousel");
    var track = document.getElementById("revTrack");
    var dotsWrap = document.getElementById("revDots");
    if (!carousel || !track) return;

    function stars(n) {
      n = Math.max(0, Math.min(5, n || 5));
      var s = "";
      for (var i = 0; i < 5; i++) s += "<svg" + (i < n ? "" : ' class="dim"') + '><use href="#ic-star"/></svg>';
      return '<div class="rev-card__stars">' + s + "</div>";
    }
    function esc(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
    function cardHTML(r) {
      var initial = (r.name || "؟").trim().charAt(0);
      return '<article class="rev-card">' +
        '<span class="rev-card__quote"><svg><use href="#ic-quote"/></svg></span>' +
        stars(r.stars || 5) +
        "<p>" + esc(r.text || "") + "</p>" +
        '<div class="rev-card__author"><span class="rev-card__avatar">' + esc(initial) + "</span>" +
        '<div class="rev-card__who"><b>' + esc(r.name || "") + "</b><span>" + esc(r.source || "تقييم على جوجل") + "</span></div></div>" +
        "</article>";
    }

    // render from data if available (overrides static fallback cards)
    var data = window.MT_REVIEWS;
    if (data && data.length) {
      track.innerHTML = data.map(cardHTML).join("");
    }
    var cards = track.querySelectorAll(".rev-card");
    if (cards.length <= 1) return; // nothing to rotate

    carousel.classList.add("ready");
    var index = 0, count = cards.length;

    // dots
    dotsWrap.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var d = document.createElement("button");
      d.className = "rev-dot" + (i === 0 ? " active" : "");
      d.setAttribute("aria-label", "التقييم " + (i + 1));
      (function (idx) { d.addEventListener("click", function () { go(idx); reset(); }); })(i);
      dotsWrap.appendChild(d);
    }
    var dots = dotsWrap.querySelectorAll(".rev-dot");

    function render() {
      // RTL: first card should be flush; translate by +index in logical direction
      var dir = document.documentElement.getAttribute("dir") === "rtl" ? 1 : -1;
      track.style.transform = "translateX(" + (dir * index * 100) + "%)";
      dots.forEach(function (dt, i) { dt.classList.toggle("active", i === index); });
    }
    function go(i) { index = (i + count) % count; render(); }
    function next() { go(index + 1); }
    function prev() { go(index - 1); }

    var timer = null;
    function start() { stop(); timer = setInterval(next, 5500); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function reset() { start(); }

    carousel.querySelectorAll("[data-rev]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        (btn.getAttribute("data-rev") === "next" ? next : prev)(); reset();
      });
    });

    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", start);

    // touch swipe
    var x0 = null;
    track.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    track.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      var rtl = document.documentElement.getAttribute("dir") === "rtl";
      if (Math.abs(dx) > 40) { (rtl ? (dx < 0) : (dx > 0)) ? prev() : next(); }
      x0 = null; start();
    }, { passive: true });

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      render();
    } else { render(); start(); }
  })();

  /* ---------- Open-now badge (Yemen time, UTC+3, 16:00–00:00 daily) ---------- */
  (function () {
    var el = document.querySelector("[data-open-badge]");
    if (!el) return;

    /* "16" → "٤ عصراً" */
    function hourLabel(h) {
      if (h === 0) return "منتصف الليل";
      var t = h > 12 ? h - 12 : h;
      var period = h < 12 ? "صباحاً" : (h === 12 ? "ظهراً" : (h < 17 ? "عصراً" : "مساءً"));
      var ar = String(t).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[+d]; });
      return ar + " " + period;
    }

    function render() {
      var root = document.documentElement;
      var from = parseInt(root.getAttribute("data-open-from"), 10);
      if (isNaN(from)) from = 16;                  // opening hour, overridable from the panel
      var now = new Date();
      var h = (now.getUTCHours() + 3) % 24;        // Yemen has no DST
      var open = h >= from;                        // open until midnight
      el.className = "open-badge " + (open ? "is-open" : "is-closed");
      el.innerHTML = '<span class="dot"></span>' + (open ? "مفتوح الآن" : "مغلق — نفتح " + hourLabel(from));
      el.removeAttribute("hidden");
    }
    render();
    setInterval(render, 60000);
  })();

  /* ---------- Year ---------- */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  /* hooks for the CMS loader (assets/js/content.js) */
  window.MT = window.MT || {};
  window.MT.initSliders = initSliders;
  window.MT.observeReveals = observeReveals;
})();
