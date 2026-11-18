// Interactive 2 — "Would you sign the lease?" A guessing game about cursed storefronts.
(async function () {
  const data = await d3.json("data/lease.json");
  const root = d3.select("#lease");
  const ROUNDS = 5;
  const card = root.select(".lease-card");
  const pips = root.select(".pips");
  const scoreEl = root.select(".score");
  const finale = root.select(".lease-finale");

  let deck, idx, results;
  const bucket = (r) => (r.past.length === 0 ? 0 : r.past.length === 1 ? 1 : 2);

  function newGame() {
    const shuffled = d3.shuffle(data.rounds.slice());
    const fresh = shuffled.filter((r) => r.past.length === 0);
    const haunted = shuffled.filter((r) => r.past.length > 0);
    deck = d3.shuffle([fresh[0], ...haunted.slice(0, ROUNDS - 1)]);
    idx = 0; results = [];
    finale.style("display", "none").selectAll("*").remove();
    card.style("display", null);
    renderRound();
  }

  function renderPips() {
    pips.selectAll(".pip").data(d3.range(ROUNDS)).join("div")
      .attr("class", (i) => "pip" + (i < results.length ? (results[i].correct ? " win" : " lose") : i === idx ? " now" : ""));
    scoreEl.text(`Score: ${results.filter((r) => r.correct).length} / ${results.length}`);
  }

  function renderRound() {
    const r = deck[idx];
    renderPips();
    card.selectAll("*").remove();
    card.append("div").attr("class", "kicker").text(`Round ${idx + 1} of ${ROUNDS} · ${r.city}, ${r.state}`);
    card.append("div").attr("class", "addr").text(r.addr);
    const haunt = card.append("div").attr("class", "haunt");
    if (r.past.length) {
      haunt.html(d3.range(Math.min(r.past.length, 8)).map(() => ghostIconHTML(20)).join("") +
        `<span>${r.past.length} restaurant${r.past.length > 1 ? "s have" : " has"} already died at this address</span>`);
    } else {
      haunt.html(`<span>A fresh storefront: no restaurant has failed here before (that Yelp knows of).</span>`);
    }

    // timeline of tenants
    const rows = [...r.past.map((p) => ({ ...p, past: true })), { name: r.name, first: r.first, last: r.last, open: r.open, past: false }];
    const W = 1000, rh = 30, lw = 250, h = rows.length * rh + 30;
    const x = d3.scaleLinear([Math.min(d3.min(rows, (d) => d.first), r.first - 1) - 0.3, 2022.4], [lw, W - 40]);
    const svg = card.append("svg").attr("viewBox", [0, 0, W, h]).style("margin-top", "6px");
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${rows.length * rh})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat("").tickSize(-rows.length * rh));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${rows.length * rh + 2})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")).tickSize(0).tickPadding(8))
      .call((g) => g.select(".domain").remove());
    const g = svg.selectAll("g.row").data(rows).join("g").attr("class", "row").attr("transform", (d, i) => `translate(0,${i * rh})`);
    g.append("text").attr("x", lw - 10).attr("y", rh / 2 + 4).attr("text-anchor", "end").attr("font-size", 13)
      .attr("font-weight", (d) => (d.past ? 400 : 750)).attr("fill", (d) => (d.past ? C.ink2 : C.ink))
      .text((d) => (d.past ? "" : "NEW: ") + (d.name.length > 22 ? d.name.slice(0, 21) + "…" : d.name));
    g.filter((d) => d.past).append("rect").attr("x", (d) => x(d.first)).attr("y", 6).attr("height", rh - 12).attr("rx", 4)
      .attr("fill", C.orange).attr("width", 0)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.name}</b><br><span class="t-sub">${yr(d.first)} – closed ${yr(d.last)} (${(d.last - d.first).toFixed(1)} yrs)</span>`))
      .on("mouseleave", hideTip)
      .transition().delay((d, i) => i * 250).duration(500).attr("width", (d) => Math.max(4, x(d.last) - x(d.first)));
    const nb = g.filter((d) => !d.past);
    const bar = nb.append("rect").attr("x", x(r.first)).attr("y", 6).attr("height", rh - 12).attr("rx", 4)
      .attr("width", Math.max(6, x(Math.min(r.first + 0.6, 2022)) - x(r.first))).attr("fill", C.blueSoft)
      .attr("stroke", C.blue).attr("stroke-dasharray", "3 3").attr("class", "pulse");
    const qmark = nb.append("text").attr("x", x(Math.min(r.first + 0.6, 2022)) + 8).attr("y", rh / 2 + 5)
      .attr("font-size", 15).attr("font-weight", 800).attr("fill", C.blue).text("?").attr("class", "pulse");

    const PHRASE = { Burgers: "burger joint", Pizza: "pizza place", "Sushi Bars": "sushi bar", Barbeque: "barbecue joint" };
    const cuisine = r.cuisine ? PHRASE[r.cuisine] || `${r.cuisine} restaurant` : "restaurant";
    const article = /^[AEIOU]/i.test(cuisine) ? "an" : "a";
    card.append("div").attr("class", "lease-q")
      .text(`${r.name}, ${article} ${cuisine}, moves in around ${yr(r.first)}. Will it still be open in 2022?`);
    const actions = card.append("div").attr("class", "lease-actions");
    actions.append("button").attr("class", "btn blue").text("It'll survive").on("click", () => answer(true));
    actions.append("button").attr("class", "btn orange").text("It's doomed").on("click", () => answer(false));
    const verdict = card.append("div").attr("class", "verdict");

    function answer(saysSurvive) {
      actions.selectAll("button").property("disabled", true);
      const correct = saysSurvive === !!r.open;
      results.push({ correct, bucket: bucket(r), open: r.open });
      bar.classed("pulse", false).attr("stroke-dasharray", null).attr("stroke", "none")
        .transition().duration(1000).ease(d3.easeCubicOut)
        .attr("fill", r.open ? C.blue : C.orange)
        .attr("width", Math.max(4, x(r.open ? 2022.1 : r.last) - x(r.first)));
      qmark.classed("pulse", false).transition().duration(1000)
        .attr("x", x(r.open ? 2022.1 : r.last) + 8).attr("fill", r.open ? C.blue : C.orange)
        .text(r.open ? "still open" : `closed ${yr(r.last)}`).attr("font-size", 12);
      const rate = data.rates[bucket(r)];
      const who = bucket(r) === 0 ? "at a fresh address" : bucket(r) === 1 ? "after exactly one failed tenant" : "after two or more failed tenants";
      verdict.html(`<span class="${correct ? "hit" : "miss"}">${correct ? "Called it!" : "Nope."}</span>
        ${r.name} ${r.open ? "is still open" : `closed in ${yr(r.last)}`}.
        Across <b>${comma(rate.n)}</b> independent restaurants that opened ${who}, <b>${pct(rate.rate)}</b> survived.`);
      renderPips();
      const next = card.append("div").attr("class", "lease-actions").style("margin-top", "12px");
      next.append("button").attr("class", "btn").text(idx + 1 < ROUNDS ? "Next storefront →" : "See how the street remembers →")
        .on("click", () => { idx++; idx < ROUNDS ? renderRound() : showFinale(); });
    }
  }

  // ---- finale: the real rates, with the player's storefronts dropped on top ----
  function showFinale() {
    renderPips();
    card.style("display", "none");
    finale.style("display", null);
    const score = results.filter((r) => r.correct).length;
    finale.append("h3").style("margin", "0 0 4px").text(`You called ${score} of ${ROUNDS} storefronts.`);
    finale.append("p").attr("class", "sub").text(
      "Here's what all 11,461 independent restaurants that opened in 2012–2017 tell us. Each dot is one of your storefronts: blue if it survived, orange if it closed.");
    const W = 1000, H = 340, m = { t: 30, r: 20, b: 50, l: 56 };
    const svg = finale.append("svg").attr("viewBox", [0, 0, W, H]);
    const labels = ["Fresh address", "1 failed tenant", "2+ failed tenants"];
    const x = d3.scaleBand(labels, [m.l, W - m.r]).padding(0.38);
    const y = d3.scaleLinear([0, 0.8], [H - m.b, m.t]);
    svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(pct).tickSize(0).tickPadding(8)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(10)).call((g) => g.select(".domain").attr("stroke", C.axis));
    svg.selectAll("rect.bar").data(data.rates).join("rect").attr("class", "bar")
      .attr("x", (d, i) => x(labels[i])).attr("width", x.bandwidth()).attr("y", y(0)).attr("height", 0)
      .attr("rx", 4).attr("fill", C.blue).attr("opacity", 0.9)
      .on("mousemove", (e, d) => showTip(e, `<b>${pct(d.rate)}</b> still open<br><span class="t-sub">${comma(d.n)} restaurants</span>`))
      .on("mouseleave", hideTip)
      .transition().delay((d, i) => i * 250).duration(900).ease(d3.easeCubicOut)
      .attr("y", (d) => y(d.rate)).attr("height", (d) => y(0) - y(d.rate));
    svg.selectAll("text.val").data(data.rates).join("text").attr("class", "val")
      .attr("x", (d, i) => x(labels[i]) + x.bandwidth() / 2).attr("y", (d) => y(d.rate) - 10)
      .attr("text-anchor", "middle").attr("font-size", 18).attr("font-weight", 800).attr("fill", C.ink)
      .attr("opacity", 0).text((d) => pct(d.rate)).transition().delay((d, i) => 600 + i * 250).attr("opacity", 1);
    // player's storefronts as dots stacked above the bar label
    const stack = [0, 0, 0], totals = [0, 1, 2].map((b) => results.filter((r) => r.bucket === b).length);
    svg.selectAll("circle.me").data(results).join("circle").attr("class", "me")
      .attr("cx", (d) => x(labels[d.bucket]) + x.bandwidth() / 2 + (stack[d.bucket]++ - (totals[d.bucket] - 1) / 2) * 18)
      .attr("cy", -20).attr("r", 7).attr("fill", (d) => (d.open ? C.blue : C.orange)).attr("stroke", C.surface).attr("stroke-width", 2)
      .transition().delay((d, i) => 1400 + i * 200).duration(700).ease(d3.easeBounceOut)
      .attr("cy", (d) => y(data.rates[d.bucket].rate) - 34);
    finale.append("p").attr("class", "readout").html(
      `Each failed tenant before you knocks roughly <b>6–12 points</b> off a new restaurant's odds. That's a bigger effect than any rival down the block.`);
    finale.append("div").attr("class", "controls").style("margin-top", "12px")
      .append("button").attr("class", "btn").text("Play again").on("click", newGame);
  }

  newGame();
})();
