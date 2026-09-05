#!/usr/bin/env python3
"""
Grunds — matcha café demo-data transform.

Source: Maven Analytics "Coffee Shop Sales" dataset (Maven Roasters, 149k
transactions, 3 NYC locations, Jan-Jun 2023) - a widely used real-shaped POS
dataset. We take ONE location (a single busy cafe), shift the last 13 weeks to
end on the most recent Saturday, rename items onto a matcha-cafe menu with GBP
pricing, and emit a CSV in the shape of a Square "Item Sales" export.

Planted signals (the narrative arc the game surfaces):
  1. RISER  - Iced Matcha Latte ramps week over week (summer).
  2. FALLER - Miso Banana Loaf decays ~45% over the last 5 weeks.
  3. ATTACH - matcha drinks add a Matcha Cake Slice only ~8% of the time.

Deterministic: seeded RNG. `python3 transform.py` regenerates identically.
"""

import csv
import datetime as dt
import random
from pathlib import Path

import openpyxl

SRC = Path(__file__).parent / "data" / "coffee_shop_sales.xlsx"
OUT = Path(__file__).parent / "out" / "square_item_sales.csv"
LOCATION = "Lower Manhattan"
WEEKS = 13
RNG = random.Random(42)

DATA_END = dt.date(2023, 6, 30)  # a Friday
DATA_START = DATA_END - dt.timedelta(days=WEEKS * 7 - 1)

# Map dataset end onto the most recent Saturday, keeping weekday alignment.
today = dt.date.today()
target_end = today - dt.timedelta(days=(today.weekday() - 5) % 7 or 7)
SHIFT = (target_end - DATA_END).days // 7 * 7
TARGET_START = DATA_START + dt.timedelta(days=SHIFT)

# ---------------------------------------------------------------- menu map
# product_type -> (Item, Category, base GBP price, qty scale)
TYPE_MAP = {
    "Brewed Chai tea": ("Iced Matcha Latte", "Matcha", 4.80, 1.0),
    "Gourmet brewed coffee": ("Filter Coffee", "Coffee", 3.20, 1.0),
    "Organic brewed coffee": ("Filter Coffee", "Coffee", 3.20, 1.0),
    "Drip coffee": ("Filter Coffee", "Coffee", 3.20, 1.0),
    "Premium brewed coffee": ("Filter Coffee", "Coffee", 3.20, 1.0),
    "Brewed Black tea": ("Matcha Latte", "Matcha", 4.50, 1.0),
    "Brewed herbal tea": ("Hojicha Latte", "Tea", 4.30, 0.6),
    "Brewed Green tea": ("Sencha Pot", "Tea", 3.80, 0.8),
    "Hot chocolate": ("Dark Hot Chocolate", "Chocolate", 4.20, 0.5),
    "Drinking Chocolate": ("Dark Hot Chocolate", "Chocolate", 4.20, 0.5),
    "Scone": ("Croissant", "Bakery", 3.40, 1.0),
    "Pastry": ("Miso Banana Loaf", "Bakery", 3.80, 1.0),
    "Biscotti": ("Mochi Donut", "Bakery", 3.60, 1.0),
    "Flavours": ("Add-on (Oat Milk / Extra Shot)", "Add-ons", 0.60, 1.0),
    "Coffee beans": ("Retail Matcha Tin 30g", "Retail", 14.00, 1.0),
    "Green beans": ("Retail Matcha Tin 30g", "Retail", 14.00, 1.0),
    "Loose Tea": ("Retail Sencha 50g", "Retail", 9.00, 1.0),
    "Packaged Chocolate": ("Craft Chocolate Bar", "Retail", 6.50, 1.0),
    "Branded": ("Merch Tote", "Retail", 18.00, 1.0),
    "Housewares": ("Ceramic Mug", "Retail", 16.00, 1.0),
}

# Barista Espresso split by product detail
ESPRESSO_MAP = [
    ("latte", ("Latte", "Coffee", 4.20)),
    ("cappuccino", ("Cappuccino", "Coffee", 4.00)),
    ("shot", ("Espresso", "Coffee", 2.60)),
]
LARGE_UPLIFT = 0.50
CAKE = ("Matcha Cake Slice", "Bakery", 5.00)
ATTACH_P = 0.08
MILK_MOD_P = 0.22
SHOT_MOD_P = 0.04
LATTE_ITEMS = {"Latte", "Cappuccino", "Matcha Latte", "Iced Matcha Latte", "Hojicha Latte"}
MATCHA_ITEMS = {"Matcha Latte", "Iced Matcha Latte"}

HEADERS = ["Date", "Time", "Time Zone", "Category", "Item", "Qty",
           "Price Point Name", "SKU", "Modifiers Applied", "Gross Sales",
           "Discounts", "Net Sales", "Tax", "Transaction ID", "Itemization Type"]


