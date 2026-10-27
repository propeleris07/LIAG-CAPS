(function () {
  "use strict";

  var PRODUCTS = window.PRODUCTS || [];
  var CART_KEY = "liag-cart-v1";
  var SIZES = ["S/M", "L/XL"];
  var FREE_SHIPPING_FROM = 50;
  var SHIPPING = 4.9;

  var app = document.getElementById("app");
  var countEl = document.getElementById("cart-count");
  var toastEl = document.getElementById("toast");
  document.getElementById("year").textContent = new Date().getFullYear();

  // ---------- helpers ----------
  function eur(n) {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
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
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  // Drawn cap illustration so the site needs no image files.
  function capSVG(p, label) {
    var c = p.colors;
    return (
      '<svg class="cap" viewBox="0 0 240 180" role="img" aria-label="' + esc(label || p.name) + '">' +
      '<ellipse cx="120" cy="160" rx="92" ry="8" fill="rgba(0,0,0,.12)"/>' +
      '<path d="M40 120 C40 60 80 30 125 30 C170 30 200 62 200 118 Z" fill="' + c.crown + '"/>' +
      '<path d="M125 30 C150 30 170 60 172 118 L200 118 C200 62 170 30 125 30 Z" fill="' + c.panel + '" opacity=".9"/>' +
      '<path d="M125 30 C105 40 98 80 100 120 L80 120 C78 78 92 42 125 30 Z" fill="rgba(255,255,255,.12)"/>' +
      '<path d="M40 120 Q120 104 200 118 L200 124 Q120 112 40 126 Z" fill="rgba(0,0,0,.18)"/>' +
      '<path d="M18 132 Q40 112 110 120 Q70 140 18 138 Z" fill="' + c.brim + '"/>' +
      '<circle cx="125" cy="30" r="5" fill="' + c.panel + '" stroke="rgba(0,0,0,.2)"/>' +
      '<text x="120" y="80" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="11.5" fill="' + c.text + '">LITHUANIA IS</text>' +
      '<text x="120" y="96" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="11.5" fill="' + c.text + '">ALREADY GREAT</text>' +
      "</svg>"
    );
  }

  // ---------- cart ----------
  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(function (l) { return findProduct(l.id); }) : [];
    } catch (e) {
      return [];
    }
  }
  var cart = loadCart();
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* private mode */ }
    updateCount();
  }
  function updateCount() {
    var n = cart.reduce(function (s, l) { return s + l.qty; }, 0);
    countEl.textContent = n;
    countEl.classList.toggle("has-items", n > 0);
  }
  function addToCart(id, size, qty) {
    var line = cart.filter(function (l) { return l.id === id && l.size === size; })[0];
    if (line) line.qty = Math.min(line.qty + qty, 20);
    else cart.push({ id: id, size: size, qty: qty });
    saveCart();
  }
  function totals() {
    var subtotal = cart.reduce(function (s, l) { return s + findProduct(l.id).price * l.qty; }, 0);
    var shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
    return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping };
  }

  // ---------- views ----------
  function card(p) {
    return (
      '<a class="card" href="#/product/' + p.id + '">' +
      (p.tag ? '<span class="tag">' + esc(p.tag) + "</span>" : "") +
      '<div class="card-img">' + capSVG(p) + "</div>" +
      '<div class="card-body"><h3>' + esc(p.name) + "</h3>" +
      '<p class="price">' + eur(p.price) + "</p></div></a>"
    );
  }

  function viewHome() {
    var featured = PRODUCTS.slice(0, 3).map(card).join("");
    return (
      '<section class="hero">' +
      '<div class="hero-text"><p class="eyebrow">Est. 1253, give or take</p>' +
      "<h1>Lithuania is <span>Already Great.</span></h1>" +
      "<p>Caps for people who don't need to make anything great again. Embroidered slogan, Baltic colours, free EU shipping from " + eur(FREE_SHIPPING_FROM) + ".</p>" +
      '<a class="btn" href="#/shop">Shop the caps</a></div>' +
      '<div class="hero-img">' + capSVG(PRODUCTS[0], "Classic Trispalvė Snapback") + "</div></section>" +
      '<section><div class="section-head"><h2>Featured</h2><a href="#/shop">See all ' + PRODUCTS.length + " caps →</a></div>" +
      '<div class="grid">' + featured + "</div></section>" +
      '<section class="perks"><div><h3>Embroidered</h3><p>Stitched, not stuck on. Survives the sauna.</p></div>' +
      "<div><h3>EU shipping</h3><p>Flat " + eur(SHIPPING) + ", free over " + eur(FREE_SHIPPING_FROM) + ".</p></div>" +
      "<div><h3>30-day returns</h3><p>Wrong size? Send it back.</p></div></section>"
    );
  }

  function viewShop() {
    return (
      '<section><h1 class="page-title">All caps</h1>' +
      '<p class="muted">' + PRODUCTS.length + " styles, all carrying the same simple truth.</p>" +
      '<div class="grid">' + PRODUCTS.map(card).join("") + "</div></section>"
    );
  }

  function viewProduct(id) {
    var p = findProduct(id);
    if (!p) return viewNotFound();
    var sizes = SIZES.map(function (s, i) {
      return '<label class="size"><input type="radio" name="size" value="' + s + '"' + (i === 0 ? " checked" : "") + "><span>" + s + "</span></label>";
    }).join("");
    return (
      '<nav class="crumbs"><a href="#/shop">← Back to shop</a></nav>' +
      '<section class="product">' +
      '<div class="product-img">' + capSVG(p) + "</div>" +
      '<div class="product-info">' +
      (p.tag ? '<span class="tag static">' + esc(p.tag) + "</span>" : "") +
      "<h1>" + esc(p.name) + "</h1>" +
      '<p class="price big">' + eur(p.price) + "</p>" +
      "<p>" + esc(p.description) + "</p>" +
      '<form id="add-form" class="add-form">' +
      '<fieldset><legend>Size</legend><div class="sizes">' + sizes + "</div></fieldset>" +
      '<label class="qty-label">Quantity <input type="number" name="qty" min="1" max="20" value="1"></label>' +
      '<button class="btn" type="submit">Add to cart</button></form>' +
      '<ul class="details">' + p.details.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" +
      "</div></section>"
    );
  }

  function viewCart() {
    if (!cart.length) {
      return '<section class="empty"><h1 class="page-title">Your cart is empty</h1><p>Every head deserves to be great. Well, already great.</p><a class="btn" href="#/shop">Browse caps</a></section>';
    }
    var rows = cart.map(function (l, i) {
      var p = findProduct(l.id);
      return (
        '<li class="line">' +
        '<a class="line-img" href="#/product/' + p.id + '">' + capSVG(p) + "</a>" +
        '<div class="line-info"><a href="#/product/' + p.id + '"><strong>' + esc(p.name) + "</strong></a>" +
        '<span class="muted">Size ' + esc(l.size) + " · " + eur(p.price) + " each</span></div>" +
        '<div class="line-qty"><button type="button" data-dec="' + i + '" aria-label="Decrease quantity">−</button>' +
        "<span>" + l.qty + "</span>" +
        '<button type="button" data-inc="' + i + '" aria-label="Increase quantity">+</button></div>' +
        '<div class="line-total">' + eur(p.price * l.qty) + "</div>" +
        '<button type="button" class="link" data-remove="' + i + '">Remove</button></li>'
      );
    }).join("");
    var t = totals();
    var nudge = t.shipping > 0 ? '<p class="muted small">Add ' + eur(FREE_SHIPPING_FROM - t.subtotal) + " more for free shipping.</p>" : "";
    return (
      '<h1 class="page-title">Your cart</h1>' +
      '<div class="cart-layout"><ul class="lines">' + rows + "</ul>" +
      '<aside class="summary"><h2>Summary</h2>' +
      "<dl><dt>Subtotal</dt><dd>" + eur(t.subtotal) + "</dd>" +
      "<dt>Shipping</dt><dd>" + (t.shipping ? eur(t.shipping) : "Free") + "</dd>" +
      '<dt class="total">Total</dt><dd class="total">' + eur(t.total) + "</dd></dl>" + nudge +
      '<a class="btn block" href="#/checkout">Checkout</a>' +
      '<button type="button" class="link" id="clear-cart">Empty cart</button></aside></div>'
    );
  }

  function viewCheckout() {
    if (!cart.length) return viewCart();
    var t = totals();
    return (
      '<h1 class="page-title">Checkout</h1>' +
      '<p class="notice">This is a demo. Submitting the form does not charge anything or send an order. Please don\'t enter real card details.</p>' +
      '<div class="cart-layout"><form id="checkout-form" class="checkout" novalidate>' +
      '<label>Full name<input name="name" required autocomplete="name"></label>' +
      '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<label>Address<input name="address" required autocomplete="street-address"></label>' +
      '<div class="row"><label>City<input name="city" required autocomplete="address-level2"></label>' +
      '<label>Postal code<input name="zip" required autocomplete="postal-code"></label></div>' +
      '<label>Country<select name="country"><option>Lithuania</option><option>Latvia</option><option>Estonia</option><option>Poland</option><option>Germany</option><option>Netherlands</option><option>Other EU country</option></select></label>' +
      '<p class="error" id="form-error" role="alert"></p>' +
      '<button class="btn" type="submit">Place demo order · ' + eur(t.total) + "</button></form>" +
      '<aside class="summary"><h2>Order</h2><ul class="mini">' +
      cart.map(function (l) {
        var p = findProduct(l.id);
        return "<li><span>" + l.qty + "× " + esc(p.name) + " (" + esc(l.size) + ")</span><span>" + eur(p.price * l.qty) + "</span></li>";
      }).join("") +
      "</ul><dl><dt>Shipping</dt><dd>" + (t.shipping ? eur(t.shipping) : "Free") + '</dd><dt class="total">Total</dt><dd class="total">' + eur(t.total) + "</dd></dl></aside></div>"
    );
  }

  function viewThanks(ref) {
    return (
      '<section class="empty"><h1 class="page-title">Ačiū! Demo order received</h1>' +
      "<p>Reference <strong>" + esc(ref) + "</strong>. Nothing was charged and nothing will ship. In the real store this is where payment and order confirmation would happen.</p>" +
      '<a class="btn" href="#/shop">Back to shop</a></section>'
    );
  }

  function viewAbout() {
    return (
      '<section class="prose"><h1 class="page-title">About</h1>' +
      "<p>Some countries need to be made great again. Lithuania already is: some of the fastest internet in Europe, a basketball obsession that borders on religion, cold beetroot soup that turns pink on purpose, and a history of standing up when it counted.</p>" +
      "<p>We make simple caps that say so. Every design carries the same slogan, <strong>“Lithuania is Already Great”</strong>, in colours taken from the trispalvė, the Baltic coast and the forests in between.</p>" +
      "<h2>Shipping & returns</h2><p>Flat " + eur(SHIPPING) + " EU shipping, free over " + eur(FREE_SHIPPING_FROM) + ". Returns within 30 days.</p>" +
      '<p class="notice">This website is currently a demo storefront. Payments and order fulfilment are not connected yet.</p></section>'
    );
  }

  function viewNotFound() {
    return '<section class="empty"><h1 class="page-title">Page not found</h1><p>That page doesn\'t exist, but Lithuania is still great.</p><a class="btn" href="#/">Go home</a></section>';
  }

  // ---------- router ----------
  function route() {
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/");
    var page = parts[0] || "home";
    var html;
    var title = "Lithuania is Already Great";
    switch (page) {
      case "home": html = viewHome(); break;
      case "shop": html = viewShop(); title = "Shop · " + title; break;
      case "product":
        html = viewProduct(parts[1]);
        var p = findProduct(parts[1]);
        title = (p ? p.name : "Not found") + " · " + title;
        break;
      case "cart": html = viewCart(); title = "Cart · " + title; break;
      case "checkout": html = viewCheckout(); title = "Checkout · " + title; break;
      case "thanks": html = viewThanks(parts[1] || ""); title = "Thank you · " + title; break;
      case "about": html = viewAbout(); title = "About · " + title; break;
      default: html = viewNotFound(); title = "Not found · " + title;
    }
    app.innerHTML = html;
    document.title = title;
    var navKey = page === "product" ? "shop" : page === "checkout" ? "cart" : page;
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === navKey);
    });
    window.scrollTo(0, 0);
    bind(page, parts);
  }

  function bind(page, parts) {
    if (page === "product") {
      var form = document.getElementById("add-form");
      if (form) form.addEventListener("submit", function (e) {
        e.preventDefault();
        var size = form.querySelector('input[name="size"]:checked').value;
        var qty = Math.max(1, Math.min(20, parseInt(form.qty.value, 10) || 1));
        addToCart(parts[1], size, qty);
        toast("Added " + qty + " × " + findProduct(parts[1]).name + " to cart");
      });
    }
    if (page === "cart") {
      app.addEventListener("click", cartClick);
    } else {
      app.removeEventListener("click", cartClick);
    }
    if (page === "checkout") {
      var cf = document.getElementById("checkout-form");
      if (cf) cf.addEventListener("submit", function (e) {
        e.preventDefault();
        var missing = Array.prototype.filter.call(cf.querySelectorAll("[required]"), function (el) { return !el.value.trim(); });
        var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cf.email.value.trim());
        var err = document.getElementById("form-error");
        if (missing.length) { err.textContent = "Please fill in all fields."; missing[0].focus(); return; }
        if (!emailOk) { err.textContent = "Please enter a valid email address."; cf.email.focus(); return; }
        var ref = "LIAG-" + Date.now().toString(36).toUpperCase();
        cart = [];
        saveCart();
        location.hash = "#/thanks/" + ref;
      });
    }
  }

  function cartClick(e) {
    var t = e.target;
    var i;
    if ((i = t.getAttribute("data-inc")) !== null) cart[i].qty = Math.min(cart[i].qty + 1, 20);
    else if ((i = t.getAttribute("data-dec")) !== null) {
      cart[i].qty -= 1;
      if (cart[i].qty < 1) cart.splice(i, 1);
    } else if ((i = t.getAttribute("data-remove")) !== null) cart.splice(i, 1);
    else if (t.id === "clear-cart") cart = [];
    else return;
    saveCart();
    route();
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("storage", function (e) {
    if (e.key === CART_KEY) { cart = loadCart(); updateCount(); }
  });
  updateCount();
  route();
})();
