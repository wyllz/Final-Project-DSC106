"""Six static charts for the proposal: "Two's a Crowd?" (Yelp restaurant rivals).

Usage: python3 make_charts.py <data/restaurants.csv> <figures_dir>
"""
import sys, textwrap
import numpy as np, pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Circle
from matplotlib.ticker import FuncFormatter

CSV, OUT = sys.argv[1], sys.argv[2]

# ---- design tokens (light mode) ----
SURFACE = "#fcfcfb"; INK = "#0b0b0b"; INK2 = "#52514e"; MUTED = "#898781"
GRID = "#e1e0d9"; AXIS = "#c3c2b7"
BLUE = "#2a78d6"; ORANGE = "#eb6834"                 # categorical slots 1, 2
RAMP3 = ["#86b6ef", "#2a78d6", "#104281"]            # ordinal blue 250 / 450 / 650
SOURCE = ("Source: Yelp Open Dataset (Jan 2022 snapshot). Independent restaurant = name with <5 locations in the data; "
          "rival = same primary cuisine.")

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 10, "text.color": INK, "axes.labelcolor": INK2,
    "axes.edgecolor": AXIS, "axes.linewidth": 0.8, "xtick.color": MUTED, "ytick.color": MUTED,
    "xtick.labelcolor": INK2, "ytick.labelcolor": INK2,
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.spines.top": False, "axes.spines.right": False,
})

r = pd.read_csv(CSV, parse_dates=["first_review", "last_review"])
ind = r[(~r.chain) & r.cuisine.notna()].copy()                    # independents with a cuisine tag
c16 = ind[ind.rivals_200_2016 >= 0].copy()                        # operating on Jan 1, 2016


def frame(ax, axis="y"):
    ax.spines["left"].set_visible(False)
    ax.tick_params(length=0)
    getattr(ax, f"{axis}axis").grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def titles(fig, title, subtitle, note=SOURCE):
    fig.text(0.06, 0.95, title, fontsize=15, fontweight="bold", color=INK, va="top")
    fig.text(0.06, 0.885, subtitle, fontsize=10.5, color=INK2, va="top", linespacing=1.4)
    fig.text(0.06, 0.012, textwrap.fill(note, 175), fontsize=7.5, color=MUTED, va="bottom", linespacing=1.4)


pct_fmt = FuncFormatter(lambda v, _: f"{v:.0%}")
pts_fmt = FuncFormatter(lambda v, _: f"{v:+.0f} pts".replace("-", "\u2212") if v else "0")
minus = lambda v: f"{v:.0f}".replace("-", "\u2212")


def save(fig, name):
    fig.savefig(f"{OUT}/{name}.png", dpi=200)
    plt.close(fig)


def dot_line(ax, xs, ys, color, label=None, z=3):
    ax.plot(xs, ys, color=color, linewidth=2, zorder=z, label=label)
    ax.scatter(xs, ys, s=55, color=color, edgecolors=SURFACE, linewidths=2, zorder=z + 1)


log = {}

# =====================================================================
# 1. Map: Center City Philadelphia, open vs closed, with a 200 m ring
# =====================================================================
lat0, lon0 = 39.9545, -75.1565                                   # Chinatown, Philadelphia
ph = ind[ind.city == "Philadelphia"].copy()
ph["mx"] = (ph.longitude - lon0) * 111320 * np.cos(np.radians(lat0))
ph["my"] = (ph.latitude - lat0) * 110574
box = ph[(ph.mx.abs() < 1900) & (ph.my.abs() < 1250)]
ring = box[np.hypot(box.mx, box.my) <= 200]
log["ring"] = (len(ring), int((ring.cuisine == "Chinese").sum()), ring.is_open.mean())

fig = plt.figure(figsize=(9, 6.9))
ax = fig.add_axes([0.04, 0.06, 0.92, 0.70])
for is_open, color, label in [(1, BLUE, "Still open"), (0, ORANGE, "Closed")]:
    s = box[box.is_open == is_open]
    ax.scatter(s.mx, s.my, s=20, color=color, edgecolors=SURFACE, linewidths=0.8,
               label=f"{label} ({len(s):,})", zorder=3)
