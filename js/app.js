(function () {
  "use strict";

  var PRODUCTS = window.PRODUCTS || [];
  var SHOP = window.SHOP;
  var CART_KEY = "liag-cart-v2";
  var SECTIONS = { about: "about", caps: "caps", story: "story", contact: "contact" };

  var app = document.getElementById("app");
  var countEl = document.getElementById("cart-count");
  var toastEl = document.getElementById("toast");
  document.getElementById("year").textContent = new Date().getFullYear();

  // ---------- helpers ----------
  function eur(n) {
    var whole = Math.round(n * 100) % 100 === 0;
    return new Intl.NumberFormat("en-IE", {
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
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button type="button" class="toast-undo">Undo</button>' : "");
    if (undo) toastEl.querySelector("button").onclick = function () { undo(); toastEl.classList.remove("show"); };
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, undo ? 5000 : 2400);
  }
  function capImg(p, cls, small) {
    return '<img class="' + (cls || "") + '" src="' + (small ? p.thumb : p.image) + '" alt="' +
      esc(p.color) + ' cap embroidered with Lithuania is Already Great" loading="lazy" width="756" height="502">';
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
    toast("Removed " + findProduct(id).name + " from cart", function () {
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
    return '<div class="countdown" data-countdown aria-label="Time left in the drop">' +
      ["d", "h", "m", "s"].map(function (k) {
        return '<div><span data-cd="' + k + '">00</span><small>' + { d: "days", h: "hours", m: "min", s: "sec" }[k] + "</small></div>";
      }).join("") + "</div>";
  }
  function tick() {
    var c = countdownParts();
    document.querySelectorAll("[data-cd]").forEach(function (el) {
      el.textContent = pad(c[el.getAttribute("data-cd")]);
    });
    document.querySelectorAll("[data-cd-inline]").forEach(function (el) {
      el.textContent = c.d + "d " + pad(c.h) + ":" + pad(c.m) + ":" + pad(c.s);
    });
    if (!dropOpen() && !document.body.classList.contains("drop-closed")) {
      document.body.classList.add("drop-closed");
      refresh();
    }
  }
  function stockLine(p) {
    var l = left(p);
    var pct = Math.round(100 * p.stock / p.stockTotal);
    var label = !dropOpen() ? "Drop closed" : p.stock === 0 ? "Sold out" : p.stock <= 10 ? "Almost gone · " + p.stock + " left" : "Only " + p.stock + " of " + p.stockTotal + " left";
    return '<div class="stockbar' + (p.stock <= 10 ? " low" : "") + '" data-stock="' + p.id + '">' +
      '<p class="stock"><span class="dot live"></span>' + esc(label) + "</p>" +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      (inCart(p.id) && dropOpen() ? '<p class="held">' + inCart(p.id) + " in your cart" + (l === 0 ? " · that's all of them" : "") + "</p>" : "") +
      "</div>";
  }
  function buyLabel(p) {
    if (!dropOpen()) return "Drop closed";
    if (p.stock === 0) return "Sold out";
    if (inCart(p.id) >= maxQty(p)) return "Max in cart";
    return "Buy " + p.name + " · " + eur(p.price);
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
    return '<div class="swatches" role="group" aria-label="Colour">' + PRODUCTS.map(function (p) {
      var attrs = ' class="swatch' + (p.id === activeId ? " active" : "") + '" style="--c:' + p.swatch + '" aria-label="' + esc(p.name + " · " + p.color) + '"';
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
      '<div class="card-head"><h3><a href="#/product/' + p.id + '">' + esc(p.name) + '</a></h3><span class="price">' + eur(p.price) + "</span></div>" +
      '<p class="card-desc">' + esc(p.description) + "</p>" +
      '<button type="button" class="btn block" data-buy="' + p.id + '"' + (buyLabel(p).indexOf("Buy") ? " disabled" : "") + ">" + esc(buyLabel(p)) + "</button>" +
      "</article>"
    );
  }

  function viewHome() {
    var first = PRODUCTS[0];
    return (
      '<section class="hero">' +
      '<div class="hero-bg" aria-hidden="true"></div>' +
      '<div class="wrap hero-inner">' +
      '<div class="hero-text">' +
      '<p class="eyebrow">Embroidered caps · Yellow, green, red</p>' +
      "<h1>Lithuania is already great.</h1>" +
      "<p class=\"lead\">No promises, no campaign. Just a cap for people who already know it, from the Baltic coast to the panel blocks, in every corner of the country.</p>" +
      '<div class="hero-actions"><a class="btn" href="#/caps"><span class="dot live"></span>Shop ' + esc(SHOP.drop.name) + "</a>" + '<a class="btn btn-outline" href="#/about">Our story</a></div>' +
      '<p class="live-line"><span class="dot live"></span><strong>' + esc(SHOP.drop.name) + ' is live</strong> · closes in <span data-cd-inline></span></p>' +
      "</div>" +
      '<div class="hero-card"><span class="pill pill-live"><span class="dot live"></span>Live now</span>' +
      '<a class="hero-img" id="hero-link" href="#/product/' + first.id + '">' + capImg(first, "", false).replace('loading="lazy"', 'loading="eager" id="hero-img"') + "</a>" +
      '<p class="hero-name" id="hero-name">' + esc(first.name + " · " + first.color) + "</p>" +
      swatches(first.id, false) +
      "</div></div></section>" +
      '<div class="stripe" aria-hidden="true"><i></i><i></i><i></i></div>' +

      '<section class="manifesto" id="about"><div class="wrap manifesto-inner">' +
      '<h2>Not again.<br><span>Already.</span></h2>' +
      "<div><p>Other caps promise to make things great again. Ours skips the promise. Lithuania already is: the basketball, the cepelinai, the stubbornness, and the grey nine-storey blocks with a whole life behind every window.</p>" +
      "<p>Lithuania Is Already Great is a small cap brand built on that idea. Pride with a wink, in the three colors of the flag.</p>" +
      '<dl class="stats"><div style="--c:var(--yellow)"><dt>3</dt><dd>colors</dd></div><div style="--c:var(--green)"><dt>1</dt><dd>message</dd></div><div style="--c:var(--red)"><dt>' + PRODUCTS.length + "</dt><dd>caps in the first drop</dd></div></dl>" +
      "</div></div></section>" +

      '<section class="drop" id="caps"><div class="wrap">' +
      '<div class="drop-head"><div><span class="pill pill-live"><span class="dot live"></span>Live now</span>' +
      '<h2>Drop 01 is <span class="green">live</span></h2>' +
      '<p class="scarcity">Only ' + PRODUCTS[0].stockTotal + ' caps per color. When they\'re gone, they\'re gone.</p>' +
      '<p class="closes">' + esc(SHOP.drop.name) + " closes in</p>" + countdownBoxes() + "</div>" +
      '<div class="drop-meta"><p>Raised white embroidery on the front and sides · Flat brim · Adjustable snapback. Every cap carries the same message.</p>' +
      "<p><strong>" + eur(PRODUCTS[0].price) + " each · " + esc(SHOP.bundle.label) + '</strong></p><button type="button" class="btn btn-outline btn-sm" data-bundle>Buy all three · ' + eur(SHOP.bundle.price) + "</button></div></div>" +
      '<div class="grid">' + PRODUCTS.map(productCard).join("") + "</div>" +
      "</div></section>" +

      '<section class="banner" id="story"><div class="banner-img" role="img" aria-label="Snow-dusted Soviet-era apartment blocks"></div>' +
      '<div class="banner-text"><div class="wrap"><p class="eyebrow yellow">One country · One cap · Every block</p><h2>Already great. Even in November.</h2></div></div></section>' +

      '<section class="how"><div class="wrap"><div class="how-box"><h2>How it works</h2><ol class="steps">' +
      '<li style="--c:#B8860B"><span>01</span><h3>Pick a color</h3><p>Yellow, green or red. Or all three, no judgement.</p></li>' +
      '<li style="--c:var(--green)"><span>02</span><h3>Catch the drop</h3><p>Hit Buy and check out. Every drop is limited: when it\'s gone, it\'s gone until the next one.</p></li>' +
      '<li style="--c:var(--red)"><span>03</span><h3>Wear it proudly</h3><p>Shipping across the EU. Flat ' + eur(SHOP.shipping.flat) + ", free on orders over " + eur(SHOP.shipping.freeFrom) + ".</p></li>" +
      "</ol></div></div></section>" +

      '<section class="contact" id="contact"><div class="wrap contact-inner">' +
      "<div><h2>Say labas</h2><p>Questions about an order, or want to know when the next drop lands? Send us a message.</p></div>" +
      '<form class="panel form" id="contact-form" novalidate>' +
      '<label>Name<input name="name" required autocomplete="name"></label>' +
      '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<label class="check"><input type="checkbox" name="notify"> Tell me when the next drop lands</label>' +
      '<label>Message (optional)<textarea name="message" rows="3"></textarea></label>' +
      '<p class="error" id="contact-error" role="alert"></p>' +
      '<button class="btn block" type="submit">Send message</button></form>' +
      "</div></section>"
    );
  }

  function viewProduct(id) {
    var p = findProduct(id);
    if (!p) return viewNotFound();
    return (
      '<div class="wrap page"><nav class="crumbs"><a href="#/caps">← All caps</a></nav>' +
      '<section class="product" style="--c:' + p.swatch + '">' +
      '<div class="product-img">' + capImg(p, "", false).replace('loading="lazy"', 'loading="eager"') + "</div>" +
      '<div class="product-info">' +
      stockLine(p) +
      "<h1>" + esc(p.name) + ' <span class="muted-h">· ' + esc(p.color) + "</span></h1>" +
      '<p class="price big">' + eur(p.price) + "</p>" +
      "<p>" + esc(p.description) + "</p>" +
      swatches(p.id, true) +
      '<form id="add-form" class="add-form">' +
      stepper("qty", 1, 1, Math.max(1, maxQty(p) - inCart(p.id))) +
      '<button class="btn" type="submit" data-add="' + p.id + '"' + (buyLabel(p).indexOf("Buy") ? " disabled" : "") + ">" + (buyLabel(p).indexOf("Buy") ? esc(buyLabel(p)) : "Add to cart · " + eur(p.price)) + "</button></form>" +
      '<p class="live-line small"><span class="dot live"></span>' + esc(SHOP.drop.name) + ' closes in <span data-cd-inline></span></p>' +
      '<p class="bundle-note">' + esc(SHOP.bundle.label) + ': add one of each color and the discount is applied in the cart.</p>' +
      '<ul class="details">' + SHOP.details.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" +
      "</div></section></div>"
    );
  }

  function viewCart() {
    if (!cart.length) {
      return '<div class="wrap page"><section class="empty"><h1>Your cart is empty</h1><p>Every head deserves a cap that says it. Pick a color.</p><a class="btn" href="#/caps">Shop Drop 01</a></section></div>';
    }
    var rows = cart.map(cartLine).join("");
    var t = totals();
    var missing = PRODUCTS.filter(function (p) { return !cart.some(function (l) { return l.id === p.id; }); });
    var nudge = bundleNudge();
    return (
      '<div class="wrap page"><h1>Your cart <span class="muted-h">(' + cartCount() + ")</span></h1>" +
      '<div class="cart-layout"><ul class="lines">' + rows + "</ul>" +
      '<aside class="panel summary"><h2>Summary</h2>' + summaryRows(t) + nudge +
      '<a class="btn block" href="#/checkout">Checkout · ' + eur(t.total) + "</a>" +
      '<a class="btn btn-outline block" href="#/caps">Continue shopping</a>' +
      '<button type="button" class="link" data-clear>Empty cart</button></aside></div></div>'
    );
  }

  function stepper(name, value, min, max, id) {
    var attr = id ? ' data-line="' + id + '"' : "";
    return '<div class="stepper"' + attr + '>' +
      '<button type="button" data-step="-1" aria-label="Decrease quantity"' + (value <= min ? " disabled" : "") + ">−</button>" +
      '<input type="number" name="' + name + '" value="' + value + '" min="' + min + '" max="' + max + '" inputmode="numeric" aria-label="Quantity">' +
      '<button type="button" data-step="1" aria-label="Increase quantity"' + (value >= max ? " disabled" : "") + ">+</button></div>";
  }

  function cartLine(l) {
    var p = findProduct(l.id);
    var max = maxQty(p);
    return (
      '<li class="line" data-id="' + p.id + '">' +
      '<a class="line-img" href="#/product/' + p.id + '">' + capImg(p, "", true) + "</a>" +
      '<div class="line-info"><a href="#/product/' + p.id + '"><strong>' + esc(p.name) + "</strong></a>" +
      '<span class="muted">' + esc(p.color) + " · " + eur(p.price) + " each</span>" +
      (l.qty >= max ? '<span class="small warn">Max ' + max + " per order</span>" : "") + "</div>" +
      stepper("line-" + p.id, l.qty, 0, max, p.id) +
      '<div class="line-total">' + eur(p.price * l.qty) + "</div>" +
      '<button type="button" class="icon-btn" data-remove="' + p.id + '" aria-label="Remove ' + esc(p.name) + '">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z"/></svg></button></li>'
    );
  }

  function bundleNudge() {
    var t = totals();
    var missing = PRODUCTS.filter(function (p) { return !inCart(p.id) && p.stock > 0; });
    if (t.sets || !missing.length || missing.length === PRODUCTS.length || !dropOpen()) return "";
    return '<div class="nudge"><p>Add ' + missing.map(function (p) { return esc(p.name); }).join(" and ") +
      " and get all three for " + eur(SHOP.bundle.price) + ".</p>" +
      missing.map(function (p) { return '<button type="button" class="btn btn-outline btn-sm" data-buy="' + p.id + '">+ ' + esc(p.name) + "</button>"; }).join("") + "</div>";
  }

  function shippingProgress() {
    var t = totals();
    var after = t.subtotal - t.discount;
    if (!after) return "";
    var pct = Math.min(100, Math.round(100 * after / SHOP.shipping.freeFrom));
    return '<div class="ship"><p>' + (t.shipping ? "You're " + eur(SHOP.shipping.freeFrom - after) + " away from free shipping" : "You've unlocked free shipping") + '</p><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }

  // ---------- cart drawer ----------
  var drawer = document.getElementById("drawer");
  var drawerBody = document.getElementById("drawer-body");
  var lastFocus = null;
  function renderDrawer() {
    document.getElementById("drawer-count").textContent = cartCount();
    if (!cart.length) {
      drawerBody.innerHTML = '<div class="drawer-empty"><p><strong>Your cart is empty.</strong></p><p class="muted">Pick a color while the drop is live.</p>' +
        '<div class="mini-picks">' + PRODUCTS.map(function (p) {
          return '<a href="#/product/' + p.id + '" data-close>' + capImg(p, "", true) + "<span>" + esc(p.name) + "</span></a>";
        }).join("") + "</div>" +
        '<a class="btn block" href="#/caps" data-close>Shop ' + esc(SHOP.drop.name) + "</a></div>";
      return;
    }
    var t = totals();
    drawerBody.innerHTML = shippingProgress() + '<ul class="lines">' + cart.map(cartLine).join("") + "</ul>" + bundleNudge() +
      '<div class="drawer-foot">' + summaryRows(t) +
      '<a class="btn block" href="#/checkout" data-close>Checkout · ' + eur(t.total) + "</a>" +
      '<div class="drawer-links"><a href="#/cart" data-close>View cart</a><button type="button" class="link" data-close>Continue shopping</button></div></div>';
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
      b.disabled = buyLabel(p).indexOf("Buy") !== 0;
    });
    var add = document.querySelector("[data-add]");
    if (add) {
      var ap = findProduct(add.getAttribute("data-add"));
      var ok = buyLabel(ap).indexOf("Buy") === 0;
      add.disabled = !ok;
      add.textContent = ok ? "Add to cart · " + eur(ap.price) : buyLabel(ap);
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

  function summaryRows(t) {
    return "<dl><dt>Subtotal</dt><dd>" + eur(t.subtotal) + "</dd>" +
      (t.discount ? "<dt>Bundle discount" + (t.sets > 1 ? " ×" + t.sets : "") + '</dt><dd class="green">−' + eur(t.discount) + "</dd>" : "") +
      "<dt>Shipping</dt><dd>" + (t.shipping ? eur(t.shipping) : "Free") + "</dd>" +
      '<dt class="total">Total</dt><dd class="total">' + eur(t.total) + "</dd></dl>";
  }

  function viewCheckout() {
    if (!cart.length) return viewCart();
    var t = totals();
    return (
      '<div class="wrap page"><h1>Checkout</h1>' +
      '<p class="notice">This is a demo. Submitting the form does not charge anything or create an order. Please don\'t enter real card details.</p>' +
      '<div class="cart-layout"><form id="checkout-form" class="panel form" novalidate>' +
      '<label>Full name<input name="name" required autocomplete="name"></label>' +
      '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<label>Address<input name="address" required autocomplete="street-address"></label>' +
      '<div class="row"><label>City<input name="city" required autocomplete="address-level2"></label>' +
      '<label>Postal code<input name="zip" required autocomplete="postal-code"></label></div>' +
      '<label>Country<select name="country"><option>Lithuania</option><option>Latvia</option><option>Estonia</option><option>Poland</option><option>Germany</option><option>Netherlands</option><option>Other EU country</option></select></label>' +
      '<p class="error" id="form-error" role="alert"></p>' +
      '<button class="btn block" type="submit">Place demo order · ' + eur(t.total) + "</button>" +
      '<a class="link back" href="#/cart">← Back to cart</a></form>' +
      '<aside class="panel summary"><h2>Order</h2><ul class="mini">' +
      cart.map(function (l) {
        var p = findProduct(l.id);
        return "<li><span>" + l.qty + "× " + esc(p.name) + " (" + esc(p.color) + ")</span><span>" + eur(p.price * l.qty) + "</span></li>";
      }).join("") +
      "</ul>" + summaryRows(t) + "</aside></div></div>"
    );
  }

  function viewThanks(ref) {
    return (
      '<div class="wrap page"><section class="empty"><h1>Ačiū! Demo order received</h1>' +
      "<p>Reference <strong>" + esc(ref) + "</strong>. Nothing was charged and nothing will ship. In the real store this is where payment and order confirmation would happen.</p>" +
      '<a class="btn" href="#/caps">Back to the drop</a></section></div>'
    );
  }

  function viewNotFound() {
    return '<div class="wrap page"><section class="empty"><h1>Page not found</h1><p>That page doesn\'t exist. Lithuania is still great, though.</p><a class="btn" href="#/">Go home</a></section></div>';
  }

  // ---------- router ----------
  var lastPage = null;
  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    var page = parts[0] || "home";
    var title = "Lithuania is Already Great";
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
        title = (p ? p.name + " · " + p.color + " cap" : "Not found") + " · " + title;
        break;
      case "cart": html = viewCart(); title = "Cart · " + title; break;
      case "checkout": html = viewCheckout(); title = "Checkout · " + title; break;
      case "thanks": html = viewThanks(parts[1] || ""); title = "Thank you · " + title; break;
      default: html = viewNotFound(); title = "Not found · " + title;
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
        img.alt = p.color + " cap embroidered with Lithuania is Already Great";
        name.textContent = p.name + " · " + p.color;
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
      if (!cf.name.value.trim()) { err.textContent = "Please add your name."; cf.name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cf.email.value.trim())) { err.textContent = "Please enter a valid email address."; cf.email.focus(); return; }
      err.textContent = "";
      cf.reset();
      toast("Thanks! (Demo: messages aren't delivered yet.)");
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
        else toast("You already have the maximum of this cap in your cart");
      });
    }
    if (page === "checkout") {
      var cf = document.getElementById("checkout-form");
      if (cf) cf.addEventListener("submit", function (e) {
        e.preventDefault();
        var missing = Array.prototype.filter.call(cf.querySelectorAll("[required]"), function (el) { return !el.value.trim(); });
        var err = document.getElementById("form-error");
        if (missing.length) { err.textContent = "Please fill in all fields."; missing[0].focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cf.email.value.trim())) { err.textContent = "Please enter a valid email address."; cf.email.focus(); return; }
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
    var t = e.target.closest("button, a");
    if (!t) return;
    var id;
    if (t.classList.contains("cart-link")) {
      e.preventDefault();
      openDrawer();
      return;
    }
    if (t.hasAttribute("data-close")) {
      closeDrawer();
      return;
    }
    if ((id = t.getAttribute("data-buy"))) {
      if (addToCart(id, 1)) openDrawer();
      else toast("You already have the maximum of " + findProduct(id).name + " in your cart");
      return;
    }
    if (t.hasAttribute("data-bundle")) {
      var n = 0;
      PRODUCTS.forEach(function (p) { n += addToCart(p.id, 1); });
      if (n) openDrawer();
      return;
    }
    if ((id = t.getAttribute("data-remove"))) { removeLine(id); return; }
    if (t.hasAttribute("data-clear")) {
      var saved = cart.slice();
      cart = [];
      saveCart();
      toast("Cart emptied", function () { cart = saved; saveCart(); });
      return;
    }
    var step = t.getAttribute("data-step");
    if (step) {
      var st = t.closest(".stepper");
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

  window.addEventListener("hashchange", function () { closeDrawer(); route(); });
  window.addEventListener("storage", function (e) {
    if (e.key === CART_KEY) { cart = loadCart(); refresh(); }
  });
  route();
  refresh();
  tick();
  setInterval(tick, 1000);
})();
