import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.16/+esm";
import { newMap, setGroup, attachPopups, LAYER_GROUPS, C } from "./mapcore.js";

const W = (id) => Math.max(320, document.getElementById(id).clientWidth);
const J = (f) => fetch(`data/json/${f}`).then((r) => r.json());
const fmt = (v, d = 0) => (v == null || Number.isNaN(+v)) ? "–" : (+v).toLocaleString("en", { maximumFractionDigits: d });
const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1d1b16";
const plotStyle = { fontFamily: "Mukta, sans-serif", fontSize: "13.5px", color: ink, background: "transparent", overflow: "visible" };

// ------------------------------------------------------------------ KPIs
const kpi = await J("kpi.json");
kpi.pop_ice100_vf_fmt = fmt(kpi.pop_ice100_vf);
document.querySelectorAll("[data-k]").forEach((el) => { const v = kpi[el.dataset.k]; if (v != null) el.textContent = typeof v === "number" ? fmt(v, 1) : v; });
const tiles = [
  [fmt(kpi.dead_2026 + kpi.missing_2026), "dead or missing, 26 Aug 2026 (NDRRMA, as compiled Oct 2026)", C.danger],
  [fmt(kpi.glaciers_nepal), "glaciers in Nepal (RGI 7.0)", C.ice],
  [`${kpi.pdgl_nepal}+${kpi.pdgl_tibet}`, "potentially dangerous lakes in Nepal + in Tibet draining to Nepal", C.danger],
  [`${fmt(kpi.gorge_km)} km`, "of river gorge in Nepal (this study)", C.gorge],
  [fmt(kpi.pop_ice100_vf), "people on valley floors ≤100 km below glacier ice", C.ice],
  [fmt(kpi.places_at_risk), "named settlements in the path of a cascade", C.ink],
];
document.getElementById("kpis").innerHTML = tiles.map(([v, l, c]) => `<div class="kpi" style="--c:${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");

// ------------------------------------------------------------------ story map
const map = newMap("storymap", { cooperative: true });
attachPopups(map);
const NEPAL = { center: [84.15, 28.25], zoom: 6.1 };
const STATES = {
  ice:      { on: ["hillshade", "glaciers", "pdgl", "rivers"], view: NEPAL },
  abroad:   { on: ["hillshade", "glaciers", "pdgl", "rivers"], view: { center: [86.9, 28.05], zoom: 7.7 } },
  gorges:   { on: ["hillshade", "glaciers", "gorges", "rivers"], view: NEPAL },
  corridor: { on: ["hillshade", "glaciers", "gorges", "rivers", "path", "pdgl"], view: { center: [85.33, 28.1], zoom: 9.0 } },
  events:   { on: ["hillshade", "rivers", "events", "path"], view: NEPAL },
  signals:  { on: ["hillshade", "quakes", "events", "path"], view: NEPAL },
  people:   { on: ["hillshade", "exposure", "places", "rivers", "path"], view: { center: [85.4, 27.95], zoom: 7.9 } },
  growth:   { on: ["hillshade", "exposure", "places", "rivers", "path"], view: { center: [85.22, 28.0], zoom: 9.6 } },
};
function apply(step) {
  const s = STATES[step]; if (!s) return;
  for (const g of Object.keys(LAYER_GROUPS)) setGroup(map, g, s.on.includes(g));
  map.flyTo({ ...s.view, duration: 1600, essential: true });
}
map.once("style.load", () => {
  apply("ice");
  const io = new IntersectionObserver((ents) => {
    ents.forEach((e) => { if (e.isIntersecting) {
      document.querySelectorAll(".step").forEach((s) => s.classList.toggle("active", s === e.target));
      apply(e.target.dataset.step);
    } });
  }, { rootMargin: "-45% 0px -45% 0px" });
  document.querySelectorAll(".step").forEach((s) => io.observe(s));
});

// ------------------------------------------------------------------ seismic chart
const seis = await J("seismic_kakani_2026.json");
const sd = seis.t_min.map((t, i) => ({ t, v: Math.max(seis.rel[i], 0.6) }));
const pre = seis.precursor_t_min.map((t, i) => ({ t, v: Math.max(seis.precursor_rel[i], 0.6) }));
document.getElementById("ch-seis").append(Plot.plot({
  style: plotStyle, width: W("ch-seis"), height: 270, marginLeft: 46, y: { type: "log", domain: [0.6, 400], label: "× normal shaking", grid: true, tickFormat: (d) => `×${d}`, ticks: [1, 10, 100] },
  x: { domain: [-25, 150], label: "minutes after the collapse (08:37 NPT)" },
  marks: [
    Plot.areaY(sd, { x: "t", y1: 0.6, y2: "v", fill: C.ink, fillOpacity: 0.07 }),
    Plot.lineY(sd, { x: "t", y: "v", stroke: C.ink, strokeWidth: 1.2 }),
    Plot.lineY(pre.filter((d) => d.t < -10), { x: "t", y: "v", stroke: C.quake, strokeWidth: 1 }),
    Plot.ruleX([0], { stroke: C.ink, strokeOpacity: 0.4 }),
    Plot.text([{ t: -16.8, v: 30 }], { x: "t", y: "v", text: () => "ML 2.5\n−17 min", fill: C.quake, fontSize: 11.5, fontWeight: 700 }),
    Plot.text([{ t: 4, v: 250 }], { x: "t", y: "v", text: () => "collapse ×110", textAnchor: "start", fontSize: 11.5, fontWeight: 700 }),
    Plot.text([{ t: 41.5, v: 60 }], { x: "t", y: "v", text: () => "flood rumble\n~41 min", fontSize: 11.5 }),
    Plot.tip(sd, Plot.pointerX({ x: "t", y: "v", title: (d) => `${d.t.toFixed(1)} min: ×${d.v.toFixed(1)}` })),
  ],
}));

// ------------------------------------------------------------------ arrival chart + profile
const cor = await J("corridor_2026.json");
const pl = cor.places.filter((p) => p.dist_km <= 90).map((p) => ({ ...p,
  name: p.place.replace(" / Rasuwagadhi", "").replace("Gyirong Port", "Rasuwagadhi").replace(" (Bidur)", "") }));
document.getElementById("ch-arrival").append(Plot.plot({
  style: plotStyle, width: W("ch-arrival"), height: 270, marginLeft: 100, x: { domain: [0, 75], label: "minutes after the collapse", grid: true },
  y: { domain: pl.map((d) => d.name), label: null },
  marks: [
    Plot.barX(pl, { y: "name", x1: 0, x2: "arrival_min_at_52ms", fill: C.iceLight, insetTop: 6, insetBottom: 6 }),
    Plot.barX(pl, { y: "name", x1: "arrival_min_at_52ms", x2: "arrival_min_at_20ms", fill: C.ice, insetTop: 6, insetBottom: 6 }),
    Plot.text(pl, { y: "name", x: "arrival_min_at_20ms", text: (d) => `${Math.round(d.arrival_min_at_52ms)}–${Math.round(d.arrival_min_at_20ms)} min`, dx: 6, textAnchor: "start", fontSize: 11.5 }),
    Plot.ruleX([41.5], { stroke: C.ink2 ?? "#55524a", strokeOpacity: 0.6 }),
    Plot.text([{ x: 41.5 }], { x: "x", frameAnchor: "top", text: () => "observed rumble peak", dy: -4, fontSize: 11 }),
  ],
}));
const prof = cor.profile.d.map((d, i) => ({ d, z: cor.profile.z[i] / 1000 }));
const spans = []; let cur = null;
cor.sections.d.forEach((d, i) => { const g = cor.sections.gorge[i];
  if (g && !cur) cur = { a: d - 0.3, b: d + 0.3 }; else if (g) cur.b = d + 0.3; else if (cur) { spans.push(cur); cur = null; } });
if (cur) spans.push(cur);
document.getElementById("ch-profile").append(Plot.plot({
  style: plotStyle, width: W("ch-profile"), height: 300, marginLeft: 46, x: { domain: [0, 90], label: "km downstream of the collapse" },
  y: { domain: [0, 6.2], label: "river-bed elevation (km)", grid: true },
  marks: [
    Plot.rectX(spans, { x1: "a", x2: "b", y1: 0, y2: 6.2, fill: C.gorge, fillOpacity: 0.16 }),
    Plot.lineY(prof, { x: "d", y: "z", stroke: C.ink, strokeWidth: 2 }),
    Plot.dot(pl, { x: "dist_km", y: (d) => d.z_river_m / 1000, fill: C.ink, r: 3.5 }),
    Plot.text(pl, { x: "dist_km", y: (d) => d.z_river_m / 1000, text: "name", dy: -14, fontSize: 11.5, fontWeight: 700 }),
    Plot.text([{ x: 45, y: 5.2 }], { x: "x", y: "y", text: () => "orange = gorge reach (DEM-derived)", fill: C.gorgeDeep, fontSize: 11.5 }),
  ],
}));

// ------------------------------------------------------------------ before / after
const sat = await J("satellite_scenes.json").catch(() => ({}));
const BA = [["lirung_source_rasuwagadhi", "Collapse source and Lende Khola → Rasuwagadhi"], ["syabrubesi_dhunche", "Syabrubesi confluence"],
            ["betrawati_devighat", "Betrawati → Devighat"], ["rasuwagadhi_2025", "Rasuwagadhi GLOF, 8 Jul 2025"],
            ["thame_2024", "Thame GLOF, 16 Aug 2024"], ["melamchi_2021", "Melamchi flood, 15 Jun 2021"]];
document.getElementById("ba-grid").innerHTML = BA.filter(([k]) => sat[k]?.pre && sat[k]?.post).map(([k, title]) => `
  <figure style="margin:0"><div class="ba" style="--x:50%">
    <img src="data/img/satellite/${k}_pre.webp" alt="${title}, before (${sat[k].pre.date})" loading="lazy">
    <img class="after" src="data/img/satellite/${k}_post.webp" alt="${title}, after (${sat[k].post.date})" loading="lazy">
    <div class="handle"></div><span class="tag l">${sat[k].pre.date}</span><span class="tag r">${sat[k].post.date}</span>
    <input type="range" min="0" max="100" value="50" aria-label="Before/after slider: ${title}"></div>
    <figcaption class="cap"><b>${title}</b>. Sentinel-2 L2A true colour; contains modified Copernicus Sentinel data ${sat[k].post.date.slice(0, 4)}.</figcaption></figure>`).join("");
document.querySelectorAll(".ba input").forEach((r) => r.addEventListener("input", (e) => e.target.parentElement.style.setProperty("--x", `${e.target.value}%`)));

// ------------------------------------------------------------------ events
const evs = await J("events_content.json");
document.getElementById("ev-grid").innerHTML = evs.slice().reverse().map((e) => {
  const p = e.photos?.[0];
  const ph = p ? `<div class="ph" style="background-image:url('data/${p.file.replace(/^data\//, "")}')"><span class="credit">${p.author.slice(0, 50)} · ${p.license}</span></div>`
               : (e.satellite?.length ? `<div class="ph" style="background-image:url('data/img/satellite/${e.satellite[0]}_post.webp')"><span class="credit">Copernicus Sentinel-2</span></div>` : "");
  const toll = e.dead + e.missing;
  return `<article class="ev">${ph}<div class="bd"><div class="date">${e.date} · ${e.country}</div><h3>${e.event}</h3>
    <div class="toll">${toll ? fmt(toll) : "no deaths reported"}${toll ? '<span class="note"> dead + missing</span>' : ""}</div>
    <p style="font-size:15px;margin:.4em 0">${e.summary || e.type}</p>
    <span class="badge ${e.seismic_status}">seismic: ${e.seismic_status}</span>
    <p class="note" style="margin-top:8px">${e.seismic_evidence}</p></div></article>`;
}).join("");

// ------------------------------------------------------------------ places table
const places = await J("places_at_risk.json");
const dsel = document.getElementById("f-prov");
[...new Set(places.map((p) => p.district).filter(Boolean))].sort().forEach((d) => dsel.insertAdjacentHTML("beforeend", `<option>${d}</option>`));
let sortK = "risk_tier", sortAsc = true;
function renderTable() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  const fd = dsel.value, ft = document.getElementById("f-tier").value;
  const rows = places.filter((p) => (!q || (p.name || "").toLowerCase().includes(q) || (p.name_ne || "").includes(q) || (p.municipality || "").toLowerCase().includes(q))
    && (!fd || p.district === fd) && (!ft || (p.risk_tier || "").startsWith(ft)))
    .sort((a, b) => { const x = a[sortK], y = b[sortK]; const c = (x ?? 1e12) > (y ?? 1e12) ? 1 : (x ?? 1e12) < (y ?? 1e12) ? -1 : 0; return sortAsc ? c : -c; });
  document.querySelector("#tbl tbody").innerHTML = rows.map((p) => `<tr data-ll="${p.lon},${p.lat}">
    <td><a href="map.html#${p.lon.toFixed(4)},${p.lat.toFixed(4)},12">${p.name}</a> ${p.name_ne ? `<span class="dev note">${p.name_ne}</span>` : ""}<div class="note">${p.municipality || ""}</div></td>
    <td>${p.district || ""}</td><td style="white-space:nowrap"><span class="tier t${(p.risk_tier || "4")[0]}"></span>Tier ${(p.risk_tier || "4")[0]}</td>
    <td class="n">${fmt(p.hand_m, 0)}</td><td class="n">${fmt(p.upstream_pdgl_n)}</td><td class="n">${fmt(p.arrival_min_from_pdgl_10ms)}</td>
    <td class="n">${fmt(p.arrival_min_from_ice_10ms)}</td><td class="n">${fmt(p.valley_floor_pop_1km)}</td></tr>`).join("");
}
["q", "f-prov", "f-tier"].forEach((id) => document.getElementById(id).addEventListener("input", renderTable));
document.querySelectorAll("#tbl th").forEach((th) => th.addEventListener("click", () => { const k = th.dataset.k; sortAsc = sortK === k ? !sortAsc : true; sortK = k; renderTable(); }));
renderTable();

// ------------------------------------------------------------------ municipalities
const mun = await J("municipalities_index.json");
const mx = mun.filter((m) => m.pop_ice100_vf > 50);
document.getElementById("ch-scatter").append(Plot.plot({
  style: plotStyle, width: W("ch-scatter"), height: 380, marginLeft: 50, x: { type: "log", label: "people on valley floors ≤100 km below ice", grid: true, tickFormat: "~s" },
  y: { domain: [0, 1], label: "social vulnerability score (0–1)", grid: true },
  marks: [
    Plot.dot(mx, { x: "pop_ice100_vf", y: "social_vulnerability", r: 4.5, fill: (d) => d.priority === "exposed & more vulnerable" ? C.danger : C.ice,
                    fillOpacity: 0.75, stroke: "#fff", strokeWidth: 0.6, tip: true,
                    title: (d) => `${d.municipality} (${d.district})\nexposed: ${fmt(d.pop_ice100_vf)}\nvulnerability: ${d.social_vulnerability.toFixed(2)}\n>60 min to hospital: ${fmt(d.pct_pop_over_60min_hospital)}%` }),
    Plot.text(mx.filter((d) => ["Pokhara Lekhnath", "Byas", "Beni", "Melamchi", "Shailyashikhar", "Bidur", "JayaPrithivi", "Manthali"].includes(d.municipality)),
              { x: "pop_ice100_vf", y: "social_vulnerability", text: "municipality", dy: -10, fontSize: 12, fontWeight: 600, stroke: "#fbf8f2", strokeWidth: 3, paintOrder: "stroke" }),
  ],
}));
const top = mun.slice().sort((a, b) => b.pop_ice100_vf - a.pop_ice100_vf).slice(0, 14);
document.getElementById("muni-top").innerHTML = `<table class="places"><thead><tr><th>Municipality</th><th>Exposed</th><th>% of pop.</th><th>Vuln.</th><th>Fastest arrival</th></tr></thead><tbody>${
  top.map((m) => `<tr><td>${m.municipality}<div class="note">${m.district}</div></td><td class="n">${fmt(m.pop_ice100_vf)}</td><td class="n">${fmt(m.pct_ice100_vf, 0)}%</td>
  <td class="n">${m.social_vulnerability.toFixed(2)}</td><td class="n">${fmt(m.min_arrival_min_from_ice_10ms)} min</td></tr>`).join("")}</tbody></table>
  <p class="note">Fastest arrival: flood front at 10 m/s from the nearest upstream glacier ice.</p>`;

// ------------------------------------------------------------------ encroachment + climate
const enc = await J("encroachment.json");
const zones = [["Glacier-fed valley floors (<=100 km below ice)", "Glacier-fed floors ≤100 km below ice"],
  ["Trishuli corridor (Rasuwagadhi-Betrawati) - valley floor", "Trishuli corridor"],
  ["Bhotekoshi-Sunkoshi (Kodari-Barabise) - valley floor", "Bhotekoshi–Sunkoshi"], ["Melamchi valley - valley floor", "Melamchi valley"],
  ["All Nepal", "All Nepal"]];
const encRows = zones.flatMap(([z, lab]) => { const r = enc.find((e) => e.zone === z); if (!r) return [];
  return [1975, 1990, 2000, 2010, 2020, 2025].map((y) => ({ zone: lab, year: y, idx: r[`built_ha_${y}`] / r.built_ha_1975 })); });
document.getElementById("ch-enc").append(Plot.plot({
  style: plotStyle, width: W("ch-enc"), height: 270, marginLeft: 40, marginRight: 130, x: { label: null, tickFormat: "d" }, y: { label: "built-up area, 1975 = 1", grid: true },
  color: { domain: zones.map((z) => z[1]), range: [C.ice, C.ink, C.gorge, C.quake, "#b8b3a6"] },
  marks: [Plot.lineY(encRows, { x: "year", y: "idx", stroke: "zone", strokeWidth: 2 }), Plot.dot(encRows, { x: "year", y: "idx", fill: "zone", r: 2.5 }),
          Plot.text(encRows, Plot.selectLast({ x: "year", y: "idx", z: "zone", text: (d) => `${d.zone} ×${d.idx.toFixed(1)}`, dx: 6, textAnchor: "start", fontSize: 10.5 }))],
}));
const cl = await J("climate_source.json");
const crow = cl.year.map((y, i) => ({ year: y, t: cl.jja_tmean[i] })).filter((d) => d.year <= 2026);
document.getElementById("ch-clim").append(Plot.plot({
  style: plotStyle, width: W("ch-clim"), height: 270, marginLeft: 40, x: { tickFormat: "d", label: null }, y: { label: "June–August mean (°C)", grid: true },
  marks: [Plot.lineY(crow, { x: "year", y: "t", stroke: "#b8b3a6", strokeWidth: 1 }),
          Plot.lineY(crow, Plot.windowY({ k: 10, anchor: "end" }, { x: "year", y: "t", stroke: C.danger, strokeWidth: 2.2 })),
          Plot.dot(crow.filter((d) => d.year === 2026), { x: "year", y: "t", fill: C.danger, r: 4 }),
          Plot.text(crow.filter((d) => d.year === 2026), { x: "year", y: "t", text: () => "2026", dy: -10, fontWeight: 700 })],
}));

// ------------------------------------------------------------------ credits
const cr = await J("photo_credits.json");
document.getElementById("credits").innerHTML = cr.map((c) => `${c.title} — ${c.author || "unknown"}, ${c.license} (<a href="${c.source}">source</a>)`).join("<br>");
