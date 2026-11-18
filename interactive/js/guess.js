// Interactive 1 — "Draw your guess, then bust the ghosts"
(async function () {
  const data = await d3.json("data/guess.json");
  const root = d3.select("#guess");
  const W = 840, H = 430, m = { t: 26, r: 190, b: 62, l: 62 };
  const n = data.labels.length;

  const svg = root.select(".chart").append("svg").attr("viewBox", [0, 0, W, H]);
  const x = d3.scalePoint(data.labels, [m.l, W - m.r]).padding(0.35);
  const y = d3.scaleLinear([0.3, 0.9], [H - m.b, m.t]);
  const xs = data.labels.map((l) => x(l));

  svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat(pct).tickSize(0).tickPadding(8))
    .call((g) => g.select(".domain").remove());
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(10));
  svg.append("text").attr("class", "axis-title").attr("x", (m.l + W - m.r) / 2).attr("y", H - 16)
    .attr("text-anchor", "middle").text("Same-cuisine restaurants within 200 m (one block or two)");
  svg.append("text").attr("class", "axis-title").attr("transform", `translate(16,${(m.t + H - m.b) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").text("Share still open in 2022");

  const line = d3.line().defined((d) => d != null).x((d, i) => xs[i]).y((d) => y(d)).curve(d3.curveLinear);
  const rates = (key) => data[key].map((d) => d.rate);

  // ---- guess state ----
  const guess = new Array(n).fill(null);
  guess[0] = data.naive[0].rate;                       // anchor: everyone gets the first point
  let revealed = false, busted = false;

  const hint = svg.append("g").attr("class", "hint");
  hint.append("rect").attr("x", xs[0] + 18).attr("y", m.t).attr("width", W - m.r - xs[0] - 18)
    .attr("height", H - m.t - m.b).attr("rx", 10).attr("fill", C.blueSoft).attr("opacity", 0.35);
  hint.append("text").attr("x", (xs[0] + W - m.r) / 2 + 10).attr("y", y(0.78)).attr("text-anchor", "middle")
    .attr("fill", C.blue).attr("font-weight", 700).attr("font-size", 16).text("✎  Drag across this area to draw your guess");
  hint.append("text").attr("x", (xs[0] + W - m.r) / 2 + 10).attr("y", y(0.78) + 22).attr("text-anchor", "middle")
    .attr("fill", C.ink2).attr("font-size", 13).text("How many survive as same-cuisine rivals pile up nearby?");

  const fadedNaive = svg.append("path").attr("fill", "none").attr("stroke", C.orange).attr("stroke-width", 2)
    .attr("opacity", 0).attr("stroke-dasharray", "4 4");
  const guessPath = svg.append("path").attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "1 5").attr("stroke-linecap", "round");
  const guessDots = svg.append("g");
  const truthPath = svg.append("path").attr("fill", "none").attr("stroke-width", 3);
  const truthDots = svg.append("g");
  const labels = svg.append("g");
  const bracketG = svg.append("g");
  const ghostLayer = svg.append("g");

  // anchor annotation
  labels.append("text").attr("x", xs[0] + 10).attr("y", y(guess[0]) + 22).attr("font-size", 12.5).attr("fill", C.ink2)
    .text(`${pct(guess[0])} with no rival`);

  function renderGuess() {
    guessPath.attr("d", line(guess));
    guessDots.selectAll("circle").data(guess.map((v, i) => ({ v, i })).filter((d) => d.v != null))
      .join("circle").attr("cx", (d) => xs[d.i]).attr("cy", (d) => y(d.v)).attr("r", 5)
      .attr("fill", C.ink).attr("stroke", C.surface).attr("stroke-width", 2);
    const done = guess.every((v) => v != null);
    revealBtn.property("disabled", !done || revealed);
    if (!revealed) readout.html(done ? "Locked in? Hit <b>Show me the data</b>." : "Keep drawing until every column has a dot.");
  }

  // ---- drawing ----
  let drawing = false, last = null;
  const overlay = svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r)
    .attr("height", H - m.t - m.b).attr("fill", "transparent").style("cursor", "crosshair").style("touch-action", "none");

  function paint(event) {
    const [px, py] = d3.pointer(event, svg.node());
    const i = Math.max(1, d3.minIndex(xs, (v) => Math.abs(v - px)));
    const v = Math.max(0.3, Math.min(0.9, y.invert(py)));
    if (last && last.i !== i) {                       // fill skipped columns when dragging fast
      const [a, b] = last.i < i ? [last, { i, v }] : [{ i, v }, last];
      for (let k = Math.max(1, a.i); k <= b.i; k++) guess[k] = a.v + (b.v - a.v) * (k - a.i) / (b.i - a.i);
    } else guess[i] = v;
    last = { i, v };
    hint.transition().duration(300).attr("opacity", 0).remove();
    renderGuess();
  }
  overlay
    .on("pointerdown", (e) => { if (revealed) return; drawing = true; overlay.node().setPointerCapture(e.pointerId); paint(e); })
    .on("pointermove", (e) => { if (drawing && !revealed) paint(e); })
    .on("pointerup", (e) => { if (drawing && !revealed) paint(e); drawing = false; last = null; })
    .on("pointercancel", () => { drawing = false; last = null; });

  // ---- buttons ----
  const ctrls = root.select(".controls");
  const revealBtn = ctrls.append("button").attr("class", "btn").text("Show me the data").property("disabled", true);
  const ghostBtn = ctrls.append("button").attr("class", "btn orange").text("Bust the ghosts").style("display", "none");
  const resetBtn = ctrls.append("button").attr("class", "btn secondary").text("Start over");
  const readout = root.select(".readout");

  function drawTruth(key, color, animate) {
    const vals = rates(key);
    if (animate) {
      truthPath.attr("d", line(vals)).attr("stroke", color);
      const len = truthPath.node().getTotalLength();
      truthPath.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
        .transition().duration(1400).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0)
        .on("end", () => truthPath.attr("stroke-dasharray", null));
    } else {
      truthPath.transition().delay(500).duration(1300).ease(d3.easeCubicInOut).attr("d", line(vals)).attr("stroke", color);
    }
    truthDots.selectAll("circle").data(vals).join(
      (enter) => enter.append("circle").attr("r", 0).attr("cx", (d, i) => xs[i]).attr("cy", (d) => y(d)),
    ).attr("stroke", C.surface).attr("stroke-width", 2)
      .on("mousemove", (e, d) => {
        const i = vals.indexOf(d), src = data[key][i];
        showTip(e, `<b>${data.labels[i]} rival${data.labels[i] === "1" ? "" : "s"}</b><br>${pct(d)} still open<br><span class="t-sub">${comma(src.n)} restaurants</span>`);
      }).on("mouseleave", hideTip)
      .transition().delay((d, i) => (animate ? i * 180 : 500)).duration(animate ? 300 : 1300)
      .attr("r", 6).attr("fill", color).attr("cy", (d) => y(d));
  }

  // keep "Your guess" at least 16 px from the data line's end label
  function placeYours(value) {
    const yd = y(value) + 4, yg = y(guess[n - 1]) + 4;
    const pos = Math.abs(yg - yd) >= 16 ? yg : yg <= yd ? yd - 16 : yd + 16;
    labels.select(".yours").transition().duration(1300).attr("y", pos);
  }

  function endLabel(text, value, color) {
    labels.selectAll(".end").data([0]).join("text").attr("class", "end")
      .attr("x", xs[n - 1] + 14).attr("font-size", 13).attr("font-weight", 650)
      .transition().duration(1300).attr("y", y(value) + 4).attr("fill", color).text(text);
  }

  // Bracket showing the drop from 0 to 3 rivals, in percentage points
  function drawBracket(vals, color) {
    const bx = xs[3] + 24, y0 = y(vals[0]), y3 = y(vals[3]);
    const drop = Math.round((vals[0] - vals[3]) * 100);
    const g = bracketG.selectAll("g.br").data([0]).join((enter) => {
      const g = enter.append("g").attr("class", "br").attr("opacity", 0);
      g.append("line").attr("class", "ref").attr("stroke", C.muted).attr("stroke-dasharray", "3 3").attr("x1", xs[0]).attr("x2", bx);
      g.append("path").attr("class", "brk").attr("fill", "none").attr("stroke-width", 1.6);
      g.append("text").attr("class", "big").attr("font-size", 13).attr("font-weight", 750);
      g.append("text").attr("class", "small").attr("font-size", 11.5).attr("fill", C.ink2).text("from 0 to 3 rivals");
      return g;
    });
    g.transition().delay(900).duration(400).attr("opacity", 1);
    const top = Math.min(y0, y3);
    g.select(".ref").transition().duration(1200).attr("y1", y0).attr("y2", y0);
    g.select(".brk").attr("stroke", color).transition().duration(1200).attr("d", `M${bx - 6},${y0}H${bx}V${y3}H${bx - 6}`);
    g.select(".big").attr("x", bx + 6).attr("fill", color).text(`−${drop} percentage points`)
      .transition().duration(1200).attr("y", top - 22);
    g.select(".small").attr("x", bx + 6).transition().duration(1200).attr("y", top - 8);
  }

  revealBtn.on("click", () => {
    revealed = true; revealBtn.property("disabled", true);
    overlay.style("cursor", "default");
    drawTruth("naive", C.orange, true);
    endLabel("The raw data", rates("naive")[n - 1], C.orange);
    labels.append("text").attr("class", "yours").attr("x", xs[n - 1] + 14).attr("font-size", 13)
      .attr("fill", C.ink).text("Your guess");
    placeYours(rates("naive")[n - 1]);
    const nv = rates("naive");
    const yours = (guess[0] - guess[3]) * 100, real = (nv[0] - nv[3]) * 100;
    const verdict = Math.abs(yours - real) < 5 ? "Sharp instinct!" : yours < real ? "Worse than you feared." : "Not as bad as you feared.";
    drawBracket(nv, C.orange);
    readout.html(`You drew survival falling from ${pct(guess[0])} to ${pct(guess[3])} with <b>3 rivals</b> nearby: a drop of
      <b>${yours.toFixed(0)} percentage points</b>. The raw data falls from ${pct(nv[0])} to ${pct(nv[3])}:
      <b>${real.toFixed(0)} percentage points</b>. ${verdict}<br>
      <span style="color:${C.ink2}">(A percentage point is just the gap between two percentages: 69% − 50% = 19 points.)
      But wait: Yelp never deletes closed restaurants, so some of those "rivals" are ghosts. See below, then bust them.</span>`);
    setTimeout(() => { ghostBtn.style("display", null); explainer.play(); }, 1500);
  });

  ghostBtn.on("click", () => {
    busted = !busted;
    if (busted) {
      fadedNaive.attr("d", line(rates("naive"))).transition().duration(400).attr("opacity", 0.45);
      releaseGhosts();
      drawTruth("matched", C.blue, false);
      endLabel("Ghosts removed", rates("matched")[n - 1], C.blue);
      placeYours(rates("matched")[n - 1]);
      ghostBtn.text("Bring the ghosts back").attr("class", "btn secondary");
      const mt = rates("matched"), real = (mt[0] - mt[3]) * 100;
      drawBracket(mt, C.blue);
      readout.html(`Count only rivals that were <b>open at the same time</b>, and survival barely moves: ${pct(mt[0])} with no rival,
        ${pct(mt[3])} with 3. That's just <b>${real.toFixed(0)} percentage points</b>, down from 19. Most of the scary drop was
        restaurants <i>replacing</i> each other in the same storefronts, not competing.<br>
        <span style="color:${C.ink2}">Why does the blue line start higher? It follows a different group: the ${comma(data.n_cohort)}
        restaurants open on Jan 1, 2016, checking who was still open in 2022. They had already survived a while, so all their rates run higher.
        Compare the <b>drops</b>, not the heights.</span>`);
    } else {
      fadedNaive.transition().duration(300).attr("opacity", 0);
      drawTruth("naive", C.orange, false);
      endLabel("The raw data", rates("naive")[n - 1], C.orange);
      placeYours(rates("naive")[n - 1]);
      ghostBtn.text("Bust the ghosts").attr("class", "btn orange");
      drawBracket(rates("naive"), C.orange);
      readout.html(`The ghosts are back. Every restaurant ever listed counts as a "rival", even ones that closed years before,
        and the drop is <b>${((rates("naive")[0] - rates("naive")[3]) * 100).toFixed(0)} percentage points</b> again.`);
    }
  });

  function releaseGhosts() {
    rates("naive").forEach((v, i) => {
      if (i === 0) return;
      d3.range(3).forEach((k) => {
        const x0 = xs[i] + (k - 1) * 12, y0 = y(v);
        const g = ghostLayer.append("g").attr("transform", `translate(${x0},${y0}) scale(0.1)`);
        drawGhost(g);
        g.transition().delay(i * 90 + k * 140).duration(250).attr("transform", `translate(${x0},${y0 - 6}) scale(1.6)`)
          .transition().duration(1500).ease(d3.easeCubicOut)
          .attr("transform", `translate(${x0 + (Math.random() - 0.5) * 60},${y0 - 140 - Math.random() * 60}) scale(1.6)`)
          .style("opacity", 0).remove();
      });
    });
  }

  resetBtn.on("click", () => {
    guess.fill(null); guess[0] = data.naive[0].rate;
    revealed = busted = false;
    truthPath.attr("d", null); truthDots.selectAll("*").remove(); fadedNaive.attr("opacity", 0);
    labels.selectAll(".end").remove(); labels.selectAll("text:not(:first-child)").remove();
    ghostBtn.style("display", "none").text("Bust the ghosts").attr("class", "btn orange");
    bracketG.selectAll("*").remove();
    explainer.hide();
    overlay.style("cursor", "crosshair");
    renderGuess();
  });

  // ---- "What's a ghost?" animated explainer ----
  const explainer = (() => {
    const box = root.select(".ghost-explainer");
    const cap = box.select(".gx-caption");
    const GW = 760, GH = 176, gl = 112, gr = 24;
    const gs = box.select(".gx-chart").append("svg").attr("viewBox", [0, 0, GW, GH]);
    const gx = d3.scaleLinear([2009.4, 2023.9], [gl, GW - gr]);
    const shops = [
      { name: "Pho Saigon", first: 2010, last: 2013.4, open: false },
      { name: "Pho King", first: 2014, last: 2017.3, open: false },
      { name: "Pho Real", first: 2018, last: 2022.3, open: true },
    ];
    const rowY = (i) => 38 + i * 38;
    const mid = (d) => gx((d.first + d.last) / 2);
    gs.append("g").attr("class", "axis").attr("transform", `translate(0,${rowY(2) + 22})`)
      .call(d3.axisBottom(gx).ticks(7).tickFormat(d3.format("d")).tickSize(0).tickPadding(6))
      .call((g) => g.select(".domain").remove());
    gs.append("text").attr("x", gl).attr("y", 14).attr("font-size", 12).attr("fill", C.ink2)
      .text("One storefront, three Vietnamese restaurants over the years");
    const band = gs.append("rect").attr("x", gx(2014)).attr("width", gx(2017.3) - gx(2014))
      .attr("y", rowY(0) - 16).attr("height", rowY(2) - rowY(0) + 32).attr("rx", 6).attr("fill", C.blueSoft);
    const arcs = gs.append("g");
    const row = gs.selectAll("g.shop").data(shops).join("g").attr("class", "shop");
    row.append("text").attr("x", gl - 10).attr("y", (d, i) => rowY(i) + 4.5).attr("text-anchor", "end")
      .attr("font-size", 13).attr("font-weight", (d, i) => (i === 1 ? 750 : 400)).attr("fill", C.ink).text((d) => d.name);
    const bars = row.append("rect").attr("x", (d) => gx(d.first)).attr("y", (d, i) => rowY(i) - 9).attr("height", 18).attr("rx", 4);
    const status = row.append("text").attr("y", (d, i) => rowY(i) + 4.5).attr("font-size", 11.5).attr("fill", C.ink2);
    const ghosts = row.filter((d, i) => i !== 1).append("g").each(function () { drawGhost(d3.select(this)); });
    let timers = [];

    function hide() { stop(); box.attr("hidden", true); }
    function stop() { timers.forEach(clearTimeout); timers = []; gs.selectAll("*").interrupt(); }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function play() {
      stop();
      box.attr("hidden", null);
      // reset
      band.attr("opacity", 0);
      arcs.selectAll("*").remove();
      bars.attr("width", 0).attr("opacity", 1).attr("fill", (d) => (d.open ? C.blue : C.orange));
      status.attr("x", (d) => gx(d.last) + 8).attr("opacity", 0).text((d) => (d.open ? "still open" : "closed"));
      ghosts.attr("opacity", 0).attr("transform", (d) => `translate(${mid(d)},${rowY(shops.indexOf(d))}) scale(0.2)`);

      cap.html("Here's one storefront. Three pho shops open there, <b>one after another</b>. Each one moves in after the last one closed.");
      bars.transition("grow").delay((d, i) => 300 + i * 700).duration(600).ease(d3.easeCubicOut)
        .attr("width", (d) => gx(d.last) - gx(d.first));
      status.transition("show").delay((d, i) => 900 + i * 700).duration(300).attr("opacity", 1);

      const finishBars = () => {                     // if the tab was throttled, snap earlier steps to their end state
        bars.interrupt("grow").attr("width", (d) => gx(d.last) - gx(d.first));
        status.interrupt("show").attr("opacity", 1);
      };

      at(3200, () => {
        finishBars();
        cap.html(`Now count Pho King's rivals the naive way: every Vietnamese restaurant ever listed within 200 m.
          Both other shops count, so Pho King has <b class="o">2 "rivals"</b>.`);
        const k = shops[1];
        arcs.selectAll("path").data([shops[0], shops[2]]).join("path")
          .attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 1.6)
          .attr("d", (d) => {
            const x1 = mid(k), y1 = rowY(1), x2 = mid(d), y2 = rowY(shops.indexOf(d));
            return `M${x1},${y1} Q${(x1 + x2) / 2},${y1 - (y2 < y1 ? 4 : -4)} ${x2},${y2}`;
          })
          .each(function () {
            const len = this.getTotalLength();
            d3.select(this).attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
              .transition().duration(700).attr("stroke-dashoffset", 0);
          });
      });

      at(6400, () => {
        finishBars();
        cap.html(`But look at the years. Pho Saigon closed <i>before</i> Pho King opened, and Pho Real opened <i>after</i> it closed.
          They were never open at the same time, so they never competed. They're <b class="o">ghosts</b>.
          Real rivals: <b class="b">0</b>.`);
        band.transition().duration(500).attr("opacity", 0.55);
        arcs.selectAll("path").attr("stroke-dasharray", "4 4").transition().duration(500).attr("stroke", C.orange);
        bars.filter((d, i) => i !== 1).transition("fade").duration(600).attr("opacity", 0.3);
        ghosts.transition().delay(300).duration(500).ease(d3.easeBackOut)
          .attr("opacity", 1).attr("transform", (d) => `translate(${mid(d)},${rowY(shops.indexOf(d))}) scale(1.5)`);
      });

      at(10200, () => {
        cap.html(`Here's the trap: 2 of these 3 shops closed, and each one "had rivals." One busy storefront makes rivals
          look deadly even though nobody here ever competed. Across a whole city, that's what inflates the
          <b class="o">orange line</b>. <b>Bust the ghosts</b> above to remove them.`);
      });
    }

    box.select(".gx-replay").on("click", play);
    return { play, hide };
  })();

  renderGuess();
})();
