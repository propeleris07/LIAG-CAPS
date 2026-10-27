// Smoke test for the storefront: live drop, navigation, product pages, cart drawer, cart page, demo checkout.
// Usage: node tests/smoke.js <site-url>
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://localhost:8000/").replace(/\/?$/, "/");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const check = (cond, msg) => {
    console.log((cond ? "PASS " : "FAIL ") + msg);
    if (!cond) process.exitCode = 1;
  };
  const count = () => page.textContent("#cart-count");
  const drawerOpen = () => page.evaluate(() => !document.getElementById("drawer").hidden);
  const closeDrawer = async () => { await page.click("#drawer-close"); await page.waitForTimeout(300); };
  const summary = () => page.textContent(".drawer-foot");

  // ---- home and live drop ----
  await page.goto(BASE);
  await page.waitForSelector(".hero");
  check((await page.title()) === "Lithuania is Already Great", "home page loads");
  check(await page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)), "hero cap photo loads");
  check(await page.evaluate(() => getComputedStyle(document.querySelector(".dot.live"), "::after").animationName === "pulse"), "live dot pulses");
  const t1 = await page.textContent("[data-cd-inline]");
  await page.waitForTimeout(1200);
  const t2 = await page.textContent("[data-cd-inline]");
  check(/\d+d \d\d:\d\d:\d\d/.test(t1) && t1 !== t2, `countdown ticks (${t1} → ${t2})`);

  await page.click('[data-swatch="hope"]');
  check((await page.textContent("#hero-name")).includes("Hope"), "hero colour switcher works");

  await page.click("nav >> text=Caps");
  await page.waitForTimeout(600);
  check((await page.$$("#caps .card")).length === 3, "drop shows 3 caps");
  check(await page.evaluate(() => document.getElementById("caps").getBoundingClientRect().top < 200), "Caps link scrolls to the drop");
  check(await page.evaluate(() => [...document.querySelectorAll("#caps img")].every((i) => i.complete && i.naturalWidth > 0)), "product photos load");
  check((await page.$$("#caps .countdown [data-cd]")).length === 4, "drop countdown shown");
  check((await page.textContent('[data-stock="courage"]')).includes("27"), "stock left shown per cap");

  // ---- buy opens drawer; +/−; remove + undo ----
  await page.click('#caps [data-buy="sun"]');
  await page.waitForTimeout(300);
  check(await drawerOpen(), "Buy opens the cart drawer");
  check((await count()) === "1", "cart count = 1");
  await page.click('#drawer [data-line="sun"] [data-step="1"]');
  check((await count()) === "2", "drawer + increases quantity");
  check((await page.inputValue('#drawer [data-line="sun"] input')) === "2", "drawer shows new quantity");
  await page.click('#drawer [data-line="sun"] [data-step="-1"]');
  check((await count()) === "1", "drawer − decreases quantity");
  await page.fill('#drawer [data-line="sun"] input', "4");
  await page.press('#drawer [data-line="sun"] input', "Tab");
  check((await count()) === "4", "typing a quantity updates the cart");
  check((await page.textContent('[data-stock="sun"]')).includes("4 in your cart"), "card shows how many are in your cart");
  await page.click('#drawer [data-remove="sun"]');
  check((await count()) === "0", "remove button deletes the item");
  check((await page.textContent("#drawer-body")).includes("Your cart is empty"), "empty cart state shown");
  await page.click(".toast-undo");
  check((await count()) === "4", "undo restores the removed item");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check(!(await drawerOpen()), "Escape closes the drawer");

  // ---- stock / per-order limits ----
  await page.click(".cart-link");
  await page.waitForTimeout(300);
  check(await drawerOpen(), "header cart button opens the drawer");
  await page.fill('#drawer [data-line="sun"] input', "99");
  await page.press('#drawer [data-line="sun"] input', "Tab");
  check((await count()) === "10", "quantity capped at 10 per order");
  check(await page.isDisabled('#drawer [data-line="sun"] [data-step="1"]'), "+ disabled at the limit");
  await closeDrawer();
  check(await page.isDisabled('#caps [data-buy="sun"]'), "Buy button disabled when max is in cart");
  await page.click(".cart-link");
  await page.waitForTimeout(300);
  await page.fill('#drawer [data-line="sun"] input', "1");
  await page.press('#drawer [data-line="sun"] input', "Tab");

  // ---- bundle nudge in drawer ----
  check((await page.textContent("#drawer-body")).includes("get all three"), "drawer suggests the bundle");
  await page.click('#drawer .nudge [data-buy="hope"]');
  await page.click('#drawer .nudge [data-buy="courage"]');
  const s1 = await summary();
  check(s1.includes("−€12") && s1.includes("€75"), "bundle: one of each = €75");
  await closeDrawer();

  // ---- product page ----
  await page.click('#caps .card h3 a[href="#/product/courage"]');
  await page.waitForSelector("#add-form");
  check((await page.textContent("h1")).includes("Courage"), "product page opens");
  await page.click('#add-form [data-step="1"]');
  check((await page.inputValue('#add-form input[name="qty"]')) === "2", "product quantity stepper works");
  await page.click("[data-add]");
  await page.waitForTimeout(300);
  check(await drawerOpen(), "Add to cart opens the drawer");
  check((await count()) === "5", "add to cart with quantity (1 Sun, 1 Hope, 3 Courage)");
  await closeDrawer();
  await page.click('.swatch[href="#/product/hope"]');
  await page.waitForFunction(() => document.querySelector("h1").textContent.includes("Hope"));
  check(true, "colour swatch links to the other cap");

  for (const [link, id] of [["About", "about"], ["Our story", "story"], ["Contact", "contact"]]) {
    await page.click(`header nav >> text=${link}`);
    // Smooth scrolling can take a moment on slow machines; wait for it to land.
    const landed = await page
      .waitForFunction((s) => Math.abs(document.getElementById(s).getBoundingClientRect().top) < 200, id, { timeout: 4000 })
      .then(() => true, () => false);
    check(landed, `${link} link scrolls to its section`);
  }

  // ---- cart page ----
  await page.goto(BASE + "#/cart");
  await page.waitForSelector(".line");
  const cartText = await page.textContent(".summary");
  check(cartText.includes("€145") && cartText.includes("−€12") && cartText.includes("€133"), "cart page: €145 − €12 = €133");
  await page.click('.page [data-line="courage"] [data-step="-1"]');
  check((await count()) === "4", "cart page − works");
  await page.click('.page [data-remove="hope"]');
  check((await count()) === "3" && !(await page.$('.page [data-line="hope"]')), "cart page remove works");
  await page.reload();
  await page.waitForSelector(".line");
  check((await count()) === "3", "cart survives reload");
  await page.click(".page [data-clear]");
  check((await count()) === "0" && (await page.textContent("h1")).includes("empty"), "empty cart button works");
  await page.click(".toast-undo");
  check((await count()) === "3", "undo after emptying the cart");

  // ---- checkout ----
  await page.click('.page a[href="#/checkout"]');
  await page.waitForSelector("#checkout-form");
  await page.click("#checkout-form button[type=submit]");
  check((await page.textContent("#form-error")).length > 0, "checkout validates empty form");
  await page.fill("[name=name]", "Test Buyer");
  await page.fill("[name=email]", "test@example.com");
  await page.fill("[name=address]", "Gedimino pr. 1");
  await page.fill("[name=city]", "Vilnius");
  await page.fill("[name=zip]", "01103");
  await page.click("#checkout-form button[type=submit]");
  await page.waitForSelector("text=Demo order received");
  check((await count()) === "0", "demo order clears the cart");

  await page.goto(BASE + "#/contact");
  await page.waitForSelector("#contact-form");
  await page.click("#contact-form button");
  check((await page.textContent("#contact-error")).length > 0, "contact form validates");

  await page.goto(BASE + "#/product/does-not-exist");
  check((await page.textContent("h1")).includes("not found"), "unknown product shows not-found page");

  if (!BASE.includes("localhost")) {
    const before = errors.length;
    await page.goto(BASE + "some/missing/page");
    await page.waitForSelector("h1");
    errors.length = before; // the 404 response itself is logged as a console error; that is expected here
    check((await page.textContent("h1")).includes("not found"), "404 redirects back into the store");
  }

  // ---- layout ----
  await page.goto(BASE + "#/");
  await page.evaluate(() => localStorage.setItem("liag-cart-v2", JSON.stringify([{ id: "sun", qty: 2 }, { id: "hope", qty: 1 }])));
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const r of ["#/", "#/caps", "#/product/sun", "#/cart", "#/checkout"]) {
      await page.goto(BASE + r);
      await page.reload();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `no horizontal scroll at ${width}px on ${r}`);
    }
  }

  const real = errors.filter((e) => !(BASE.includes("localhost") && /404|ERR_|net::/.test(e)));
  check(real.length === 0, "no console errors" + (real.length ? ": " + real.join(" | ") : ""));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
