#!/usr/bin/env python3
"""Restore Amplop household from Goodbudget CSV using Supabase REST API."""

import csv
import json
import math
import calendar
import os
import re
import ssl
import urllib.error
import urllib.request
from datetime import datetime

URL = "https://vqvknxpbdbqlibzhqutz.supabase.co/rest/v1"
KEY = None
OWNER = "stevenwilson614@gmail.com"
CSV_PATH = os.path.expanduser("~/Downloads/history.csv")

BASE_ENVELOPES = [
    ("Groceries", "Food", 0),
    ("Eating out", "Food", 1),
    ("Steven", "Personal", 2),
    ("Olivia", "Personal", 3),
    ("Private Classes", "Personal", 4),
    ("House Maintenance", "Other", 5),
    ("Rocky", "Other", 6),
    ("Vacation / fun", "Other", 7),
    ("Grab / Gas", "Other", 8),
    ("Giving", "Other", 9),
]

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

SKIP = {"Fill Envelopes", "Fill from Available", "Fill from Unallocated"}


def load_key():
    env_path = os.path.expanduser("~/amplop/.env.local")
    key = None
    with open(env_path) as f:
        for line in f:
            if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                key = line.strip().split("=", 1)[1]
    if not key:
        raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local")
    return key


def req(method, path, body=None, prefer=None, retries=5):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    ctx = ssl.create_default_context()
    last_err = None
    for attempt in range(retries):
        r = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(r, context=ctx, timeout=120) as resp:
                raw = resp.read().decode()
                if not raw:
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            raise RuntimeError(f"{method} {path}: {e.code} {err}") from e
        except OSError as e:
            last_err = e
            if attempt + 1 < retries:
                wait = min(2 ** attempt, 30)
                print(f"  retry {attempt + 1}/{retries - 1} after {wait}s ({e})")
                import time

                time.sleep(wait)
                continue
            raise
    raise last_err


def norm_env(raw: str) -> str:
    t = re.sub(r"\s+", " ", raw.strip())
    if not t:
        return ""
    if ":" in t:
        return t.split(":")[-1].strip()
    return t


def norm_date(raw: str):
    raw = raw.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    try:
        return datetime.fromisoformat(raw).strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_amt(raw: str) -> int:
    cleaned = re.sub(r"[^\d.,-]", "", raw.strip())
    if not cleaned:
        return 0
    neg = cleaned.startswith("-")
    digits = cleaned.replace("-", "").replace(",", "")
    val = int(round(float(digits)))
    return -val if neg else val


def parse_csv(path):
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            date = norm_date(row.get("Date", ""))
            if not date:
                continue
            name = (row.get("Name") or "").strip()
            env_raw = (row.get("Envelope") or "").strip()
            amt = parse_amt(row.get("Amount") or "")
            if name in SKIP:
                continue
            if name == "Income":
                rows.append({"kind": "income", "date": date, "key": "", "name": name, "amt": abs(amt)})
                continue
            key = norm_env(env_raw)
            if amt < 0:
                rows.append({"kind": "expense", "date": date, "key": key, "name": name, "amt": abs(amt)})
            elif amt > 0 and key:
                rows.append({"kind": "transfer", "date": date, "key": key, "name": name, "amt": amt})
    return rows


def pair_transfers(rows):
    transfers = [r for r in rows if r["kind"] == "transfer"]
    used = set()
    pairs = []
    for i, a in enumerate(transfers):
        if i in used:
            continue
        for j in range(i + 1, len(transfers)):
            if j in used:
                continue
            b = transfers[j]
            if a["date"] != b["date"] or a["amt"] != b["amt"]:
                continue
            pairs.append({"date": a["date"], "from": a["key"], "to": b["key"], "amt": a["amt"]})
            used.add(i)
            used.add(j)
            break
    return pairs


def round_budget(n: float) -> int:
    if n <= 0:
        return 0
    if n < 1_000_000:
        return int(math.ceil(n / 10_000) * 10_000)
    return int(math.ceil(n / 100_000) * 100_000)