ax.add_patch(Circle((0, 0), 200, fill=False, edgecolor=INK, linewidth=1.4, zorder=4))
ax.annotate(f"Chinatown: {len(ring)} independent restaurants have been\n"
            f"listed inside this 200 m ring, {log['ring'][1]} of them Chinese.\n"
            f"Only {log['ring'][2]:.0%} are still open.",
            xy=(150, 135), xytext=(380, 700), fontsize=9.5, color=INK, linespacing=1.4,
            bbox=dict(boxstyle="square,pad=0.4", fc=SURFACE, ec="none", alpha=0.92),
            arrowprops=dict(arrowstyle="-", color=INK, linewidth=0.8), zorder=6)
ax.plot([-1850, -1350], [-1210, -1210], color=INK, linewidth=1.5, zorder=5)
ax.text(-1600, -1245, "500 m", ha="center", va="top", fontsize=8.5, color=INK2, zorder=5,
        bbox=dict(boxstyle="square,pad=0.15", fc=SURFACE, ec="none"))
ax.set_xlim(-1900, 1900); ax.set_ylim(-1300, 1250); ax.set_aspect("equal"); ax.axis("off")
fig.legend(*ax.get_legend_handles_labels(), loc="upper left", bbox_to_anchor=(0.055, 0.80), ncol=2,
           frameon=False, fontsize=9.5, handletextpad=0.2, columnspacing=1.2)
titles(fig, "Center City Philadelphia: every independent restaurant on Yelp",
       "Each dot is a restaurant, colored by whether it was still open in Jan 2022. Closed restaurants stay in the data,\n"
       "so a dense cluster mixes real rivals with the predecessors they replaced.")
save(fig, "1_map_center_city")

# =====================================================================
# 2. Naive vs time-matched rival counts (200 m)
# =====================================================================
labels = ["0", "1", "2", "3", "4–5", "6–9", "10+"]
edges = [-1, 0, 1, 2, 3, 5, 9, 10_000]
naive = ind.groupby(pd.cut(ind.rivals_200, edges, labels=labels), observed=True).is_open.mean()
match = c16.groupby(pd.cut(c16.rivals_200_2016, edges, labels=labels), observed=True).is_open.mean()
naive_gap, match_gap = (naive - naive.iloc[0]) * 100, (match - match.iloc[0]) * 100
log["naive"], log["match"] = naive_gap.round(1).tolist(), match_gap.round(1).tolist()
xs = np.arange(len(labels))

fig = plt.figure(figsize=(9, 5.8))
ax = fig.add_axes([0.10, 0.18, 0.66, 0.58])
frame(ax)
ax.axhline(0, color=AXIS, linewidth=1, zorder=2)
dot_line(ax, xs, naive_gap, ORANGE, "Every restaurant ever listed")
dot_line(ax, xs, match_gap, BLUE, "Only rivals open at the same time")
ax.text(xs[-1] + 0.2, naive_gap.iloc[-1], "Every restaurant\never listed\n(includes ghosts)",
        va="center", fontsize=9.5, color=INK, linespacing=1.3)
ax.text(xs[-1] + 0.2, match_gap.iloc[-1], "Only rivals open\nat the same time",
        va="center", fontsize=9.5, color=INK, linespacing=1.3)
ax.annotate(f"{minus(naive_gap.iloc[3])} pts", (3, naive_gap.iloc[3]), xytext=(3, naive_gap.iloc[3] - 2.6),
            ha="center", fontsize=9.5, color=INK)
ax.annotate(f"{minus(match_gap.iloc[3])} pts", (3, match_gap.iloc[3]), xytext=(3, match_gap.iloc[3] + 1.6),
            ha="center", fontsize=9.5, color=INK)
ax.set_xticks(xs, labels); ax.set_ylim(-23, 6); ax.yaxis.set_major_formatter(pts_fmt)
ax.set_xlabel("Same-cuisine rivals within 200 m", labelpad=8)
ax.set_ylabel("Survival vs. restaurants with no rival")
ax.legend(loc="lower left", frameon=False, fontsize=9)
titles(fig, "Most of the \"crowding penalty\" was ghosts",
       "Counting every restaurant ever listed, 3 rivals nearby looks like a 19-point survival hit. But many of those\n"
       "\"rivals\" had closed before the restaurant opened. Count only rivals operating at the same time and the penalty\n"
       "shrinks to a few points (the blue line is noisier because fewer restaurants qualify).",
       SOURCE + " Blue: restaurants operating on Jan 1, 2016; outcome = still open in Jan 2022.")
