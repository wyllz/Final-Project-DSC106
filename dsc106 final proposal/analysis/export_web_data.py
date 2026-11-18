"""Export small JSON files for the three D3 interactives.

Usage: python3 export_web_data.py <data/restaurants.csv> <out_dir>

Writes:
  guess.json  survival by # same-cuisine rivals within 200 m, naive vs time-matched
  philly.json every Philadelphia restaurant (location, cuisine, operating span, storefront id)
  lease.json  rounds for the "Would you sign the lease?" game + the real aggregate rates
"""
import sys, json
import numpy as np, pandas as pd

CSV, OUT = sys.argv[1], sys.argv[2]
r = pd.read_csv(CSV, parse_dates=["first_review", "last_review"])
ind = r[(~r.chain) & r.cuisine.notna()]


def year(t):
    """Timestamp -> decimal year, rounded to ~a month."""
    return round(t.year + (t.dayofyear - 1) / 365.25, 2)


# ---------- 1. guess.json ----------
labels = ["0", "1", "2", "3", "4–5", "6–9", "10+"]
edges = [-1, 0, 1, 2, 3, 5, 9, 10_000]
naive = ind.groupby(pd.cut(ind.rivals_200, edges, labels=labels), observed=True).is_open.agg(["mean", "size"])
c16 = ind[ind.rivals_200_2016 >= 0]
match = c16.groupby(pd.cut(c16.rivals_200_2016, edges, labels=labels), observed=True).is_open.agg(["mean", "size"])
guess = {
    "labels": labels,
    "naive": [{"rate": round(m, 4), "n": int(n)} for m, n in zip(naive["mean"], naive["size"])],
    "matched": [{"rate": round(m, 4), "n": int(n)} for m, n in zip(match["mean"], match["size"])],
    "n_restaurants": int(len(ind)), "n_cohort": int(len(c16)),
}

# ---------- 2. philly.json ----------
ph = r[r.city == "Philadelphia"].copy()
sites = {s: i for i, s in enumerate(ph.site.dropna().unique())}
philly = [{
    "name": row.name, "lat": round(row.latitude, 5), "lon": round(row.longitude, 5),
    "cuisine": row.cuisine if isinstance(row.cuisine, str) else None,
    "ind": bool(not row.chain), "open": int(row.is_open),
    "first": year(row.first_review), "last": year(row.last_review),
    "site": sites.get(row.site, -1), "addr": row.address if isinstance(row.address, str) else "",
} for row in ph.itertuples()]

# ---------- 3. lease.json ----------
indall = r[~r.chain]
pool = indall[(indall.first_review >= "2012-01-01") & (indall.first_review <= "2017-12-31")
              & ~indall.multi_tenant_site & indall.site.notna()]
agg = pool.groupby(pd.cut(pool.prior_failed, [-1, 0, 1, 99], labels=["0", "1", "2+"]), observed=True).is_open.agg(["mean", "size"])
by_site = {s: g.sort_values("first_review") for s, g in r[r.site.isin(pool.site)].groupby("site")}
rng = np.random.default_rng(106)
rounds = []
for lo, hi, k in [(0, 0, 40), (1, 1, 60), (2, 99, 60)]:
    cand = pool[pool.prior_failed.between(lo, hi)]
    for row in cand.sample(min(k, len(cand)), random_state=rng.integers(1e9)).itertuples():
        hist = by_site[row.site]
        before = hist[hist.last_review < row.first_review]          # tenants that had already closed
        rounds.append({
            "addr": row.address, "city": row.city, "state": row.state,
            "past": [{"name": h.name, "first": year(h.first_review), "last": year(h.last_review)}
                     for h in before.itertuples()],
            "name": row.name, "cuisine": row.cuisine if isinstance(row.cuisine, str) else None,
            "first": year(row.first_review), "last": year(row.last_review), "open": int(row.is_open),
        })
lease = {
    "rates": [{"label": l, "rate": round(m, 4), "n": int(n)} for l, m, n in zip(agg.index, agg["mean"], agg["size"])],
    "rounds": rounds,
}

for name, obj in [("guess", guess), ("philly", philly), ("lease", lease)]:
    with open(f"{OUT}/{name}.json", "w") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
print("philly", len(philly), "rounds", len(rounds), "rates", lease["rates"])
print("naive", [round(x["rate"], 3) for x in guess["naive"]], "matched", [round(x["rate"], 3) for x in guess["matched"]])
