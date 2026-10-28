# Lithuania is Already Great — Cap Store

A storefront for caps with the slogan **“Lithuania is Already Great”**.

**Live site:** https://propeleris07.github.io/LIAG-CAPS/

> **Status: demo storefront.** Browsing, product pages and the shopping cart work, but checkout is simulated.
> No payments are taken, no orders are stored and nothing ships. See [Going to production](#going-to-production).

## What's inside

Plain HTML, CSS and JavaScript. There are no dependencies and no build step. The design follows the "Lithuania Is Already Great" layout: hero with colour switcher, "Not again. Already." manifesto, Drop 01 product grid, panel-block banner, How it works, and a contact form.

```
index.html          Page shell (header, nav, footer)
404.html            Sends unknown URLs back to the store
css/style.css       All styling (Anton + Inter fonts from Google Fonts), mobile-friendly
js/products.js      The three caps (Sun, Hope, Courage), prices, stock, bundle price, shipping rates
js/i18n.js          All site text in English and Lithuanian (EN | LT switch in the header)
js/app.js           Router, cart with bundle discount, demo checkout, contact form
assets/img/         Cap photos and panel-block photos
tests/smoke.js      Browser test run against the live site after every deploy
.github/workflows/deploy.yml  Publishes to GitHub Pages on every push to main
```

Pages use hash URLs (`#/caps`, `#/product/sun`, `#/cart`), so everything works on GitHub Pages without server rules. The cart is saved in the visitor's browser (`localStorage`).

**Live drop:** the countdown runs to `SHOP.drop.endsAt` in `js/products.js`; when it reaches zero, buying closes automatically. Each cap has `stock` (caps left) and `stockTotal` (drop size); the stock bars and "Only N left" labels come from those, so update `stock` as you sell. Visitors can hold at most `maxPerOrder` (10) of a cap and never more than what's left.

**Cart:** adding a cap opens a slide-out cart with +/− quantity, typed quantities, remove (with Undo), a free-shipping progress bar and a one-click bundle suggestion. The full cart page is at `#/cart`.

**Languages:** the EN | LT switch in the header changes all text, cap names (Saulė, Viltis, Drąsa), prices and the countdown. The choice is remembered in the visitor's browser; first-time visitors with a Lithuanian browser get Lithuanian. To change wording, edit `js/i18n.js` (the `en` and `lt` blocks have the same keys). The slogan stays in English in both languages.

**Pricing:** €29 per cap. Every complete set of all three colours in the cart is charged €75 (a €12 discount). Shipping is a flat €4.90, free from €50. Change these in `js/products.js`.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Edit products

Open `js/products.js` (Lithuanian names and descriptions are in `js/i18n.js` under `products`). Each cap has an `id` (used in the URL), `name`, `color`, `swatch` colour, `price` in EUR, a full-size `image`, a smaller `thumb` and a `description`. Drop new photos into `assets/img/` and point the entries at them.

## Still to fill in

- **Contact details:** an email address and Instagram handle for the contact section.
- **Contact form delivery:** the form currently only shows a thank-you message. Connect a form service (e.g. Formspree) or a mailto link.
- **Drop size:** the number of caps per colour, if you want to show it.
- **Looping video and founder section** from the design, once you have the video, photo and text.

## Tests

`tests/smoke.js` clicks through the live site in a headless browser: shop, product page, add to cart, quantity changes, cart persistence, demo checkout and mobile layout. It runs automatically after every deploy (the `verify` job). To run it yourself:

```bash
npm install --no-save playwright && npx playwright install chromium
node tests/smoke.js https://propeleris07.github.io/LIAG-CAPS/
```

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which checks that the site files exist, copies them into `_site`, deploys with GitHub Pages, then smoke-tests the live site.

One-time setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Going to production

To take real orders you need, at minimum:

1. **Payments.** A hosted checkout such as Stripe Checkout / Payment Links, Shopify Buy Button, Paysera (popular in Lithuania) or Snipcart. These keep card data off this site entirely. Never put secret API keys in this repository.
2. **Order handling.** Somewhere orders land (the payment provider dashboard, Shopify, or a small backend) plus stock and fulfilment, ideally print-on-demand or a supplier.
3. **Legal pages.** Terms of sale, privacy policy (GDPR), EU 14-day withdrawal right, company details and VAT handling.
4. **Real product photos** to replace the drawn illustrations.
5. Optionally a custom domain (Settings → Pages → Custom domain).

## Keeping secrets out

`.gitignore` excludes `.env` files, keys, credential files and spreadsheets (`*.xlsx`, `*.csv`) so business data and API keys don't get committed by accident.
