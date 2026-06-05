#!/usr/bin/env python3
"""Fix monthly budgets (from Goodbudget CSV) and carryover snapshots (from remainings)."""

import csv
import json
import math
import calendar
import os
import ssl
import urllib.request
from datetime import datetime

URL = "https://vqvknxpbdbqlibzhqutz.supabase.co/rest/v1"
HOUSEHOLD_ID = "5e115301-cbf6-4410-ad54-2dd15390143d"
CSV_PATH = os.path.expanduser(os.environ.get("GOODBUDGET_CSV", "~/Downloads/history.csv"))

REMAININGS = {
    "Groceries": 4293414,
    "Eating Out": 1078590,
    "Steven": 1996513,
    "Olivia": 3844453,
    "Vacation / Fun": 36432461,
    "Grab / Gas": 5497822,
    "Giving": 6799906,
    "Rocky": 1322711,
    "House Mainetence": 2080874,
    "Private classes": 1741052,
}


def load_key():
    env_path = os.path.expanduser("~/amplop/.env.local")
    with open(env_path) as f:
        for line in f:
            if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                return line.strip().split("=", 1)[1]
    raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY")


def req(method, path, body=None):
    key = load_key()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if method == "PATCH":
        headers["Prefer"] = "return=minimal"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, context=ssl.create_default_context(), timeout=120) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else None


def norm_env(raw: str) -> str:
    t = " ".join(raw.strip().split())
    return t.split(":")[-1].strip() if ":" in t else t


def norm_date(raw: str):
    import re
    raw = raw.strip()
    if len(raw) >= 10 and raw[4] == "-":
        return raw
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}" if m else None


def parse_amt(raw: str) -> int:
    import re
    cleaned = re.sub(r"[^\d.,-]", "", raw.strip())
    if not cleaned:
        return 0
    neg = cleaned.startswith("-")
    val = int(round(float(cleaned.replace("-", "").replace(",", ""))))
    return -val if neg else val


def parse_csv(path):
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            date = norm_date(row.get("Date", ""))
            if not date:
                continue
            name = (row.get("Name") or "").strip()
            if name in {"Fill Envelopes", "Fill from Available", "Fill from Unallocated"}:
                continue
            amt = parse_amt(row.get("Amount") or "")
            key = norm_env((row.get("Envelope") or "").strip())
            if amt < 0:
                rows.append({"date": date, "key": key, "amt": abs(amt)})
    return rows


def round_budget(n: float) -> int:
    if n <= 0:
        return 0
    if n < 500_000:
        return int(math.ceil(n / 50_000) * 50_000)
    return int(math.ceil(n / 100_000) * 100_000)


def compute_monthly_budgets(rows):
    now = datetime.now()
    year, month = now.year, now.month - 5
    while month <= 0:
        month += 12
        year -= 1
    cutoff = datetime(year, month, 1)
    month_totals, month_mtd = {}, {}
    current_month = now.strftime("%Y-%m")
    for row in rows:
        d = datetime.fromisoformat(row["date"])
        mk = row["date"][:7]
        if d >= cutoff:
            month_totals.setdefault(row["key"], {})
            month_totals[row["key"]][mk] = month_totals[row["key"]].get(mk, 0) + row["amt"]
        if mk == current_month:
            month_mtd[row["key"]] = month_mtd.get(row["key"], 0) + row["amt"]
    budgets = {}
    day = now.day
    dim = calendar.monthrange(now.year, now.month)[1]
    for key, months in month_totals.items():
        vals = list(months.values())
        avg = sum(vals) / len(vals) if vals else 0
        mtd = month_mtd.get(key, 0)
        projected = round((mtd / day) * dim) if day else mtd
        budgets[key] = round_budget(max(avg, projected, mtd))
    return budgets


def find_env(envelopes, key):
    q = key.lower()
    for e in envelopes:
        if e["name"].lower() == q or norm_env(e["name"]).lower() == q:
            return e
    for e in envelopes:
        n = e["name"].lower()
        if q in n or n in q:
            return e
    aliases = {"house mainetence": "house maintenance", "private classes": "private classes"}
    if q in aliases:
        for e in envelopes:
            if e["name"].lower() == aliases[q]:
                return e
    return None


def fetch_all_txs(hh):
    rows, offset, page = [], 0, 1000
    while True:
        chunk = req(
            "GET",
            f"/transactions?select=date,amount,amount_idr_snapshot,allocations:transaction_allocations(envelope_id,amount)"
            f"&household_id=eq.{hh}&limit={page}&offset={offset}",
        ) or []
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return rows


def main():
    budgets = compute_monthly_budgets(parse_csv(CSV_PATH))
    envs = req("GET", f"/envelopes?select=*&household_id=eq.{HOUSEHOLD_ID}&trip_id=is.null") or []
    txs = fetch_all_txs(HOUSEHOLD_ID)
    carryover_month = datetime.now().strftime("%Y-%m")
    month_start = f"{carryover_month}-01"
    month_spent = {}
    for t in txs:
        if t["date"] < month_start:
            continue
        total = float(t.get("amount") or 0)
        total_idr = float(t.get("amount_idr_snapshot") or 0)
        if not total:
            continue
        for a in t.get("allocations") or []:
            idr = round((float(a["amount"]) / total) * total_idr)
            month_spent[a["envelope_id"]] = month_spent.get(a["envelope_id"], 0) + idr

    print(f"Fixing envelopes for {carryover_month}\n")
    updated = 0
    for key, remaining in REMAININGS.items():
        env = find_env(envs, key)
        if not env:
            print(f"  skip (not found): {key}")
            continue
        monthly = budgets.get(env["name"]) or budgets.get(norm_env(env["name"])) or budgets.get(key) or 0
        ms = month_spent.get(env["id"], 0)
        carryover = remaining + ms - monthly
        req(
            "PATCH",
            f"/envelopes?id=eq.{env['id']}",
            {
                "budget_amount": monthly,
                "budget_currency": "IDR",
                "carryover_idr": carryover,
                "carryover_month": carryover_month,
            },
        )
        updated += 1
        bal = carryover + monthly - ms
        print(f"  {env['name']}: monthly {monthly:,} | balance {bal:,} | month spend {ms:,}")

    print(f"\nUpdated {updated} envelope(s).")


if __name__ == "__main__":
    main()
