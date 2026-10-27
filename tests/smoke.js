// Smoke test for the storefront: navigation, product pages, cart, demo checkout.
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

  await page.goto(BASE);
  await page.waitForSelector(".hero");
  check((await page.title()) === "Lithuania is Already Great", "home page loads");

  await page.click("nav >> text=Shop");
  await page.waitForSelector("h1.page-title");
  check((await page.$$(".grid .card")).length === 6, "shop lists 6 caps");

  await page.click(".grid .card >> nth=1");
  await page.waitForSelector("#add-form");
  check((await page.textContent("h1")).includes("Vilnius"), "product page opens");

  await page.click('label.size:has-text("L/XL")');
  await page.fill("input[name=qty]", "2");
  await page.click("text=Add to cart");
  check((await page.textContent("#cart-count")) === "2", "add to cart updates count");

  await page.click("nav >> text=About");
  await page.waitForSelector(".prose");
  check(true, "about page loads");

  await page.click(".cart-link");
  await page.waitForSelector(".line");
  check((await page.textContent(".summary")).includes("48.00"), "cart subtotal is €48.00");
  await page.click('[data-inc="0"]');
  check((await page.textContent("#cart-count")) === "3", "quantity + works");
  check((await page.textContent(".summary")).includes("Free"), "free shipping over €50");
  await page.reload();
  await page.waitForSelector(".line");
  check((await page.textContent("#cart-count")) === "3", "cart survives reload");

  await page.click('a[href="#/checkout"]');
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
  check((await page.textContent("#cart-count")) === "0", "demo order clears the cart");

  await page.goto(BASE + "#/product/does-not-exist");
  check((await page.textContent("h1")).includes("not found"), "unknown product shows not-found page");

  if (!BASE.includes("localhost")) {
    await page.goto(BASE + "some/missing/page");
    await page.waitForSelector("h1");
    check((await page.textContent("h1")).includes("not found"), "404 redirects back into the store");
  }

  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const r of ["#/", "#/shop", "#/product/classic-trispalve", "#/cart"]) {
      await page.goto(BASE + r);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `no horizontal scroll at ${width}px on ${r}`);
    }
  }

  const real = errors.filter((e) => !(BASE.includes("localhost") && e.includes("404")));
  check(real.length === 0, "no console errors" + (real.length ? ": " + real.join(" | ") : ""));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
