/* مذاقي توب — محمّل المحتوى من لوحة التحكم.
   ------------------------------------------------------------------
   الموقع يُرسم أولاً بمحتواه الثابت المدمج في الصفحة (ظهور فوري، ويعمل
   بلا إنترنت وبلا جافاسكربت). ثم يجلب هذا الملف آخر محتوى من قاعدة
   البيانات ويستبدل الأقسام فقط إذا اختلفت فعلاً — فلا وميض ولا قفزة.

   أي فشل هنا (لا إعدادات، لا شبكة، خطأ) يترك الموقع كما هو تماماً. */
(function () {
  "use strict";

  var cfg = window.MT_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  var API = cfg.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/";
  var HEADERS = { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY };

  /* ---------- helpers ---------- */

  function get(path) {
    return fetch(API + path, { headers: HEADERS }).then(function (r) {
      if (!r.ok) throw new Error(path + " → " + r.status);
      return r.json();
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 500.00 → "500"، 1500.50 → "1500.5" */
  function money(v) {
    if (v == null || v === "") return "";
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    return String(parseFloat(n.toFixed(2)));
  }

  var RIYAL = '<span class="cur riyal" aria-label="ريال">&#x20C1;</span>';

  /* الصور: رابط كامل يُستخدم كما هو، والمسار النسبي يُحلّ من جذر الموقع */
  var ROOT = (function () {
    if (location.hostname.indexOf("github.io") !== -1) {
      var seg = location.pathname.split("/").filter(Boolean)[0];
      if (seg) return "/" + seg + "/";
    }
    return "/";
  })();
  function img(url) {
    if (!url) return "";
    return /^https?:\/\//i.test(url) ? url : ROOT + String(url).replace(/^\/+/, "");
  }

  /* استبدل المحتوى فقط عند اختلافه فعلياً عن المرسوم حالياً */
  function setHTML(el, html) {
    if (!el) return false;
    var norm = function (s) { return s.replace(/\s+/g, " ").trim(); };
    if (norm(el.innerHTML) === norm(html)) return false;
    el.innerHTML = html;
    return true;
  }

  function setText(sel, text) {
    if (text == null || text === "") return;
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = text; });
  }

  /* ---------- renderers ---------- */

  function menuTabsHTML(cats) {
    return cats.map(function (c, i) {
      return '<button class="menu__tab' + (i === 0 ? " active" : "") + '" data-filter="' + esc(c.slug) + '">' +
        '<svg><use href="#' + esc(c.icon || "ic-utensils") + '"/></svg> ' + esc(c.name_ar) + "</button>";
    }).join("");
  }

  function itemHTML(it, cat) {
    var price;
    if (cat.two_prices) {
      price = '<span class="item__price two"><b>' + esc(money(it.price)) + "</b><b>" + esc(money(it.price2)) + "</b></span>";
    } else if (it.price_note) {
      price = '<span class="item__price">' + esc(it.price_note) + " " + RIYAL + "</span>";
    } else {
      price = '<span class="item__price">' + esc(money(it.price)) + " " + RIYAL + "</span>";
    }
    return '<div class="item"><span class="item__name">' + esc(it.name) + "</span>" +
      '<span class="item__dots"></span>' + price + "</div>";
  }

  function catHTML(cat, items) {
    var cols = cat.two_prices
      ? '<span class="cat__cols"><b>' + esc(cat.col1_label || "صغير") + "</b><b>" + esc(cat.col2_label || "كبير") + "</b></span>"
      : "";
    var note = cat.note
      ? '<p style="font-size:.78rem;color:var(--ink-faint);margin-top:.6rem">' + esc(cat.note) + " " + RIYAL + "</p>"
      : "";
    return '<article class="cat hslider__slide" data-cat="' + esc(cat.slug) + '">' +
      '<div class="cat__head">' +
        '<span class="cat__icon"><svg><use href="#' + esc(cat.icon || "ic-utensils") + '"/></svg></span>' +
        '<span class="cat__title"><h3>' + esc(cat.name_ar) + "</h3><span>" + esc(cat.name_en || "") + "</span></span>" +
        cols +
      "</div>" +
      items.map(function (it) { return itemHTML(it, cat); }).join("") +
      note +
      "</article>";
  }

  /* one offer, rendered as a rectangular banner ad */
  function adHTML(o) {
    var plain = o.image_fit === "none" || !o.image_url;
    var src = plain ? "" : img(o.image_url);

    var media = plain
      ? (o.big_text ? '<span class="ad__big">' + esc(o.big_text) + "</span>" : "")
      : '<img class="ad__bg" src="' + esc(src) + '" alt="" aria-hidden="true" loading="lazy" />' +
        '<img class="ad__img" src="' + esc(src) + '" alt="' + esc(o.title) + '" loading="lazy" />';

    var badge = "";
    if (o.badge) {
      var flame = o.featured ? '<svg class="ad__badge-ic"><use href="#ic-flame"/></svg> ' : "";
      badge = '<span class="ad__badge' + (o.badge_gold ? " gold" : "") + '">' + flame + esc(o.badge) + "</span>";
    }

    var price = "";
    if (o.price_text) {
      price = '<span class="ad__price"><b>' + esc(o.price_text) + " " + RIYAL + "</b></span>";
    } else if (o.new_price != null) {
      price = '<span class="ad__price">' +
        (o.old_price != null ? "<s>" + esc(money(o.old_price)) + "</s>" : "") +
        "<b>" + esc(money(o.new_price)) + " " + RIYAL + "</b></span>";
    }

    return '<a class="ad hslider__slide' + (plain ? " ad--plain" : "") + '" href="tel:+967' + esc(PHONE1) + '">' +
      media +
      '<span class="ad__scrim" aria-hidden="true"></span>' + badge +
      '<span class="ad__body">' +
        '<span class="ad__title">' + esc(o.title) + "</span>" +
        (o.subtitle ? '<span class="ad__sub">' + esc(o.subtitle) + "</span>" : "") +
        price +
        '<span class="ad__cta"><svg><use href="#ic-phone"/></svg> اطلب الآن</span>' +
      "</span></a>";
  }

  function dishHTML(d) {
    return '<figure class="dish reveal">' +
      '<div class="dish__disc' + (d.image_fit === "cover" ? " dish--cover" : "") + '">' +
        '<span class="dish__ring"></span>' +
        '<img src="' + esc(img(d.image_url)) + '" alt="' + esc(d.name_ar) + '" loading="lazy" />' +
      "</div>" +
      "<h3>" + esc(d.name_ar) + "</h3><span>" + esc(d.name_en || "") + "</span></figure>";
  }

  /* ---------- settings ---------- */

  var PHONE1 = "738696360";

  function applySettings(map) {
    var c = map.contact || {}, s = map.sections || {}, h = map.hero || {};

    if (c.phone1) {
      PHONE1 = String(c.phone1);
      document.querySelectorAll('[href^="tel:+967"]').forEach(function (a) {
        /* only swap the primary number; the secondary keeps its own value */
        if (a.getAttribute("href") === "tel:+967738696360") a.setAttribute("href", "tel:+967" + PHONE1);
      });
      document.querySelectorAll("[data-phone1]").forEach(function (el) { el.textContent = PHONE1; });
    }
    if (c.phone2) {
      document.querySelectorAll("[data-phone2]").forEach(function (el) { el.textContent = c.phone2; });
    }
    if (c.whatsapp) {
      document.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) {
        a.setAttribute("href", a.getAttribute("href").replace(/wa\.me\/\d+/, "wa.me/" + c.whatsapp));
      });
    }
    if (c.instagram) {
      document.querySelectorAll('a[href*="instagram.com"]').forEach(function (a) { a.setAttribute("href", c.instagram); });
    }
    if (c.maps) {
      document.querySelectorAll('a[href*="maps.app.goo.gl"]').forEach(function (a) { a.setAttribute("href", c.maps); });
    }
    setText("[data-address]", c.address);
    setText("[data-hours]", c.hours);

    setText("[data-s-menu-kicker]", s.menu_kicker);
    setText("[data-s-menu-title]", s.menu_title);
    setText("[data-s-menu-text]", s.menu_text);
    setText("[data-s-dishes-kicker]", s.dishes_kicker);
    setText("[data-s-dishes-title]", s.dishes_title);
    setText("[data-s-dishes-text]", s.dishes_text);
    setText("[data-s-offers-kicker]", s.offers_kicker);
    setText("[data-s-offers-title]", s.offers_title);
    setText("[data-hero-eyebrow]", h.eyebrow);
    setText("[data-hero-sub]", h.subtitle);

    if (c.open_from != null) document.documentElement.setAttribute("data-open-from", c.open_from);
    if (c.open_to != null) document.documentElement.setAttribute("data-open-to", c.open_to);
  }

  /* ---------- go ---------- */

  Promise.all([
    get("mathaqi_settings?select=key,value"),
    get("mathaqi_categories?select=*&visible=eq.true&order=sort.asc"),
    get("mathaqi_items?select=*&visible=eq.true&order=sort.asc"),
    get("mathaqi_offers?select=*&visible=eq.true&order=sort.asc"),
    get("mathaqi_dishes?select=*&visible=eq.true&order=sort.asc")
  ]).then(function (res) {
    var settings = {}, cats = res[1], items = res[2], offers = res[3], dishes = res[4];
    res[0].forEach(function (row) { settings[row.key] = row.value; });

    applySettings(settings);

    var changed = false;

    if (cats.length) {
      changed = setHTML(document.querySelector("[data-menu-tabs]"), menuTabsHTML(cats)) || changed;
      var byCat = {};
      items.forEach(function (it) { (byCat[it.category_id] = byCat[it.category_id] || []).push(it); });
      var menuHTML = cats.map(function (c) { return catHTML(c, byCat[c.id] || []); }).join("");
      changed = setHTML(document.querySelector("#menuSlider [data-hs-track]"), menuHTML) || changed;
    }

    if (offers.length) {
      changed = setHTML(document.querySelector("#heroSlider [data-hs-track]"), offers.map(adHTML).join("")) || changed;
    }

    if (dishes.length) {
      var d = setHTML(document.querySelector(".dishes"), dishes.map(dishHTML).join(""));
      if (d && window.MT && window.MT.observeReveals) window.MT.observeReveals(document.querySelector(".dishes"));
      changed = d || changed;
    }

    /* the sliders bound to the old nodes — rebuild them on the new DOM */
    if (changed && window.MT && window.MT.initSliders) window.MT.initSliders();
  }).catch(function (e) {
    /* content stays exactly as shipped */
    if (window.console && console.warn) console.warn("[mathaqi] المحتوى المباشر غير متاح، عُرض المحتوى الثابت.", e.message);
  });
})();