save(fig, "2_ghosts_vs_real_rivals")

# =====================================================================
# 3. Distance: time-matched penalty by radius, three cohorts
# =====================================================================
R = [50, 100, 200, 400, 800, 1600]
fig = plt.figure(figsize=(9, 5.8))
ax = fig.add_axes([0.10, 0.18, 0.70, 0.60])
frame(ax)
ax.axhline(0, color=AXIS, linewidth=1, zorder=2)
log["dist"] = {}
for color, Y in zip(RAMP3, [2014, 2016, 2018]):
    gaps = []
    for k in R:
        c = ind[ind[f"rivals_{k}_{Y}"] >= 0]
        gaps.append((c[c[f"rivals_{k}_{Y}"] >= 1].is_open.mean() - c[c[f"rivals_{k}_{Y}"] == 0].is_open.mean()) * 100)
    log["dist"][Y] = np.round(gaps, 1).tolist()
    dot_line(ax, R, gaps, color, f"Operating Jan 1, {Y}")
ends = sorted(((v[-1], Y) for Y, v in log["dist"].items()), reverse=True)
pos = []
for v, Y in ends:                                     # keep end labels >= 0.45 pts apart
    pos.append(min(v, pos[-1] - 0.45) if pos else v)
    ax.text(1600 * 1.12, pos[-1], f"{Y} cohort", va="center", fontsize=9.5, color=INK2)
ax.set_xscale("log"); ax.set_xticks(R, [f"{k:,} m" for k in R]); ax.minorticks_off()
ax.set_xlim(40, 2000); ax.set_ylim(-10, 2); ax.yaxis.set_major_formatter(pts_fmt)
ax.set_xlabel("Distance used to look for a rival", labelpad=8)
ax.set_ylabel("Survival with 1+ rival vs. none")
ax.legend(loc="lower right", frameon=False, fontsize=9)
titles(fig, "What's left is hyper-local",
       "A same-cuisine rival next door (within 50 m) costs about 7 points of survival in every cohort.\n"
       "Look a few blocks away and the effect fades toward zero.",
       SOURCE + " Rivals counted only if operating on the cohort date; outcome = still open in Jan 2022.")
save(fig, "3_penalty_by_distance")

# =====================================================================
# 4. By cuisine (time-matched, 2016 cohort, 200 m): dumbbell
# =====================================================================
rows = []
for cu, gg in c16.groupby("cuisine"):
    a, b = gg[gg.rivals_200_2016 == 0], gg[gg.rivals_200_2016 >= 2]
    if len(b) >= 25:
        rows.append((cu, a.is_open.mean(), b.is_open.mean(), len(a), len(b)))
d = pd.DataFrame(rows, columns=["cuisine", "alone", "crowded", "na", "nb"])
d["gap"] = d.alone - d.crowded
d = d.sort_values("gap").reset_index(drop=True)
log["cuisine"] = d.round(3).to_dict("records")

fig = plt.figure(figsize=(9, 6.2))
ax = fig.add_axes([0.20, 0.14, 0.72, 0.64])
frame(ax, axis="x")
yy = np.arange(len(d))
ax.hlines(yy, d.crowded, d.alone, color=AXIS, linewidth=2, zorder=2)
ax.scatter(d.alone, yy, s=60, color=BLUE, edgecolors=SURFACE, linewidths=2, zorder=3, label="No rival within 200 m")
ax.scatter(d.crowded, yy, s=60, color=ORANGE, edgecolors=SURFACE, linewidths=2, zorder=3, label="2+ rivals within 200 m")
ax.set_yticks(yy, [f"{c}  (n={a + b:,})" for c, a, b in zip(d.cuisine, d.na, d.nb)], color=INK)
ax.set_xlim(0.5, 0.9); ax.xaxis.set_major_formatter(pct_fmt)
ax.set_xlabel("Share still open in Jan 2022", labelpad=6)
for i in (len(d) - 1, 0):
    row = d.iloc[i]
    lo, hi = sorted([row.alone, row.crowded])
    ax.text(lo - 0.006, i, f"{lo:.0%}", ha="right", va="center", fontsize=9, color=INK)
    ax.text(hi + 0.006, i, f"{hi:.0%}", ha="left", va="center", fontsize=9, color=INK)