def week_index(date):
    return min((date - TARGET_START).days // 7, WEEKS - 1)


def riser_factor(week):
    return 0.80 + 0.05 * week  # 0.80 -> 1.40 across 13 weeks


def faller_factor(week):
    return 1.0 if week < 8 else max(0.55, 1.0 - 0.09 * (week - 7))


def scaled_qty(qty, scale):
    """Probabilistic integer scaling."""
    whole = int(scale)
    out = qty * whole
    out += sum(1 for _ in range(qty) if RNG.random() < scale - whole)
    return out


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)

    out_rows = []
    matcha_txns = {}  # txn_id -> (date, time) for attach pass
    skipped = 0

    for r in rows:
        d = dict(zip(header, r))
        if d["store_location"] != LOCATION:
            continue
        date = d["transaction_date"].date()
        if not (DATA_START <= date <= DATA_END):
            continue

        when = date + dt.timedelta(days=SHIFT)
        wk = week_index(when)
        ptype = d["product_type"]
        detail = (d["product_detail"] or "").lower()
        qty = d["transaction_qty"] or 1

        if ptype == "Barista Espresso":
            entry = next((v for k, v in ESPRESSO_MAP if k in detail), ESPRESSO_MAP[-1][1])
            item, cat, price = entry
            scale = 1.0
        elif ptype in TYPE_MAP:
            item, cat, price, scale = TYPE_MAP[ptype]
        else:
            skipped += 1
            continue

        pp = "Large" if "lg" in detail else "Regular"
        if pp == "Large" and item in LATTE_ITEMS | {"Espresso", "Filter Coffee"}:
            price += LARGE_UPLIFT

        if item == "Iced Matcha Latte":
            qty = scaled_qty(qty, scale * riser_factor(wk))
        elif item == "Miso Banana Loaf":
            qty = scaled_qty(qty, scale * faller_factor(wk))
        else:
            qty = scaled_qty(qty, scale)
        if qty == 0:
            continue

        mod = ""
        if item in LATTE_ITEMS and RNG.random() < MILK_MOD_P:
            mod = "Oat Milk"
        if item in MATCHA_ITEMS and RNG.random() < SHOT_MOD_P:
            mod = (mod + ", " if mod else "") + "Extra Matcha Shot"

        txn_id = f"sq-demo-{d['transaction_id']}"
        out_rows.append([when.isoformat(), str(d["transaction_time"]), "GMT+01:00",
                         cat, item, qty, pp,
                         f"MM-{item.upper().replace(' ', '-')[:14]}-{pp[:2].upper()}",
                         mod, f"{price * qty:.2f}", "0.00", "", "", txn_id, "Normal"])
        if item in MATCHA_ITEMS:
            matcha_txns[txn_id] = (when, str(d["transaction_time"]))

    # Attach pass: ~ATTACH_P of matcha transactions also bought a cake slice.
    for txn_id, (when, t) in matcha_txns.items():
        if RNG.random() < ATTACH_P:
            out_rows.append([when.isoformat(), t, "GMT+01:00", CAKE[1], CAKE[0], 1,
                             "Regular", "MM-MATCHA-CAKE-S-RE", "",
                             f"{CAKE[2]:.2f}", "0.00", "", "", txn_id, "Normal"])

    # Final money math pass (gross/net/vat) on the just-written raw rows.
    final = []
    for row in out_rows:
        gross = float(row[9])
        vat = round(gross * 20 / 120, 2)
        row[11] = f"{gross - vat:.2f}"
        row[12] = f"{vat:.2f}"
        final.append(row)
    final.sort(key=lambda r: (r[0], r[1], r[13]))

    OUT.parent.mkdir(exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        w.writerows(final)

    # ------------------------------------------------------------ verify
    import collections
    weekly = collections.defaultdict(collections.Counter)
    cake_txns, tot_rev = set(), 0.0
    day_txns = collections.Counter()
    for row in final:
        date = dt.date.fromisoformat(row[0])
        wk = week_index(date)
        qty = int(row[5])
        weekly[wk][row[4]] += qty
        tot_rev += float(row[9])
        day_txns[date] += 1
        if row[4] == CAKE[0]:
            cake_txns.add(row[13])

    print(f"Wrote {len(final):,} rows -> {OUT}")
    print(f"Window: {TARGET_START} -> {target_end}  (skipped types: {skipped})")
    print(f"13-week revenue: GBP {tot_rev:,.0f} | ~{len(day_txns)} trading days")
    print("\nIced Matcha Latte (riser) units/week:",
          [weekly[w].get("Iced Matcha Latte", 0) for w in range(WEEKS)])
    print("Miso Banana Loaf (faller) units/week:",
          [weekly[w].get("Miso Banana Loaf", 0) for w in range(WEEKS)])
    print("Filter Coffee (control) units/week  :",
          [weekly[w].get("Filter Coffee", 0) for w in range(WEEKS)])
    print(f"\nAttach rate (cake | matcha txn): {len(cake_txns)/max(len(matcha_txns),1):.1%} "
          f"({len(cake_txns):,} of {len(matcha_txns):,} matcha transactions)")


if __name__ == "__main__":
    main()
