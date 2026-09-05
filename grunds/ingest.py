"""Grunds — ingest: CSV parser + zone/cohort mapper.

Maps each transaction from out/square_item_sales.csv to
(zone, time, item, cohort) and emits wave schedules for the
Three.js floor. Cohorts by hour-of-day:
  7-9 commuters · 10-14 creatives · 14-18 students
(elders/tourists arrive in the Convex phase).
"""

from __future__ import annotations

import json
import csv
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "out" / "square_item_sales.csv"
OUT_PATH = ROOT / "out" / "wave_schedule.json"

TICK_MIN = 5  # wave resolution

# zone + cohort mapping -------------------------------------------------------

COUNTER_CATEGORIES = {"Coffee", "Tea", "Chocolate", "Softs", "Matcha"}
RETAIL_CATEGORIES = {"Bakery", "Retail"}


def zone_for(category: str) -> str:
    if category in COUNTER_CATEGORIES:
        return "counter"
    if category in RETAIL_CATEGORIES:
        return "retail"
    return "retail"


def cohort_for(dt: datetime) -> str:
    if dt.weekday() >= 5:  # Sat/Sun
        return "tourists" if dt.hour >= 12 else "elders"
    if 7 <= dt.hour < 10:
        return "commuters"
    if 10 <= dt.hour < 14:
        return "creatives"
    if 14 <= dt.hour < 18:
        return "students"
    return "creatives"


def tick_of(dt: datetime) -> int:
    return dt.hour * 60 + (dt.minute // TICK_MIN) * TICK_MIN


# parsing ---------------------------------------------------------------------


def parse_transactions(csv_path: Path = CSV_PATH):
    """Yield (datetime, category, item, qty, net_sales) rows."""
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            dt = datetime.strptime(f"{row['Date']} {row['Time']}", "%Y-%m-%d %H:%M:%S")
            yield dt, row["Category"], row["Item"], int(row["Qty"]), float(row["Net Sales"])


def build_schedule(csv_path: Path = CSV_PATH) -> dict:
    waves: dict[int, dict] = defaultdict(
        lambda: {"spawns": [], "sales": 0.0}
    )
    weekly: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    cake_attach = {"matcha_rows": 0, "with_cake": 0}
    tx_items: dict[str, set] = defaultdict(set)

    for dt, cat, item, qty, sales in parse_transactions(csv_path):
        tick = tick_of(dt)
        waves[tick]["sales"] += sales
        bucket = next(
            (s for s in waves[tick]["spawns"]
             if s["c"] == cohort_for(dt) and s["z"] == zone_for(cat) and s["i"] == item),
            None,
        )
        if bucket is None:
            bucket = {"c": cohort_for(dt), "z": zone_for(cat), "i": item, "q": 0}
            waves[tick]["spawns"].append(bucket)
        bucket["q"] += qty

        week = dt.isocalendar()[1]
        weekly[week][item] += qty
        if "Matcha" in item:
            tx_items[dt.strftime("%Y-%m-%d %H:%M")].add(item)

    # cake attach: transactions that include matcha AND a cake item
    for _, items in tx_items.items():
        if any("Matcha" in i for i in items):
            cake_attach["matcha_rows"] += 1
            if any("Cake" in i for i in items):
                cake_attach["with_cake"] += 1

    def series(substr: str) -> list[tuple[int, int]]:
        return sorted(
            (w, sum(q for item, q in items.items() if substr in item))
            for w, items in weekly.items()
        )

    matcha_weeks = series("Matcha")
    loaf_weeks = series("Loaf")
    loaf_peak = max(loaf_weeks, key=lambda x: x[1])

    signals = {
        "matcha_riser": {"start_wk": matcha_weeks[0], "end_wk": matcha_weeks[-1]},
        "loaf_faller": {"peak_wk": loaf_peak, "end_wk": loaf_weeks[-1]},
        "cake_attach_rate": round(
            cake_attach["with_cake"] / max(cake_attach["matcha_rows"], 1), 3
        ),
    }

    return {
        "meta": {
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "tick_min": TICK_MIN,
            "day_start_min": min(waves),
            "day_end_min": max(waves) + TICK_MIN,
        },
        "signals": signals,
        "waves": [
            {"t": t, "sales": round(w["sales"], 2), "spawns": w["spawns"]}
            for t, w in sorted(waves.items())
        ],
    }


def main() -> dict:
    schedule = build_schedule()
    OUT_PATH.write_text(json.dumps(schedule))
    n_spawns = sum(len(w["spawns"]) for w in schedule["waves"])
    print(
        f"ingest: {len(schedule['waves'])} wave ticks ({schedule['meta']['day_start_min']}"
        f"–{schedule['meta']['day_end_min']} min), {n_spawns} spawn buckets -> {OUT_PATH.name}"
    )
    print(f"ingest: signals {schedule['signals']}")
    return schedule


if __name__ == "__main__":
    main()


