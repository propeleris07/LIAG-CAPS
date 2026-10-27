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
  check(await page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)), "hero cap photo loads");

  await page.click('[data-swatch="hope"]');
  check((await page.textContent("#hero-name")).includes("Hope"), "hero colour switcher works");

  await page.click("nav >> text=Caps");
  await page.waitForTimeout(600);
  check((await page.$$("#caps .card")).length === 3, "drop shows 3 caps");
  check(await page.evaluate(() => document.getElementById("caps").getBoundingClientRect().top < 200), "Caps link scrolls to the drop");
  check(await page.evaluate(() => [...document.querySelectorAll("#caps img")].every((i) => i.complete && i.naturalWidth > 0)), "product photos load");

  await page.click('[data-buy="sun"]');
  check((await page.textContent("#cart-count")) === "1", "Buy button adds to cart");

  await page.click('#caps .card h3 a[href="#/product/courage"]');
  await page.waitForSelector("#add-form");
  check((await page.textContent("h1")).includes("Courage"), "product page opens");
  await page.fill("input[name=qty]", "2");
  await page.click("#add-form button");
  check((await page.textContent("#cart-count")) === "3", "add to cart with quantity");
  await page.click('.swatch[href="#/product/hope"]');
  await page.waitForFunction(() => document.querySelector("h1").textContent.includes("Hope"));
  check(true, "colour swatch links to the other cap");

  for (const [link, id] of [["About", "about"], ["Our story", "story"], ["Contact", "contact"]]) {
    await page.click(`header nav >> text=${link}`);
    await page.waitForTimeout(600);
    check(await page.evaluate((s) => Math.abs(document.getElementById(s).getBoundingClientRect().top) < 200, id), `${link} link scrolls to its section`);
  }

  await page.click(".cart-link");
  await page.waitForSelector(".line");
  check((await page.textContent(".summary")).includes("€87"), "cart subtotal is €87 (1 Sun, 2 Courage)");
  check(!(await page.textContent(".summary")).includes("Bundle"), "no bundle discount without all three");
  await page.goto(BASE + "#/caps");
  await page.click("[data-bundle]");
  await page.click(".cart-link");
  await page.waitForSelector(".line");
  const summary = await page.textContent(".summary");
  check(summary.includes("€174") && summary.includes("−€12") && summary.includes("€162"), "bundle: 2 Sun, 1 Hope, 3 Courage = €174 − €12 = €162");
  await page.click('[data-dec="2"]');
  check((await page.textContent("#cart-count")) === "5", "quantity − works");
  await page.reload();
  await page.waitForSelector(".line");
  check((await page.textContent("#cart-count")) === "5", "cart survives reload");

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

  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const r of ["#/", "#/caps", "#/product/sun", "#/cart", "#/checkout"]) {
      await page.goto(BASE + r);
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
