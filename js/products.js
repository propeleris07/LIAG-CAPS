// Product catalogue. Edit this file to change caps, prices or descriptions.
window.SHOP = {
  currency: "EUR",
  bundle: { price: 75, label: "All three for €75" },
  // The live drop. The countdown runs until endsAt; after that, buying is closed.
  drop: { name: "Drop 01", endsAt: "2026-11-30T21:59:00Z" },
  maxPerOrder: 10,
  shipping: { flat: 4.9, freeFrom: 50 },
  details: [
    "Raised white embroidery on the front and sides",
    "Flat brim, structured five-panel crown",
    "Adjustable snapback, one size fits most",
    "Limited Drop 01 run"
  ]
};

window.PRODUCTS = [
  {
    id: "sun",
    stock: 38, // caps left in this drop: update to your real numbers
    stockTotal: 50,
    name: "Sun",
    color: "Yellow",
    swatch: "#F5B800",
    price: 29,
    image: "assets/img/cap-sun.jpg",
    thumb: "assets/img/cap-sun-sm.jpg",
    description:
      "Yellow stands for the sun, light and prosperity. Also for sunny days, which in Lithuania means about two of them."
  },
  {
    id: "hope",
    stock: 44, // caps left in this drop: update to your real numbers
    stockTotal: 50,
    name: "Hope",
    color: "Green",
    swatch: "#0B6B3A",
    price: 29,
    image: "assets/img/cap-hope.jpg",
    thumb: "assets/img/cap-hope-sm.jpg",
    description:
      "Green stands for hope, life and the forests. Also for mushroom season and lake weekends."
  },
  {
    id: "courage",
    stock: 27, // caps left in this drop: update to your real numbers
    stockTotal: 50,
    name: "Courage",
    color: "Red",
    swatch: "#C8202F",
    price: 29,
    image: "assets/img/cap-courage.jpg",
    thumb: "assets/img/cap-courage-sm.jpg",
    description:
      "Red stands for courage and the blood shed for freedom. Also for the loudest voice in the arena on game night."
  }
];
