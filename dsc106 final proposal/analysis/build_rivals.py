"""Build per-restaurant rival counts and storefront history from the Yelp data.

Usage:
  python3 build_rivals.py <yelp_academic_dataset_business.json> <business_review_spans.csv> <out_dir>

Outputs <out_dir>/restaurants.csv with one row per restaurant:
  * rivals_<R>          same-cuisine restaurants within R metres, counting EVERY restaurant ever
                        listed (the naive count -- includes closed predecessors, i.e. "ghosts")
  * rivals_<R>_<Y>      same-cuisine rivals within R metres that were operating on Jan 1 of year Y,
                        for restaurants that were themselves operating then (-1 otherwise)
  * prior_failed        earlier restaurants at the same street address whose last review came
                        before this restaurant's first review
  * multi_tenant_site   True if two restaurants at this address overlapped for >90 days
                        (food halls, malls, multi-storefront buildings)
"Operating" is approximated by the span between a business's first and last Yelp review.
An independent = a name that appears fewer than 5 times in the whole dataset.
"""
import sys, re, collections, datetime
import numpy as np, pandas as pd

BIZ, SPANS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
RADII = [50, 100, 200, 400, 800, 1600]
COHORTS = [2014, 2016, 2018]
# Priority order: first match becomes the restaurant's primary cuisine.
CUISINES = ["Mexican", "Chinese", "Italian", "Japanese", "Thai", "Indian", "Vietnamese",
            "Pizza", "Burgers", "Sushi Bars", "Korean", "Mediterranean", "Seafood",
            "Barbeque", "Cajun/Creole", "Greek", "Middle Eastern", "Ethiopian"]

df = pd.read_json(BIZ, lines=True)
df["cats"] = df.categories.fillna("")
name_counts = df.name.value_counts()
r = df[df.cats.str.contains("Restaurants")].reset_index(drop=True)
r["chain"] = r.name.map(name_counts) >= 5
r["cuisine"] = r.cats.map(lambda c: next((x for x in CUISINES if x in c), None))

spans = pd.read_csv(SPANS, parse_dates=["first_review", "last_review"])
r = r.merge(spans, on="business_id", how="left")
first = r.first_review.map(lambda t: t.toordinal()).values
last = r.last_review.map(lambda t: t.toordinal()).values

lat = np.radians(r.latitude.values); lon = np.radians(r.longitude.values)
x = 6371000 * lon * np.cos(lat); y = 6371000 * lat          # local equirectangular metres
cu = pd.factorize(r.cuisine)[0]                               # -1 = no cuisine tag


def rival_counts(R, active):
    """Same-cuisine restaurants within R metres, among rows where `active` is True."""
    cx = np.floor(x / R).astype(np.int64); cy = np.floor(y / R).astype(np.int64)
    cells = collections.defaultdict(list)
    for i in np.where(active)[0]:
        cells[(cx[i], cy[i])].append(i)
    cells = {k: np.array(v) for k, v in cells.items()}
    out = np.full(len(r), -1)
    for (a, b), members in cells.items():
        cand = np.concatenate([cells[(a + dx, b + dy)] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                               if (a + dx, b + dy) in cells])
        d2 = (x[members, None] - x[None, cand]) ** 2 + (y[members, None] - y[None, cand]) ** 2
        ok = (d2 <= R * R) & (members[:, None] != cand[None, :]) \
             & (cu[members][:, None] == cu[cand][None, :]) & (cu[members][:, None] >= 0)
        out[members] = ok.sum(1)
    return out


everyone = np.ones(len(r), bool)
for R in RADII:
    r[f"rivals_{R}"] = rival_counts(R, everyone)
    for Y in COHORTS:
        t = datetime.date(Y, 1, 1).toordinal()
        r[f"rivals_{R}_{Y}"] = rival_counts(R, (first <= t) & (last >= t))

# ---- storefront history ----
def norm_address(a):
    a = re.sub(r"\b(ste|suite|unit|apt|#)\s*\S+", "", str(a).lower())
    return re.sub(r"[.,]", "", a).strip()

r["site"] = r.address.map(norm_address) + "|" + r.postal_code.astype(str)
r.loc[r.address.fillna("").str.len() < 4, "site"] = None
r["prior_failed"] = 0; r["multi_tenant_site"] = False; r["site_n"] = 1
for site, g in r.dropna(subset=["site"]).groupby("site"):
    if len(g) < 2:
        continue
    f, l = first[g.index], last[g.index]
    r.loc[g.index, "prior_failed"] = [int(((l < f[i])).sum()) for i in range(len(g))]
    overlap = np.minimum(l[:, None], l[None, :]) - np.maximum(f[:, None], f[None, :])
    np.fill_diagonal(overlap, -1)
    r.loc[g.index, "multi_tenant_site"] = bool((overlap > 90).any())
    r.loc[g.index, "site_n"] = len(g)

cols = ["business_id", "name", "address", "city", "state", "latitude", "longitude", "stars",
        "review_count", "is_open", "chain", "cuisine", "first_review", "last_review",
        "site", "site_n", "prior_failed", "multi_tenant_site"] + \
       [c for c in r.columns if c.startswith("rivals_")]
r[cols].to_csv(f"{OUT}/restaurants.csv", index=False)
print("wrote", len(r), "restaurants;", int((~r.chain & r.cuisine.notna()).sum()), "independents with a cuisine")