def compute_monthly_budgets(rows):
    now = datetime.now()
    year = now.year
    month = now.month - 5
    while month <= 0:
        month += 12
        year -= 1
    cutoff = datetime(year, month, 1)
    month_totals = {}
    month_mtd = {}
    current_month = now.strftime("%Y-%m")

    for row in rows:
        if row["kind"] != "expense" or not row["key"]:
            continue
        d = datetime.fromisoformat(row["date"])
        key = row["key"].lower()
        month_key = row["date"][:7]
        if d >= cutoff:
            month_totals.setdefault(key, {})
            month_totals[key][month_key] = month_totals[key].get(month_key, 0) + row["amt"]
        if month_key == current_month:
            month_mtd[key] = month_mtd.get(key, 0) + row["amt"]

    budgets = {}
    day = now.day
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    for key, months in month_totals.items():
        vals = list(months.values())
        avg = sum(vals) / len(vals) if vals else 0
        mtd = month_mtd.get(key, 0)
        projected = round((mtd / day) * days_in_month) if day > 0 else mtd
        budgets[key] = round_budget(max(avg, projected, mtd))
    return budgets


def fetch_all(path):
    rows = []
    offset = 0
    page = 1000
    while True:
        chunk = req("GET", f"{path}&limit={page}&offset={offset}") or []
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return rows


def find_env(envelopes, key):
    q = key.lower()
    for e in envelopes:
        if e["name"].lower() == q:
            return e
    for e in envelopes:
        if norm_env(e["name"]).lower() == q:
            return e
    for e in envelopes:
        n = e["name"].lower()
        if q in n or n in q:
            return e
    for alias, canonical in [("eating out", "eating out"), ("vacation / fun", "vacation / fun"), ("house mainetence", "house maintenance"), ("private classes", "private classes")]:
        if q == alias:
            for e in envelopes:
                if e["name"].lower() == canonical:
                    return e
    return None


