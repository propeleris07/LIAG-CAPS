# Lithuania is Already Great — Cap Store

A storefront for caps with the slogan **“Lithuania is Already Great”**.

**Live site:** https://propeleris07.github.io/LIAG-CAPS/

> **Status: demo storefront.** Browsing, product pages and the shopping cart work, but checkout is simulated.
> No payments are taken, no orders are stored and nothing ships. See [Going to production](#going-to-production).

## What's inside

Plain HTML, CSS and JavaScript. There are no dependencies and no build step.

```
index.html          Page shell (header, nav, footer)
404.html            Sends unknown URLs back to the store
css/style.css       All styling, mobile-friendly
js/products.js      Product catalogue: names, prices, colours, descriptions
js/app.js           Router (#/shop, #/product/<id>, #/cart, #/checkout), cart, demo checkout
assets/favicon.svg  Lithuanian flag icon
.github/workflows/deploy.yml  Publishes to GitHub Pages on every push to main
```

Pages use hash URLs (for example `#/product/classic-trispalve`), so every page works on GitHub Pages without server rules.
The cart is saved in the visitor's browser (`localStorage`). Cap images are drawn as inline SVG from each product's colours, so there are no image files to manage.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any static file server works.

## Edit products

Open `js/products.js` and change, add or remove entries. Each product has an `id` (used in the URL), `name`, `price` in EUR, `colors` for the drawing, an optional `tag`, a `description` and a `details` list. Shipping rates are at the top of `js/app.js`.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which checks that the site files exist, copies them into `_site` and deploys with GitHub Pages.

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
