// Shared tokens and helpers for the interactives.
const C = {
  ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7",
  surface: "#fcfcfb", blue: "#2a78d6", orange: "#eb6834", blueSoft: "#cde2fb",
};

// A little ghost glyph, about 12 x 14 units, centred on (0, 0).
const GHOST_PATH = "M-6,7 L-6,-1 A6,6 0 0 1 6,-1 L6,7 L4,5 L2,7 L0,5 L-2,7 L-4,5 Z";

function drawGhost(g, { fill = "#fff", stroke = C.orange } = {}) {
  g.append("path").attr("d", GHOST_PATH).attr("fill", fill).attr("stroke", stroke)
    .attr("stroke-width", 1.4).attr("stroke-linejoin", "round").attr("vector-effect", "non-scaling-stroke");
  g.append("circle").attr("cx", -2.2).attr("cy", -0.8).attr("r", 1.1).attr("fill", stroke);
  g.append("circle").attr("cx", 2.2).attr("cy", -0.8).attr("r", 1.1).attr("fill", stroke);
  return g;
}

// Inline SVG ghost for HTML text (e.g. "3 ghosts haunt this address").
function ghostIconHTML(size = 18) {
  return `<svg viewBox="-8 -8 16 17" width="${size}" height="${size}" style="display:inline-block;width:${size}px">
    <path d="${GHOST_PATH}" fill="#fff" stroke="${C.orange}" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="-2.2" cy="-0.8" r="1.1" fill="${C.orange}"/><circle cx="2.2" cy="-0.8" r="1.1" fill="${C.orange}"/></svg>`;
}

const tooltip = d3.select("body").append("div").attr("class", "tooltip");
function showTip(event, html) {
  tooltip.html(html).style("opacity", 1);
  const pad = 14, w = tooltip.node().offsetWidth, h = tooltip.node().offsetHeight;
  let x = event.clientX + pad, y = event.clientY + pad;
  if (x + w > window.innerWidth - 8) x = event.clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = event.clientY - h - pad;
  tooltip.style("left", `${x}px`).style("top", `${y}px`);
}
function hideTip() { tooltip.style("opacity", 0); }

const yr = (v) => Math.floor(v);
const pct = d3.format(".0%");
const comma = d3.format(",");
