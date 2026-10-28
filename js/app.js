(function () {
  "use strict";

  var PRODUCTS = window.PRODUCTS || [];
  var SHOP = window.SHOP;
  var CART_KEY = "liag-cart-v2";
  var SECTIONS = { about: "about", caps: "caps", story: "story", contact: "contact" };

  var I18N = window.I18N;
  var LANG_KEY = "liag-lang";
  var LANG = (function () {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved && I18N[saved]) return saved;
    } catch (e) { /* private mode */ }
    return /^lt\b/i.test(navigator.language || "") ? "lt" : "en";
  })();

  // Translated string, with {placeholders} filled from vars.
  function t(key, vars) {
    var s = I18N[LANG][key];
    if (s === undefined) s = I18N.en[key];
    if (typeof s !== "string") return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; });
  }
  function tr(p) { return (I18N[LANG].products || {})[p.id] || {}; }
  function pName(p) { return tr(p).name || p.name; }
  function pAcc(p) { return tr(p).acc || pName(p); }
  function pColor(p) { return tr(p).color || p.color; }
  function pDesc(p) { return tr(p).description || p.description; }

  var app = document.getElementById("app");
  var countEl = document.getElementById("cart-count");
  var toastEl = document.getElementById("toast");
  document.getElementById("year").textContent = new Date().getFullYear();

  // ---------- helpers ----------
  function eur(n) {
    var whole = Math.round(n * 100) % 100 === 0;
    return new Intl.NumberFormat(t("locale"), {
      style: "currency", currency: SHOP.currency,
      minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2
    }).format(n);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function findProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }
  var toastTimer;
  function toast(msg, undo) {
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button type="button" class="toast-undo">' + esc(t("undo")) + "</button>" : "");
    if (undo) toastEl.querySelector("button").onclick = function () { undo(); toastEl.classList.remove("show"); };
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, undo ? 5000 : 2400);
  }
  function capImg(p, cls, small) {
    return '<img class="' + (cls || "") + '" src="' + (small ? p.thumb : p.image) + '" alt="' +
      esc(t("capAlt", { color: pColor(p) })) + '" loading="lazy" width="756" height="502">';
  }

  // ---------- cart ----------
  function loadCart() {
    try {
      var parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(function (l) { return findProduct(l.id) && l.qty > 0; })
        : [];
    } catch (e) {
      return [];
    }
  }
  var cart = loadCart();
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* private mode */ }
    refresh();
  }
  function cartCount() {
    return cart.reduce(function (s, l) { return s + l.qty; }, 0);
  }
  function lineFor(id) {
    return cart.filter(function (l) { return l.id === id; })[0];
  }
  function inCart(id) {
    var l = lineFor(id);
    return l ? l.qty : 0;
  }
  // Most a visitor can hold of one cap: what's left in the drop, capped per order.
  function maxQty(p) {
    return Math.max(0, Math.min(p.stock, SHOP.maxPerOrder));
  }
  function left(p) {
    return Math.max(0, p.stock - inCart(p.id));
  }
  // Returns how many were actually added.
  function addToCart(id, qty) {
    var p = findProduct(id);
    var room = maxQty(p) - inCart(id);
    var n = Math.max(0, Math.min(qty, room));
    if (!n) return 0;
    var line = lineFor(id);
    if (line) line.qty += n;
    else cart.push({ id: id, qty: n });
    saveCart();
    return n;
  }
  function setQty(id, qty) {
    var line = lineFor(id);
    if (!line) return;
    line.qty = Math.min(qty, maxQty(findProduct(id)));
    if (line.qty < 1) cart.splice(cart.indexOf(line), 1);
    saveCart();
  }
  function removeLine(id) {
    var idx = cart.indexOf(lineFor(id));
    if (idx < 0) return;
    var removed = cart.splice(idx, 1)[0];
    saveCart();
    toast(t("removed", { name: pName(findProduct(id)) }), function () {
      cart.splice(Math.min(idx, cart.length), 0, removed);
      saveCart();
    });
  }

  // ---------- live drop ----------
  var dropEnds = new Date(SHOP.drop.endsAt).getTime();
  function dropOpen() { return Date.now() < dropEnds; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function countdownParts() {
    var ms = Math.max(0, dropEnds - Date.now());
    var sec = Math.floor(ms / 1000);
    return { d: Math.floor(sec / 86400), h: Math.floor(sec % 86400 / 3600), m: Math.floor(sec % 3600 / 60), s: sec % 60 };
  }
  function countdownBoxes() {
    return '<div class="countdown" data-countdown aria-label="' + esc(t("cdLabel")) + '">' +
      ["d", "h", "m", "s"].map(function (k) {
        return '<div><span data-cd="' + k + '">00</span><small>' + esc(t({ d: "cdDays", h: "cdHours", m: "cdMin", s: "cdSec" }[k])) + "</small></div>";
      }).join("") + "</div>";
  }
  function tick() {
    var c = countdownParts();
    document.querySelectorAll("[data-cd]").forEach(function (el) {
      el.textContent = pad(c[el.getAttribute("data-cd")]);
    });
    document.querySelectorAll("[data-cd-inline]").forEach(function (el) {
      el.textContent = t("cdInline", { d: c.d, hms: pad(c.h) + ":" + pad(c.m) + ":" + pad(c.s) });
    });
    if (!dropOpen() && !document.body.classList.contains("drop-closed")) {
      document.body.classList.add("drop-closed");
      refresh();
    }
  }
  function stockLine(p) {
    var l = left(p);
    var pct = Math.round(100 * p.stock / p.stockTotal);
    var label = !dropOpen() ? t("dropClosed") : p.stock === 0 ? t("soldOut") : p.stock <= 10 ? t("almostGone", { n: p.stock }) : t("onlyLeft", { n: p.stock, total: p.stockTotal });
    return '<div class="stockbar' + (p.stock <= 10 ? " low" : "") + '" data-stock="' + p.id + '">' +
      '<p class="stock"><span class="dot live"></span>' + esc(label) + "</p>" +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      (inCart(p.id) && dropOpen() ? '<p class="held">' + esc(t("inYourCart", { n: inCart(p.id) }) + (l === 0 ? t("allOfThem") : "")) + "</p>" : "") +
      "</div>";
  }
  // Whether a cap can be bought right now, and the button text if not.
  function buyBlock(p) {
    if (!dropOpen()) return t("dropClosed");
    if (p.stock === 0) return t("soldOut");
    if (inCart(p.id) >= maxQty(p)) return t("maxInCart");
    return "";
  }
  function buyLabel(p) {
    return buyBlock(p) || t("buy", { name: pName(p), nameAcc: pAcc(p), price: eur(p.price) });
  }
  function totals() {
    var subtotal = cart.reduce(function (s, l) { return s + findProduct(l.id).price * l.qty; }, 0);
    // Bundle: every full set of all three colours costs SHOP.bundle.price.
    var sets = PRODUCTS.reduce(function (m, p) {
      var line = cart.filter(function (l) { return l.id === p.id; })[0];
      return Math.min(m, line ? line.qty : 0);
    }, Infinity);
    if (!isFinite(sets)) sets = 0;
    var fullPrice = PRODUCTS.reduce(function (s, p) { return s + p.price; }, 0);
    var discount = sets * (fullPrice - SHOP.bundle.price);
    var afterDiscount = subtotal - discount;
    var shipping = afterDiscount === 0 || afterDiscount >= SHOP.shipping.freeFrom ? 0 : SHOP.shipping.flat;
    return { subtotal: subtotal, discount: discount, sets: sets, shipping: shipping, total: afterDiscount + shipping };
  }

  // ---------- views ----------
  function swatches(activeId, asLinks) {
    return '<div class="swatches" role="group" aria-label="' + esc(t("colourGroup")) + '">' + PRODUCTS.map(function (p) {
      var attrs = ' class="swatch' + (p.id === activeId ? " active" : "") + '" style="--c:' + p.swatch + '" aria-label="' + esc(pName(p) + " · " + pColor(p)) + '"';
      return asLinks
        ? "<a" + attrs + ' href="#/product/' + p.id + '"' + (p.id === activeId ? ' aria-current="true"' : "") + "></a>"
        : '<button type="button"' + attrs + ' data-swatch="' + p.id + '" aria-pressed="' + (p.id === activeId) + '"></button>';
    }).join("") + "</div>";
  }

  function productCard(p) {
    return (
      '<article class="card" style="--c:' + p.swatch + '">' +
      '<a class="card-img" href="#/product/' + p.id + '">' + capImg(p, "", true) + "</a>" +
      stockLine(p) +
      '<div class="card-head"><h3><a href="#/product/' + p.id + '">' + esc(pName(p)) + '</a></h3><span class="price">' + eur(p.price) + "</span></div>" +
      '<p class="card-desc">' + esc(pDesc(p)) + "</p>" +
      '<button type="button" class="btn block" data-buy="' + p.id + '"' + (buyBlock(p) ? " disabled" : "") + ">" + esc(buyLabel(p)) + "</button>" +
      "</article>"
    );
  }

  function viewHome() {
    var first = PRODUCTS[0];
    var drop = esc(SHOP.drop.name);
    return (
      '<section class="hero">' +
      '<div class="hero-bg" aria-hidden="true"></div>' +
      '<div class="wrap hero-inner">' +
      '<div class="hero-text">' +
      '<p class="eyebrow">' + esc(t("heroEyebrow")) + "</p>" +
      "<h1>" + esc(t("heroTitle")) + "</h1>" +
      '<p class="lead">' + esc(t("heroLead")) + "</p>" +
      '<div class="hero-actions"><a class="btn" href="#/caps"><span class="dot live"></span>' + esc(t("shopDrop", { drop: SHOP.drop.name })) + "</a>" +
      '<a class="btn btn-outline" href="#/about">' + esc(t("ourStory")) + "</a></div>" +
      '<p class="live-line"><span class="dot live"></span><strong>' + esc(t("isLive", { drop: SHOP.drop.name })) + "</strong> · " + esc(t("closesIn")) + " <span data-cd-inline></span></p>" +
      "</div>" +
      '<div class="hero-card"><span class="pill pill-live"><span class="dot live"></span>' + esc(t("liveNow")) + "</span>" +
      '<a class="hero-img" id="hero-link" href="#/product/' + first.id + '">' + capImg(first, "", false).replace('loading="lazy"', 'loading="eager" id="hero-img"') + "</a>" +
      '<p class="hero-name" id="hero-name">' + esc(pName(first) + " · " + pColor(first)) + "</p>" +
      swatches(first.id, false) +
      "</div></div></section>" +
      '<div class="stripe" aria-hidden="true"><i></i><i></i><i></i></div>' +

      '<section class="manifesto" id="about"><div class="wrap manifesto-inner">' +
      "<h2>" + esc(t("notAgain")) + "<br><span>" + esc(t("already")) + "</span></h2>" +
      "<div><p>" + esc(t("manifesto1")) + "</p>" +
      "<p>" + esc(t("manifesto2")) + "</p>" +
      '<dl class="stats"><div style="--c:var(--yellow)"><dt>3</dt><dd>' + esc(t("statColors")) + '</dd></div><div style="--c:var(--green)"><dt>1</dt><dd>' + esc(t("statMessage")) + '</dd></div><div style="--c:var(--red)"><dt>' + PRODUCTS.length + "</dt><dd>" + esc(t("statCaps")) + "</dd></div></dl>" +
      "</div></div></section>" +

      '<section class="drop" id="caps"><div class="wrap">' +
      '<div class="drop-head"><div><span class="pill pill-live"><span class="dot live"></span>' + esc(t("liveNow")) + "</span>" +
      "<h2>" + esc(t("dropIs", { drop: SHOP.drop.name })) + ' <span class="green">' + esc(t("live")) + "</span></h2>" +
      '<p class="scarcity">' + esc(t("scarcity", { n: PRODUCTS[0].stockTotal })) + "</p>" +
      '<p class="closes">' + esc(t("dropClosesIn", { drop: SHOP.drop.name })) + "</p>" + countdownBoxes() + "</div>" +
      '<div class="drop-meta"><p>' + esc(t("dropMeta")) + "</p>" +
      "<p><strong>" + esc(t("eachBundle", { price: eur(PRODUCTS[0].price), bundle: eur(SHOP.bundle.price) })) + '</strong></p><button type="button" class="btn btn-outline btn-sm" data-bundle>' + esc(t("buyAllThree", { price: eur(SHOP.bundle.price) })) + "</button></div></div>" +
      '<div class="grid">' + PRODUCTS.map(productCard).join("") + "</div>" +
      "</div></section>" +

      '<section class="banner" id="story"><div class="banner-img" role="img" aria-label="' + esc(t("bannerAlt")) + '"></div>' +
      '<div class="banner-text"><div class="wrap"><p class="eyebrow yellow">' + esc(t("bannerEyebrow")) + "</p><h2>" + esc(t("bannerTitle")) + "</h2></div></div></section>" +

      '<section class="how"><div class="wrap"><div class="how-box"><h2>' + esc(t("howTitle")) + '</h2><ol class="steps">' +
      '<li style="--c:#B8860B"><span>01</span><h3>' + esc(t("how1t")) + "</h3><p>" + esc(t("how1")) + "</p></li>" +
      '<li style="--c:var(--green)"><span>02</span><h3>' + esc(t("how2t")) + "</h3><p>" + esc(t("how2")) + "</p></li>" +
      '<li style="--c:var(--red)"><span>03</span><h3>' + esc(t("how3t")) + "</h3><p>" + esc(t("how3", { flat: eur(SHOP.shipping.flat), free: eur(SHOP.shipping.freeFrom) })) + "</p></li>" +
      "</ol></div></div></section>" +

      '<section class="contact" id="contact"><div class="wrap contact-inner">' +
      "<div><h2>" + esc(t("contactTitle")) + "</h2><p>" + esc(t("contactLead")) + "</p></div>" +
      '<form class="panel form" id="contact-form" novalidate>' +
      "<label>" + esc(t("fName")) + '<input name="name" required autocomplete="name"></label>' +
      "<label>" + esc(t("fEmail")) + '<input name="email" type="email" required autocomplete="email"></label>' +
      '<label class="check"><input type="checkbox" name="notify"> ' + esc(t("fNotify")) + "</label>" +
      "<label>" + esc(t("fMessage")) + '<textarea name="message" rows="3"></textarea></label>' +
      '<p class="error" id="contact-error" role="alert"></p>' +
      '<button class="btn block" type="submit">' + esc(t("fSend")) + "</button></form>" +
      "</div></section>"
    );
  }

  function viewProduct(id) {
    var p = findProduct(id);
    if (!p) return viewNotFound();
    return (
      '<div class="wrap page"><nav class="crumbs"><a href="#/caps">' + esc(t("allCaps")) + "</a></nav>" +
      '<section class="product" style="--c:' + p.swatch + '">' +
      '<div class="product-img">' + capImg(p, "", false).replace('loading="lazy"', 'loading="eager"') + "</div>" +
      '<div class="product-info">' +
      stockLine(p) +
      "<h1>" + esc(pName(p)) + ' <span class="muted-h">· ' + esc(pColor(p)) + "</span></h1>" +
      '<p class="price big">' + eur(p.price) + "</p>" +
      "<p>" + esc(pDesc(p)) + "</p>" +
      swatches(p.id, true) +
      '<form id="add-form" class="add-form">' +
      stepper("qty", 1, 1, Math.max(1, maxQty(p) - inCart(p.id))) +
      '<button class="btn" type="submit" data-add="' + p.id + '"' + (buyBlock(p) ? " disabled" : "") + ">" + esc(buyBlock(p) || t("addToCart", { price: eur(p.price) })) + "</button></form>" +
      '<p class="live-line small"><span class="dot live"></span>' + esc(t("dropClosesIn", { drop: SHOP.drop.name })) + " <span data-cd-inline></span></p>" +
      '<p class="bundle-note">' + esc(t("bundleNote", { bundle: eur(SHOP.bundle.price) })) + "</p>" +
      '<ul class="details">' + t("details").map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" +
      "</div></section></div>"
    );
  }

  function viewCart() {
    if (!cart.length) {
      return '<div class="wrap page"><section class="empty"><h1>' + esc(t("cartEmptyTitle")) + "</h1><p>" + esc(t("cartEmptyLead")) + '</p><a class="btn" href="#/caps">' + esc(t("shopDrop", { drop: SHOP.drop.name })) + "</a></section></div>";
    }
    var rows = cart.map(cartLine).join("");
    var sum = totals();
    var nudge = bundleNudge();
    return (
      '<div class="wrap page"><h1>' + esc(t("cartTitle")) + ' <span class="muted-h">(' + cartCount() + ")</span></h1>" +
      '<div class="cart-layout"><ul class="lines">' + rows + "</ul>" +
      '<aside class="panel summary"><h2>' + esc(t("summary")) + "</h2>" + summaryRows(sum) + nudge +
      '<a class="btn block" href="#/checkout">' + esc(t("checkoutBtn", { price: eur(sum.total) })) + "</a>" +
      '<a class="btn btn-outline block" href="#/caps">' + esc(t("continueShopping")) + "</a>" +
      '<button type="button" class="link" data-clear>' + esc(t("emptyCart")) + "</button></aside></div></div>"
    );
  }

  function stepper(name, value, min, max, id) {
    var attr = id ? ' data-line="' + id + '"' : "";
    return '<div class="stepper"' + attr + '>' +
      '<button type="button" data-step="-1" aria-label="' + esc(t("decQty")) + '"' + (value <= min ? " disabled" : "") + ">−</button>" +
      '<input type="number" name="' + name + '" value="' + value + '" min="' + min + '" max="' + max + '" inputmode="numeric" aria-label="' + esc(t("qty")) + '">' +
      '<button type="button" data-step="1" aria-label="' + esc(t("incQty")) + '"' + (value >= max ? " disabled" : "") + ">+</button></div>";
  }

  function cartLine(l) {
    var p = findProduct(l.id);
    var max = maxQty(p);
    return (
      '<li class="line" data-id="' + p.id + '">' +
      '<a class="line-img" href="#/product/' + p.id + '">' + capImg(p, "", true) + "</a>" +
      '<div class="line-info"><a href="#/product/' + p.id + '"><strong>' + esc(pName(p)) + "</strong></a>" +
      '<span class="muted">' + esc(pColor(p) + " · " + t("each", { price: eur(p.price) })) + "</span>" +
      (l.qty >= max ? '<span class="small warn">' + esc(t("maxPerOrder", { n: max })) + "</span>" : "") + "</div>" +
      stepper("line-" + p.id, l.qty, 0, max, p.id) +
      '<div class="line-total">' + eur(p.price * l.qty) + "</div>" +
      '<button type="button" class="icon-btn" data-remove="' + p.id + '" aria-label="' + esc(t("remove", { name: pName(p), nameAcc: pAcc(p) })) + '">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z"/></svg></button></li>'
    );
  }

  function bundleNudge() {
    var sum = totals();
    var missing = PRODUCTS.filter(function (p) { return !inCart(p.id) && p.stock > 0; });
    if (sum.sets || !missing.length || missing.length === PRODUCTS.length || !dropOpen()) return "";
    return '<div class="nudge"><p>' + esc(t("nudge", {
        names: missing.map(pName).join(t("and")),
        namesAcc: missing.map(pAcc).join(t("and")),
        price: eur(SHOP.bundle.price)
      })) + "</p>" +
      missing.map(function (p) { return '<button type="button" class="btn btn-outline btn-sm" data-buy="' + p.id + '">+ ' + esc(pName(p)) + "</button>"; }).join("") + "</div>";
  }

  function shippingProgress() {
    var sum = totals();
    var after = sum.subtotal - sum.discount;
    if (!after) return "";
    var pct = Math.min(100, Math.round(100 * after / SHOP.shipping.freeFrom));
    return '<div class="ship"><p>' + esc(sum.shipping ? t("shipAway", { price: eur(SHOP.shipping.freeFrom - after) }) : t("shipFree")) + '</p><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }

  // ---------- cart drawer ----------
  var drawer = document.getElementById("drawer");
  var drawerBody = document.getElementById("drawer-body");
  var lastFocus = null;
  function renderDrawer() {
    document.getElementById("drawer-count").textContent = cartCount();
    if (!cart.length) {
      drawerBody.innerHTML = '<div class="drawer-empty"><p><strong>' + esc(t("cartEmptyShort")) + '</strong></p><p class="muted">' + esc(t("cartEmptyDrawer")) + "</p>" +
        '<div class="mini-picks">' + PRODUCTS.map(function (p) {
          return '<a href="#/product/' + p.id + '" data-close>' + capImg(p, "", true) + "<span>" + esc(pName(p)) + "</span></a>";
        }).join("") + "</div>" +
        '<a class="btn block" href="#/caps" data-close>' + esc(t("shopDrop", { drop: SHOP.drop.name })) + "</a></div>";
      return;
    }
    var sum = totals();
    drawerBody.innerHTML = shippingProgress() + '<ul class="lines">' + cart.map(cartLine).join("") + "</ul>" + bundleNudge() +
      '<div class="drawer-foot">' + summaryRows(sum) +
      '<a class="btn block" href="#/checkout" data-close>' + esc(t("checkoutBtn", { price: eur(sum.total) })) + "</a>" +
      '<div class="drawer-links"><a href="#/cart" data-close>' + esc(t("viewCart")) + '</a><button type="button" class="link" data-close>' + esc(t("continueShopping")) + "</button></div></div>";
  }
  function openDrawer() {
    lastFocus = document.activeElement;
    renderDrawer();
    drawer.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add("open"); });
    document.body.classList.add("no-scroll");
    document.getElementById("drawer-close").focus();
  }
  function closeDrawer() {
    if (drawer.hidden) return;
    drawer.classList.remove("open");
    document.body.classList.remove("no-scroll");
    setTimeout(function () { drawer.hidden = true; }, 250);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // Everything that shows cart or stock state is redrawn from here.
  function refresh() {
    var n = cartCount();
    countEl.textContent = n;
    countEl.classList.toggle("has-items", n > 0);
    if (!drawer.hidden) renderDrawer();
    var page = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "home";
    if (page === "cart") app.innerHTML = viewCart();
    if (page === "checkout" && !cart.length) app.innerHTML = viewCart();
    document.querySelectorAll("[data-stock]").forEach(function (el) {
      el.outerHTML = stockLine(findProduct(el.getAttribute("data-stock")));
    });
    document.querySelectorAll("[data-buy]").forEach(function (b) {
      if (b.closest(".nudge")) return;
      var p = findProduct(b.getAttribute("data-buy"));
      b.textContent = buyLabel(p);
      b.disabled = !!buyBlock(p);
    });
    var add = document.querySelector("[data-add]");
    if (add) {
      var ap = findProduct(add.getAttribute("data-add"));
      add.disabled = !!buyBlock(ap);
      add.textContent = buyBlock(ap) || t("addToCart", { price: eur(ap.price) });
      var qi = document.querySelector('#add-form input[name="qty"]');
      var room = Math.max(1, maxQty(ap) - inCart(ap.id));
      qi.max = room;
      if (+qi.value > room) qi.value = room;
      syncStepper(qi.closest(".stepper"));
    }
    var bundle = document.querySelector("[data-bundle]");
    if (bundle) bundle.disabled = !dropOpen() || PRODUCTS.some(function (p) { return inCart(p.id) >= maxQty(p); });
  }
  function syncStepper(st) {
    var i = st.querySelector("input");
    st.querySelector('[data-step="-1"]').disabled = +i.value <= +i.min;
    st.querySelector('[data-step="1"]').disabled = +i.value >= +i.max;
  }

  function summaryRows(sum) {
    return "<dl><dt>" + esc(t("subtotal")) + "</dt><dd>" + eur(sum.subtotal) + "</dd>" +
      (sum.discount ? "<dt>" + esc(t("bundleDiscount")) + (sum.sets > 1 ? " ×" + sum.sets : "") + '</dt><dd class="green">−' + eur(sum.discount) + "</dd>" : "") +
      "<dt>" + esc(t("shipping")) + "</dt><dd>" + (sum.shipping ? eur(sum.shipping) : esc(t("free"))) + "</dd>" +
      '<dt class="total">' + esc(t("total")) + '</dt><dd class="total">' + eur(sum.total) + "</dd></dl>";
  }

  function viewCheckout() {
    if (!cart.length) return viewCart();
    var sum = totals();
    return (
      '<div class="wrap page"><h1>' + esc(t("checkoutTitle")) + "</h1>" +
      '<p class="notice">' + esc(t("checkoutNotice")) + "</p>" +
      '<div class="cart-layout"><form id="checkout-form" class="panel form" novalidate>' +
      "<label>" + esc(t("fFullName")) + '<input name="name" required autocomplete="name"></label>' +
      "<label>" + esc(t("fEmail")) + '<input name="email" type="email" required autocomplete="email"></label>' +
      "<label>" + esc(t("fAddress")) + '<input name="address" required autocomplete="street-address"></label>' +
      '<div class="row"><label>' + esc(t("fCity")) + '<input name="city" required autocomplete="address-level2"></label>' +
      "<label>" + esc(t("fZip")) + '<input name="zip" required autocomplete="postal-code"></label></div>' +
      "<label>" + esc(t("fCountry")) + '<select name="country">' + t("countries").map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select></label>" +
      '<p class="error" id="form-error" role="alert"></p>' +
      '<button class="btn block" type="submit">' + esc(t("placeOrder", { price: eur(sum.total) })) + "</button>" +
      '<a class="link back" href="#/cart">' + esc(t("backToCart")) + "</a></form>" +
      '<aside class="panel summary"><h2>' + esc(t("order")) + '</h2><ul class="mini">' +
      cart.map(function (l) {
        var p = findProduct(l.id);
        return "<li><span>" + l.qty + "× " + esc(pName(p)) + " (" + esc(pColor(p)) + ")</span><span>" + eur(p.price * l.qty) + "</span></li>";
      }).join("") +
      "</ul>" + summaryRows(sum) + "</aside></div></div>"
    );
  }

  function viewThanks(ref) {
    return (
      '<div class="wrap page"><section class="empty"><h1>' + esc(t("thanksTitle")) + "</h1>" +
      "<p>" + esc(t("thanksText", { ref: ref })) + "</p>" +
      '<a class="btn" href="#/caps">' + esc(t("backToDrop")) + "</a></section></div>"
    );
  }

  function viewNotFound() {
    return '<div class="wrap page"><section class="empty"><h1>' + esc(t("notFoundTitle")) + "</h1><p>" + esc(t("notFoundText")) + '</p><a class="btn" href="#/">' + esc(t("goHome")) + "</a></section></div>";
  }

  // ---------- router ----------
  var lastPage = null;
  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    var page = parts[0] || "home";
    var title = t("tSite");
    var section = SECTIONS[page];
    var html;

    if (page === "home" || section) {
      // Sections live on the home page; only re-render when coming from another page.
      var wasHome = lastPage === "home";
      if (!wasHome) { app.innerHTML = viewHome(); bindHome(); tick(); }
      lastPage = "home";
      setActive(section || "");
      document.title = title;
      var target = section ? document.getElementById(section) : null;
      if (target) target.scrollIntoView({ behavior: wasHome ? "smooth" : "auto" });
      else window.scrollTo(0, 0);
      return;
    }

    switch (page) {
      case "product":
        var p = findProduct(parts[1]);
        html = viewProduct(parts[1]);
        title = (p ? t("tCap", { name: pName(p), color: pColor(p) }) : t("tNotFound")) + " · " + title;
        break;
      case "cart": html = viewCart(); title = t("tCart") + " · " + title; break;
      case "checkout": html = viewCheckout(); title = t("tCheckout") + " · " + title; break;
      case "thanks": html = viewThanks(parts[1] || ""); title = t("tThanks") + " · " + title; break;
      default: html = viewNotFound(); title = t("tNotFound") + " · " + title;
    }
    app.innerHTML = html;
    lastPage = page;
    document.title = title;
    setActive(page === "product" ? "caps" : page === "checkout" ? "cart" : page);
    window.scrollTo(0, 0);
    bindPage(page, parts);
    tick();
  }

  function setActive(key) {
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === key);
    });
  }

  function bindHome() {
    var img = document.getElementById("hero-img");
    var name = document.getElementById("hero-name");
    var link = document.getElementById("hero-link");
    PRODUCTS.forEach(function (p) { new Image().src = p.image; });
    app.querySelectorAll("[data-swatch]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = findProduct(b.getAttribute("data-swatch"));
        img.src = p.image;
        img.alt = t("capAlt", { color: pColor(p) });
        name.textContent = pName(p) + " · " + pColor(p);
        link.href = "#/product/" + p.id;
        app.querySelectorAll("[data-swatch]").forEach(function (o) {
          o.classList.toggle("active", o === b);
          o.setAttribute("aria-pressed", String(o === b));
        });
      });
    });
    var cf = document.getElementById("contact-form");
    cf.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = document.getElementById("contact-error");
      if (!cf.name.value.trim()) { err.textContent = t("errName"); cf.name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cf.email.value.trim())) { err.textContent = t("errEmail"); cf.email.focus(); return; }
      err.textContent = "";
      cf.reset();
      toast(t("contactThanks"));
    });
  }

  function bindPage(page, parts) {
    if (page === "product") {
      var form = document.getElementById("add-form");
      if (form) form.addEventListener("submit", function (e) {
        e.preventDefault();
        var qty = Math.max(1, parseInt(form.qty.value, 10) || 1);
        var added = addToCart(parts[1], qty);
        if (added) { form.qty.value = 1; refresh(); openDrawer(); }
        else toast(t("maxReachedThis"));
      });
    }
    if (page === "checkout") {
      var cf = document.getElementById("checkout-form");
      if (cf) cf.addEventListener("submit", function (e) {
        e.preventDefault();
        var missing = Array.prototype.filter.call(cf.querySelectorAll("[required]"), function (el) { return !el.value.trim(); });
        var err = document.getElementById("form-error");
        if (missing.length) { err.textContent = t("errFields"); missing[0].focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cf.email.value.trim())) { err.textContent = t("errEmail"); cf.email.focus(); return; }
        var ref = "LIAG-" + Date.now().toString(36).toUpperCase();
        // Demo: reflect the purchase in this visitor's stock numbers.
        cart.forEach(function (l) { findProduct(l.id).stock -= l.qty; });
        cart = [];
        saveCart();
        location.hash = "#/thanks/" + ref;
      });
    }
  }

  // Delegated clicks for buy buttons and cart controls, wherever they are (page or drawer).
  document.addEventListener("click", function (e) {
    var el = e.target.closest("button, a");
    if (!el) return;
    var id;
    if ((id = el.getAttribute("data-lang"))) {
      setLang(id);
      return;
    }
    if (el.classList.contains("cart-link")) {
      e.preventDefault();
      openDrawer();
      return;
    }
    if (el.hasAttribute("data-close")) {
      closeDrawer();
      return;
    }
    if ((id = el.getAttribute("data-buy"))) {
      if (addToCart(id, 1)) openDrawer();
      else toast(t("maxReached", { name: pName(findProduct(id)) }));
      return;
    }
    if (el.hasAttribute("data-bundle")) {
      var n = 0;
      PRODUCTS.forEach(function (p) { n += addToCart(p.id, 1); });
      if (n) openDrawer();
      return;
    }
    if ((id = el.getAttribute("data-remove"))) { removeLine(id); return; }
    if (el.hasAttribute("data-clear")) {
      var saved = cart.slice();
      cart = [];
      saveCart();
      toast(t("cartEmptied"), function () { cart = saved; saveCart(); });
      return;
    }
    var step = el.getAttribute("data-step");
    if (step) {
      var st = el.closest(".stepper");
      var input = st.querySelector("input");
      var line = st.getAttribute("data-line");
      var v = Math.max(+input.min, Math.min(+input.max, (parseInt(input.value, 10) || 0) + +step));
      if (line) {
        if (v === 0) removeLine(line);
        else setQty(line, v);
      } else {
        input.value = v;
        syncStepper(st);
      }
    }
  });

  // Typing a quantity straight into a cart line.
  document.addEventListener("change", function (e) {
    var st = e.target.closest && e.target.closest(".stepper");
    if (!st) return;
    var input = st.querySelector("input");
    var v = Math.max(+input.min, Math.min(+input.max, parseInt(input.value, 10) || 0));
    var line = st.getAttribute("data-line");
    if (line) {
      if (v === 0) removeLine(line);
      else setQty(line, v);
    } else {
      input.value = Math.max(1, v);
      syncStepper(st);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });
  drawer.addEventListener("click", function (e) {
    if (e.target === drawer) closeDrawer();
  });
  document.getElementById("drawer-close").addEventListener("click", closeDrawer);

  // Re-clicking a link to the section you're on should still scroll to it.
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#/"]');
    if (a && a.getAttribute("href") === location.hash) route();
  });

  // ---------- language ----------
  // Fills the static page shell (header, footer, drawer) and marks the active language button.
  function applyStatic() {
    document.documentElement.lang = LANG;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-label]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-label")));
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      var on = b.getAttribute("data-lang") === LANG;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  function setLang(lang) {
    if (!I18N[lang] || lang === LANG) return;
    LANG = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private mode */ }
    applyStatic();
    // Re-render the current page in the new language, keeping the scroll position.
    var y = window.scrollY;
    lastPage = null;
    route();
    window.scrollTo(0, y);
    refresh();
  }

  window.addEventListener("hashchange", function () { closeDrawer(); route(); });
  window.addEventListener("storage", function (e) {
    if (e.key === CART_KEY) { cart = loadCart(); refresh(); }
  });
  applyStatic();
  route();
  refresh();
  tick();
  setInterval(tick, 1000);
})();
