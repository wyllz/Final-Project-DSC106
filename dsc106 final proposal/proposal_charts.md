# Two's a Crowd? Competition, Clusters, and Cursed Corners

Static visualizations for the DSC 106 final project proposal. All numbers come from the Yelp Open Dataset (business file + review dates, Jan 2022 snapshot).

## Draft writeup (5–10 lines)

Restaurants cluster — Chinatowns, restaurant rows, food streets — yet conventional wisdom says a competitor next door is bad for business. We use 52,268 restaurants from the Yelp Open Dataset to ask how much nearby same-cuisine rivals really hurt an independent restaurant's survival. A naive count suggests a huge effect (about −19 points with 3 rivals within 200 m), but Yelp keeps closed restaurants, so many "rivals" are actually predecessors that failed in the same spot. Counting only rivals operating at the same time, the penalty shrinks to a few points and is concentrated within ~50 m. The most striking signal is a storefront's history: restaurants that move into an address where others already failed are much less likely to last. Our explorable will center on a city map: readers drag a radius slider to change what counts as "nearby," toggle between the naive and time-matched counts to watch the ghosts disappear, filter by cuisine and city, and click any storefront to see its timeline of tenants.

## Chart captions

1. **`figures/1_map_center_city.png` — Center City Philadelphia.** Every independent restaurant listed on Yelp, open (blue) vs. closed (orange). Inside one 200 m ring in Chinatown, 129 restaurants have been listed (87 Chinese), but only 55% are still open, because the cluster mixes real rivals with restaurants that replaced each other.

2. **`figures/2_ghosts_vs_real_rivals.png` — Most of the "crowding penalty" was ghosts.** Survival gap vs. restaurants with no same-cuisine rival within 200 m. Counting every restaurant ever listed (orange), 3 rivals looks like −19 points. Counting only rivals operating on the same date (blue, 2016 cohort), the gap is a few points.

3. **`figures/3_penalty_by_distance.png` — What's left is hyper-local.** The survival gap for having at least one same-cuisine rival, by search radius, for three cohorts (operating Jan 1 of 2014, 2016, 2018). A rival within 50 m costs about 7 points in every cohort; the effect fades to about 1 point at 1.6 km.

4. **`figures/4_cuisine_dumbbell.png` — Which cuisines can share a block?** For the 2016 cohort, survival with no rival vs. 2+ rivals within 200 m. Chinese (80% → 66%) and pizza (77% → 66%) take the biggest hit; seafood shows none; Cajun/Creole does *better* in clusters (59% → 68%).

5. **`figures/5_failed_predecessors.png` — The rival that matters most may be the one that already failed there.** Independent restaurants that opened 2012–2017: 62% are still open at a fresh address vs. 50% after one failed predecessor and 44% after two or more (single-storefront addresses only).

6. **`figures/6_storefront_timeline.png` — One storefront, 7 restaurants.** 4161 Main St, Philadelphia (Manayunk): six restaurants came and went between 2009 and 2018 before the current tenant. This is the "details on demand" view the interactive map will show when a reader clicks a dot.

## Method notes and caveats

- **Independent restaurant:** a business whose name appears fewer than 5 times in the dataset (23,760 with a cuisine tag).
- **Rival:** another restaurant with the same primary cuisine (first match in a fixed list of 18 cuisines).
- **Operating period:** approximated by a business's first and last Yelp review, so opening and closing dates are estimates.
- **Outcome:** Yelp's `is_open` flag in the Jan 2022 snapshot, so survival periods differ by cohort. COVID-era closures are included.
- **Interpretation:** these are correlations, not causal effects. Location quality, rent, and neighborhood change likely drive both clustering and closures.
- **Reproducing:** run `analysis/review_spans.py`, then `analysis/build_rivals.py`, then `analysis/make_charts.py`.
- **Yelp license:** `data/restaurants.csv` contains per-business rows derived from Yelp data. Yelp's terms restrict public redistribution, so keep raw and derived per-business files out of a public repo unless the instructor confirms that's fine.

## Outside-dataset justification (required, 3–4 sentences)

We propose the Yelp Open Dataset (yelp.com/dataset): a real, publicly downloadable dataset of 150,346 businesses (14 columns, including coordinates, category, star rating, and open/closed status) and nearly 7 million dated reviews across 11 North American metro areas. Because it records where every restaurant is and roughly when it operated, it lets us test a common belief — that a competitor next door hurts — and reveal a surprising twist: much of the apparent crowding effect comes from failed predecessors at the same address. Its geographic detail is ideal for an interactive map with distance, cuisine, and city controls. In keeping with Yelp's academic-use terms, we will publish only aggregated results and no review text.