def main():
    global KEY
    KEY = load_key()

    owner_rows = req("GET", f"/users?select=id,household_id,email&email=eq.{OWNER}")
    owner = owner_rows[0]
    hh = owner["household_id"]
    uid = owner["id"]
    print(f"Household {hh}")

    cat_ids = {}
    for i, name in enumerate(["Food", "Personal", "Other"]):
        existing = req("GET", f"/categories?select=id&household_id=eq.{hh}&name=eq.{name}&limit=1")
        if existing:
            cat_ids[name] = existing[0]["id"]
        else:
            created = req("POST", "/categories", {"household_id": hh, "name": name, "sort_order": i}, "return=representation")
            cat_ids[name] = created[0]["id"]

    envs = req("GET", f"/envelopes?select=*&household_id=eq.{hh}&trip_id=is.null") or []
    for name, cat, sort in BASE_ENVELOPES:
        hit = find_env(envs, name)
        if not hit:
            created = req(
                "POST",
                "/envelopes",
                {
                    "household_id": hh,
                    "name": name,
                    "category_id": cat_ids[cat],
                    "budget_amount": 0,
                    "budget_currency": "IDR",
                    "sort_order": sort,
                },
                "return=representation",
            )
            envs.append(created[0])
            print(f"Created {name}")
        else:
            req("PATCH", f"/envelopes?id=eq.{hit['id']}", {"category_id": cat_ids[cat], "sort_order": sort})

    def keep_tx(notes: str) -> bool:
        n = notes or ""
        return n.startswith("trip-draw:") or n.startswith("Goodbudget import")

    txs = req("GET", f"/transactions?select=id,notes&household_id=eq.{hh}") or []
    del_ids = [t["id"] for t in txs if not keep_tx(t.get("notes") or "")]
    for i in range(0, len(del_ids), 50):
        chunk = del_ids[i : i + 50]
        ids = ",".join(chunk)
        req("DELETE", f"/transaction_allocations?transaction_id=in.({ids})")
        req("DELETE", f"/transactions?id=in.({ids})")
    print(f"Deleted {len(del_ids)} transactions")

    existing = fetch_all(
        f"/transactions?select=date,merchant_name,amount,notes&household_id=eq.{hh}&notes=like.Goodbudget%20import%25",
    )
    existing_keys = {
        (t["date"], t.get("merchant_name") or "", int(t["amount"]))
        for t in existing
        if (t.get("notes") or "").startswith("Goodbudget import")
    }
    print(f"Already imported: {len(existing_keys)}")

    parsed = parse_csv(CSV_PATH)
    expenses = [r for r in parsed if r["kind"] == "expense"]
    transfers = pair_transfers(parsed)
    print(f"Importing {len(expenses)} expenses, {len(transfers)} transfers")

    imported = skipped = 0
    for row in expenses:
        key = (row["date"], row["name"], row["amt"])
        if key in existing_keys:
            continue
        env = find_env(envs, row["key"])
        if not env:
            skipped += 1
            continue
        tx = req(
            "POST",
            "/transactions",
            {
                "household_id": hh,
                "user_id": uid,
                "tx_type": "expense",
                "amount": row["amt"],
                "currency": "IDR",
                "amount_idr_snapshot": row["amt"],
                "fx_rate_snapshot": 1,
                "date": row["date"],
                "merchant_name": row["name"],
                "notes": f"Goodbudget import {row['date']}",
            },
            "return=representation",
        )[0]
        req(
            "POST",
            "/transaction_allocations",
            {"transaction_id": tx["id"], "envelope_id": env["id"], "amount": row["amt"]},
        )
        existing_keys.add(key)
        imported += 1
        if imported % 250 == 0:
            print(f"  {imported} new expenses...")

    transfer_keys = {
        (t["date"], int(t["amount"]))
        for t in existing
        if (t.get("notes") or "").startswith("Goodbudget import transfer")
    }
    tcount = 0
    for pair in transfers:
        tkey = (pair["date"], pair["amt"])
        if tkey in transfer_keys:
            continue
        fe = find_env(envs, pair["from"])
        te = find_env(envs, pair["to"])
        if not fe or not te:
            skipped += 1
            continue
        tx = req(
            "POST",
            "/transactions",
            {
                "household_id": hh,
                "user_id": uid,
                "tx_type": "transfer",
                "amount": pair["amt"],
                "currency": "IDR",
                "amount_idr_snapshot": pair["amt"],
                "fx_rate_snapshot": 1,
                "date": pair["date"],
                "notes": f"Goodbudget import transfer {pair['date']}",
            },
            "return=representation",
        )[0]
        req(
            "POST",
            "/transaction_allocations",
            [
                {"transaction_id": tx["id"], "envelope_id": fe["id"], "amount": pair["amt"]},
                {"transaction_id": tx["id"], "envelope_id": te["id"], "amount": -pair["amt"]},
            ],
        )
        transfer_keys.add(tkey)
        tcount += 1

    all_txs = fetch_all(
        f"/transactions?select=date,amount,amount_idr_snapshot,allocations:transaction_allocations(envelope_id,amount)&household_id=eq.{hh}",
    )
    spent = {}
    month_spent = {}
    carryover_month = datetime.now().strftime("%Y-%m")
    month_start = f"{carryover_month}-01"
    for t in all_txs:
        total = float(t.get("amount") or 0)
        total_idr = float(t.get("amount_idr_snapshot") or 0)
        if not total:
            continue
        d = t.get("date") or ""
        for a in t.get("allocations") or []:
            idr = round((float(a["amount"]) / total) * total_idr)
            spent[a["envelope_id"]] = spent.get(a["envelope_id"], 0) + idr
            if d >= month_start:
                month_spent[a["envelope_id"]] = month_spent.get(a["envelope_id"], 0) + idr

    csv_budgets = compute_monthly_budgets(parse_csv(CSV_PATH))

    budgets = 0
    for key, remaining in REMAININGS.items():
        env = find_env(envs, key)
        if not env:
            continue
        env_key = norm_env(env["name"]).lower()
        monthly = csv_budgets.get(env_key) or csv_budgets.get(key.lower()) or env.get("budget_amount") or 0
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
        budgets += 1

    env_count = len(req("GET", f"/envelopes?select=id&household_id=eq.{hh}") or [])
    tx_count = len(req("GET", f"/transactions?select=id&household_id=eq.{hh}") or [])
    print(f"\nDone: {imported} expenses, {tcount} transfers, {skipped} skipped")
    print(f"Budgets updated: {budgets}")
    print(f"Totals: {env_count} envelopes, {tx_count} transactions")
    print("Refresh https://stevenwilson614.github.io/amplop/#/envelopes")


if __name__ == "__main__":
    main()
