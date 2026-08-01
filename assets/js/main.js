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

  /* ---------- Menu filter ---------- */
  var tabs = document.querySelectorAll(".menu__tab");
  var cats = document.querySelectorAll(".cat");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var f = tab.getAttribute("data-filter");
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      cats.forEach(function (c) {
        var show = f === "all" || c.getAttribute("data-cat") === f;
        c.style.display = show ? "" : "none";
      });
    });
  });

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

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
      var s = "";
      for (var i = 0; i < 5; i++) s += '<svg><use href="#ic-star"/></svg>';
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

  /* ---------- Year ---------- */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