ax.legend(loc="lower right", frameon=False, fontsize=9.5)
titles(fig, "Which cuisines can share a block?",
       "Restaurants operating on Jan 1, 2016: share still open six years later with no same-cuisine rival within 200 m\n"
       "vs. two or more rivals operating at the same time. Cuisines with at least 25 crowded restaurants shown.")
save(fig, "4_cuisine_dumbbell")

# =====================================================================
# 5. Failed predecessors at the same storefront
# =====================================================================
ind_all = r[~r.chain]
opened = ind_all[(ind_all.first_review >= "2012-01-01") & (ind_all.first_review <= "2017-12-31")
                 & ~ind_all.multi_tenant_site & ind_all.site.notna()]
pb = opened.groupby(pd.cut(opened.prior_failed, [-1, 0, 1, 99], labels=["None", "1", "2 or more"]),
                    observed=True).is_open.agg(["mean", "size"])
log["predecessors"] = pb.round(3).to_dict()

fig = plt.figure(figsize=(9, 5.8))
ax = fig.add_axes([0.10, 0.16, 0.84, 0.62])
frame(ax)
bx = np.arange(len(pb))
ax.bar(bx, pb["mean"], width=0.55, color=BLUE)
for i, (m, n) in enumerate(zip(pb["mean"], pb["size"])):
    ax.text(i, m + 0.015, f"{m:.0%}", ha="center", fontsize=12, fontweight="bold", color=INK)
ax.set_xticks(bx, [f"{l}\nn={n:,}" for l, n in zip(pb.index, pb["size"])])
ax.set_ylim(0, 0.8); ax.yaxis.set_major_formatter(pct_fmt)
ax.set_xlabel("Restaurants that had already closed at the same address", labelpad=8)
ax.set_ylabel("Share still open in Jan 2022")
titles(fig, "The rival that matters most may be the one that already failed there",
       "Independent restaurants that opened 2012–2017, by how many earlier restaurants had closed at the same\n"
       "street address. Food halls, malls, and multi-storefront addresses are excluded.")
save(fig, "5_failed_predecessors")

# =====================================================================
# 6. One storefront's history (timeline)
# =====================================================================
sites = r[~r.multi_tenant_site & r.site.notna()].groupby("site").agg(n=("name", "size"),
                                                                      closed=("is_open", lambda s: (s == 0).sum()))
site = sites.sort_values(["n", "closed"], ascending=False).index[0]
h = r[r.site == site].sort_values("first_review").reset_index(drop=True)
log["site"] = (site, len(h))

fig = plt.figure(figsize=(9, 5.8))
ax = fig.add_axes([0.30, 0.14, 0.64, 0.64])
frame(ax, axis="x")
for i, row in h.iterrows():
    color = BLUE if row.is_open else ORANGE
    ax.barh(i, (row.last_review - row.first_review).days, left=row.first_review, height=0.55, color=color)
ax.set_yticks(range(len(h)), h.name, color=INK); ax.invert_yaxis()
ax.xaxis_date(); ax.xaxis.set_major_locator(mdates.YearLocator(2)); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
ax.set_xlabel("First to last Yelp review", labelpad=6)
ax.legend(handles=[plt.Rectangle((0, 0), 1, 1, color=ORANGE), plt.Rectangle((0, 0), 1, 1, color=BLUE)],
          labels=["Closed", "Still open"], loc="lower left", frameon=False, fontsize=9.5)
addr = h.address.iloc[0]; city = h.city.iloc[0]
titles(fig, f"One storefront, {len(h)} restaurants",
       f"{addr}, {city}. Each bar runs from a restaurant's first to its last Yelp review. In the interactive\n"
       "version, clicking any dot on the map would show its storefront history like this.")
save(fig, "6_storefront_timeline")

for k, v in log.items():
    print(k, v)
