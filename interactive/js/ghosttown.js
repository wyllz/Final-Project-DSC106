// Interactive 2 — "Ghost Town": a Philadelphia time machine
(async function () {
  const data = await d3.json("data/philly.json");
  const root = d3.select("#ghosttown");
  const W = 640, H = 580;
  const RADII = [50, 100, 200, 400, 800];
  const CHINATOWN = [-75.1565, 39.9545];

  // ---- projection ----
  const lats = d3.sort(data.map((d) => d.lat)), lons = d3.sort(data.map((d) => d.lon));
  const proj = d3.geoMercator().fitExtent([[16, 16], [W - 16, H - 16]], {
    type: "MultiPoint",
    coordinates: [[d3.quantile(lons, 0.02), d3.quantile(lats, 0.02)], [d3.quantile(lons, 0.98), d3.quantile(lats, 0.98)]],
  });
  data.forEach((d, i) => { d.i = i; [d.x, d.y] = proj([d.lon, d.lat]); d.end = d.open ? 2022.1 : d.last; });
  const ppm = Math.abs(proj([-75.16, 39.95 + 1000 / 110574])[1] - proj([-75.16, 39.95])[1]) / 1000; // pixels per metre
  const metres = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 110574);
  const overlap = (a, b) => a.first <= b.end && b.first <= a.end;

  // ---- state ----
  let year = 2022, radius = 200, cuisine = "All", showGhosts = true, selected = null, k = 1;

  // ---- controls ----
  const ctl = root.select(".controls");
  const playBtn = ctl.append("button").attr("class", "btn").text("▶ Play 2006 → 2022");
  const yearLbl = ctl.append("label").attr("class", "ctl").html("Year ");
  const yearIn = yearLbl.append("input").attr("type", "range").attr("min", 2006).attr("max", 2022).attr("step", 0.25).attr("value", year);
  const yearOut = yearLbl.append("b").text(year);
  const radLbl = ctl.append("label").attr("class", "ctl").html("Rival radius ");
  const radIn = radLbl.append("input").attr("type", "range").attr("min", 0).attr("max", RADII.length - 1).attr("step", 1).attr("value", 2);
  const radOut = radLbl.append("b").text(`${radius} m`);
  const cuisines = d3.sort(d3.rollups(data.filter((d) => d.cuisine), (v) => v.length, (d) => d.cuisine), (a) => -a[1]).map((d) => d[0]);
  const cuiSel = ctl.append("label").attr("class", "ctl").html("Cuisine ").append("select");
  cuiSel.selectAll("option").data(["All", ...cuisines]).join("option").attr("value", (d) => d).text((d) => d);
  const ghostChk = ctl.append("label").attr("class", "ctl");
  const ghostIn = ghostChk.append("input").attr("type", "checkbox").property("checked", true);
  ghostChk.append("span").text("Show ghosts");

  // ---- map ----
  const wrap = root.select(".gt-map");
  const yearBig = wrap.append("div").attr("class", "gt-year").text(year);
  const svg = wrap.append("svg").attr("viewBox", [0, 0, W, H]).attr("role", "img")
    .attr("aria-label", "Map of Philadelphia restaurants; click one to see its rivals and ghosts");
  const zoomG = svg.append("g");
  const ringG = zoomG.append("g"), linkG = zoomG.append("g"), dotG = zoomG.append("g"), glyphG = zoomG.append("g"), selG = zoomG.append("g");
  const stats = wrap.append("div").attr("class", "gt-stats");
  const zbox = wrap.append("div").attr("class", "gt-zoom");

  const rad = () => 2.4 / Math.pow(k, 0.8);
  const zoom = d3.zoom().scaleExtent([1, 60]).translateExtent([[-60, -60], [W + 60, H + 60]])
    .on("zoom", (e) => {
      k = e.transform.k;
      zoomG.attr("transform", e.transform);
      dots.attr("r", rad());
      glyphG.selectAll("g.gh").attr("transform", (d) => `translate(${d.o.x},${d.o.y}) scale(${0.85 / k})`);
      selG.selectAll("circle").attr("r", 7 / k);
    });
  svg.call(zoom).on("dblclick.zoom", null);

  const dots = dotG.selectAll("circle").data(data).join("circle")
    .attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", rad()).attr("vector-effect", "non-scaling-stroke")
    .style("cursor", (d) => (d.cuisine ? "pointer" : "default"))
    .on("mousemove", (e, d) => showTip(e, `<b>${d.name}</b><br>${d.cuisine || "Restaurant"}${d.ind ? "" : " · chain"}<br>
        <span class="t-sub">${spanText(d)}</span>${d.cuisine ? '<br><span class="t-sub">Click to see its rivals</span>' : ""}`))
    .on("mouseleave", hideTip)
    .on("click", (e, d) => { if (d.cuisine) select(d); });

  function state(d) {
    if (d.first > year) return "future";
    if (!d.open && d.last < year) return "ghost";
    return "alive";
  }

  function paint() {
    let alive = 0, ghosts = 0;
    dots.each(function (d) {
      const s = state(d), match = cuisine === "All" || d.cuisine === cuisine;
      if (match) { if (s === "alive") alive++; else if (s === "ghost") ghosts++; }
      const el = d3.select(this);
      el.attr("display", s === "future" || (s === "ghost" && !showGhosts) ? "none" : null)
        .attr("fill", s === "alive" ? C.blue : "none")
        .attr("stroke", s === "alive" ? C.surface : C.orange)
        .attr("stroke-width", s === "alive" ? 0.6 : 1.1)
        .attr("opacity", match ? (s === "ghost" ? 0.55 : 0.95) : 0.06);
    });
    yearBig.text(yr(year)); yearOut.text(yr(year));
    stats.html(`<b style="color:${C.blue}">${comma(alive)}</b> open in ${yr(year)} · <b style="color:${C.orange}">${comma(ghosts)}</b> ghosts already closed`);
  }

  // ---- selection: ring, links to rivals, ghost glyphs ----
  const panel = root.select(".gt-panel");
  function select(d, fly = false) {
    selected = d;
    const nb = [];
    for (const o of data) {
      if (o === d || o.cuisine !== d.cuisine) continue;
      if (metres(d, o) <= radius) nb.push({ o, real: overlap(d, o) });
    }
    ringG.selectAll("circle").data([d]).join("circle")
      .attr("cx", d.x).attr("cy", d.y).attr("fill", C.blueSoft).attr("fill-opacity", 0.25)
      .attr("stroke", C.ink).attr("stroke-width", 1.2).attr("vector-effect", "non-scaling-stroke")
      .transition().duration(400).attr("r", radius * ppm);
    linkG.selectAll("line").data(nb, (n) => n.o.i).join("line")
      .attr("x1", d.x).attr("y1", d.y).attr("x2", (n) => n.o.x).attr("y2", (n) => n.o.y)
      .attr("stroke", (n) => (n.real ? C.blue : C.orange)).attr("stroke-width", (n) => (n.real ? 2 : 1.4))
      .attr("stroke-dasharray", (n) => (n.real ? null : "4 3")).attr("vector-effect", "non-scaling-stroke").attr("opacity", 0.9);
    glyphG.selectAll("g.gh").data(nb.filter((n) => !n.real), (n) => n.o.i).join(
      (enter) => enter.append("g").attr("class", "gh").each(function () { drawGhost(d3.select(this)); }),
    ).attr("transform", (n) => `translate(${n.o.x},${n.o.y}) scale(${0.85 / k})`).style("pointer-events", "none");
    selG.selectAll("circle").data([d]).join("circle").attr("cx", d.x).attr("cy", d.y).attr("r", 7 / k)
      .attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 2.5).attr("vector-effect", "non-scaling-stroke");

    const real = nb.filter((n) => n.real).length, ghosts = nb.length - real;
    panel.select("h3").text(d.name);
    panel.select(".meta").text(`${d.cuisine} · ${spanText(d)}${d.addr ? " · " + d.addr : ""}`);
    panel.select(".naive .big").text(nb.length);
    panel.select(".naive .lbl").text(`"rivals" within ${radius} m, counting everyone ever listed`);
    panel.select(".real .big").text(real);
    panel.select(".ghosts .big").text(ghosts);
    panel.select(".say").html(nb.length === 0
      ? `No other ${d.cuisine} restaurant has ever been listed within ${radius} m. Try a bigger radius.`
      : ghosts === 0
        ? `Every ${d.cuisine} rival here was open at the same time as ${d.name}. Real competition.`
        : `<b>${ghosts} of ${nb.length}</b> "rivals" were never open at the same time as ${d.name}. They closed before it opened or opened after it was gone.`);
    drawStorefront(d);
    if (fly) flyTo(d, 22);
  }

  // ---- storefront history mini-timeline ----
  function drawStorefront(d) {
    const box = panel.select(".storefront");
    box.selectAll("*").remove();
    const rows = d.site >= 0 ? d3.sort(data.filter((o) => o.site === d.site), (o) => o.first) : [d];
    if (rows.length === 1) {
      box.append("p").attr("class", "note").style("margin", "2px 0 0").text("Only one restaurant has been listed at this address.");
      return;
    }
    const w = 330, rh = 22, lw = 120, h = rows.length * rh + 24;
    const sx = d3.scaleLinear([d3.min(rows, (o) => o.first) - 0.3, 2022.2], [lw, w - 6]);
    const s = box.append("svg").attr("viewBox", [0, 0, w, h]);
    s.append("g").attr("class", "axis").attr("transform", `translate(0,${rows.length * rh + 4})`)
      .call(d3.axisBottom(sx).ticks(4).tickFormat(d3.format("d")).tickSize(0).tickPadding(6))
      .call((g) => g.select(".domain").remove());
    const row = s.selectAll("g.row").data(rows).join("g").attr("class", "row").attr("transform", (o, i) => `translate(0,${i * rh})`);
    row.append("text").attr("x", lw - 6).attr("y", rh / 2 + 4).attr("text-anchor", "end").attr("font-size", 11)
      .attr("font-weight", (o) => (o === d ? 750 : 400)).attr("fill", C.ink)
      .text((o) => (o.name.length > 18 ? o.name.slice(0, 17) + "…" : o.name));
    row.append("rect").attr("x", (o) => sx(o.first)).attr("y", 4).attr("height", rh - 8).attr("rx", 3)
      .attr("width", 0).attr("fill", (o) => (o.open ? C.blue : C.orange))
      .on("mousemove", (e, o) => showTip(e, `<b>${o.name}</b><br><span class="t-sub">${spanText(o)}</span>`)).on("mouseleave", hideTip)
      .transition().delay((o, i) => i * 120).duration(500).attr("width", (o) => Math.max(3, sx(o.end) - sx(o.first)));
    box.append("p").attr("class", "note").style("margin", "4px 0 0")
      .text(`${rows.filter((o) => !o.open).length} of ${rows.length} tenants at this address have closed.`);
  }

  function flyTo(d, scale) {
    svg.transition().duration(1100).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(scale).translate(-d.x, -d.y));
  }

  // ---- buttons on the map ----
  zbox.append("button").attr("class", "btn secondary").text("Chinatown").on("click", () => {
    const [cx, cy] = proj(CHINATOWN); flyTo({ x: cx, y: cy }, 22);
  });
  zbox.append("button").attr("class", "btn secondary").text("Whole city").on("click", () => svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity));
  zbox.append("button").attr("class", "btn orange").text("Surprise me").on("click", () => {
    const pool = data.filter((d) => d.cuisine && d.ind && (cuisine === "All" || d.cuisine === cuisine));
    for (let tries = 0; tries < 400; tries++) {
      const d = pool[Math.floor(Math.random() * pool.length)];
      const ghosts = data.filter((o) => o !== d && o.cuisine === d.cuisine && metres(d, o) <= radius && !overlap(d, o)).length;
      if (ghosts >= 2) { select(d, true); return; }
    }
  });

  // ---- control wiring ----
  let timer = null;
  playBtn.on("click", () => {
    if (timer) { timer.stop(); timer = null; playBtn.text("▶ Play 2006 → 2022"); return; }
    if (year >= 2022) year = 2006;
    playBtn.text("❚❚ Pause");
    timer = d3.interval(() => {
      year = Math.min(2022, year + 0.25); yearIn.property("value", year); paint();
      if (year >= 2022) { timer.stop(); timer = null; playBtn.text("▶ Play 2006 → 2022"); }
    }, 110);
  });
  yearIn.on("input", function () { year = +this.value; paint(); });
  radIn.on("input", function () { radius = RADII[+this.value]; radOut.text(`${radius} m`); if (selected) select(selected); });
  cuiSel.on("change", function () { cuisine = this.value; paint(); });
  ghostIn.on("change", function () { showGhosts = this.checked; paint(); glyphG.attr("display", showGhosts ? null : "none"); });

  // ---- start: the Chinatown Chinese restaurant with the most ghosts nearby ----
  paint();
  const [cx, cy] = proj(CHINATOWN);
  const start = d3.greatest(
    data.filter((d) => d.cuisine === "Chinese" && d.ind && Math.hypot(d.x - cx, d.y - cy) < 300 * ppm),
    (d) => data.filter((o) => o !== d && o.cuisine === "Chinese" && metres(d, o) <= radius && !overlap(d, o)).length,
  );
  if (start) select(start);
  flyTo({ x: cx, y: cy }, 22);
})();
