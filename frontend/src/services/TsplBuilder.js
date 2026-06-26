'use strict';

/**
 * TSPL command builder for TVS LP46 Lite (203 DPI, USB).
 *
 * Label size: 50mm × 30mm (standard jewelry tag)
 * At 203 DPI: 1 mm ≈ 8 dots → 50mm ≈ 400 dots wide, 30mm ≈ 240 dots tall
 *
 * Font reference (built-in TSPL fonts at 203 DPI):
 *   "1" → 8×8 dots/char   "2" → 12×20 dots/char   "3" → 20×32 dots/char
 *   x-mult & y-mult scale width and height respectively.
 *
 * BARCODE syntax: BARCODE x,y,"CODE128",height,human_readable,rotation,narrow,wide,"data"
 *   human_readable: 0=none, 1=below, 2=above
 *   narrow/wide bar widths in dots (2,2 = balanced, readable at 203 DPI)
 */

function safe(str, maxLen) {
  if (!str) return '';
  return String(str).substring(0, maxLen).replace(/"/g, "'");
}

/**
 * Build a 50mm × 30mm jewelry label.
 *
 * @param {object} opts
 * @param {string}  opts.itemName       - Item/design name (≤20 chars)
 * @param {string}  opts.itemNumber     - Item number / SKU (≤16 chars)
 * @param {string}  opts.purity         - Purity string e.g. "22K (916)"
 * @param {number}  opts.grossWeight    - Gross weight in grams
 * @param {number}  opts.netWeight      - Net weight in grams
 * @param {string}  opts.barcode        - Barcode value (Code 128 compatible, ≤20 chars)
 * @param {number} [opts.copies=1]      - Number of label copies to print
 * @returns {string} TSPL command string (ISO-8859-1 safe)
 */
function buildJewelryLabel({ itemName, itemNumber, purity, grossWeight, netWeight, barcode, copies = 1 }) {
  const bc     = safe(barcode || itemNumber, 20);
  const name   = safe(itemName || itemNumber, 24);
  const itmNum = safe(itemNumber, 18);
  const pur    = safe(purity, 14);
  const gw     = grossWeight != null ? Number(grossWeight).toFixed(3) : '0.000';
  const nw     = netWeight   != null ? Number(netWeight).toFixed(3)   : '0.000';

  if (!bc) throw new Error('barcode value is required for TSPL label');

  // y positions (dots): layout fits within 240 dots (30mm)
  //   y=5   → shop name      (font "2", y-mult=2 → 40 dots tall → ends y=45)
  //   y=50  → item name      (font "2", mult 1,1 → 20 dots tall → ends y=70)
  //   y=75  → item number    (→ ends y=95)
  //   y=100 → purity+net wt  (→ ends y=120)
  //   y=122 → gross wt       (→ ends y=142)
  //   y=148 → barcode (h=50) (→ graphic ends y=198, human-readable ~y=202)
  // Total used: ~202 dots < 240 dots ✓

  const cmds = [
    'SIZE 50 mm,30 mm',
    'GAP 2 mm,0',
    'DIRECTION 0',
    'DENSITY 8',
    'SPEED 4',
    'CLS',
    `TEXT 5,5,"2",0,1,2,"SRI VAISHNAVI JEWELLERS"`,
    `TEXT 5,50,"2",0,1,1,"${name}"`,
    `TEXT 5,75,"2",0,1,1,"${itmNum}"`,
    `TEXT 5,100,"2",0,1,1,"${pur}  Net:${nw}g"`,
    `TEXT 5,122,"2",0,1,1,"Gross:${gw}g"`,
    `BARCODE 5,148,"128",50,1,0,2,2,"${bc}"`,
    `PRINT ${copies},1`,
    '',
  ];

  return cmds.join('\r\n');
}

module.exports = { buildJewelryLabel };
