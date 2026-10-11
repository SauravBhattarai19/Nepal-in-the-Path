// Shared map definition for "Nepal in the Path".
// Sources are PMTiles (range requests) + small GeoJSON; basemap labels from OpenFreeMap (keyless, OSM).
/* global maplibregl, pmtiles */

export const C = {
  paper: "#f3eee4", ink: "#1d1b16", ink2: "#55524a", muted: "#8b877c",
  ice: "#2a78d6", iceLight: "#9ec5f4", gorge: "#eb6834", gorgeDeep: "#b5401a",
  quake: "#4a3aa7", danger: "#d03b3b", water: "#7fa3cc",
};

const base = new URL(".", document.baseURI).href.replace(/\/$/, "");
const tile = (f) => `pmtiles://${base}/data/tiles/${f}`;
const geo = (f) => `${base}/data/geo/${f}`;

let protocolAdded = false;
export function addProtocol() {
  if (protocolAdded) return;
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolAdded = true;
}

function rasterPair(id, overview, z0, z1, shardZ) {
  // one overview file + three regional shards for the most detailed zoom (keeps every file small)
  const s = {};
  s[`${id}_lo`] = { type: "raster", url: tile(overview), tileSize: 256, minzoom: z0, maxzoom: z1 };
  for (const r of ["west", "central", "east"]) {
    s[`${id}_${r}`] = { type: "raster", url: tile(`${id}_z${shardZ}_${r}.pmtiles`), tileSize: 256, minzoom: shardZ, maxzoom: shardZ };
  }
  return s;
}

function rasterLayers(id, opacity, visible) {
  const v = visible ? "visible" : "none";
  const shardZ = id === "hillshade" ? 11 : 12;
  const L = [{ id: `${id}_lo`, type: "raster", source: `${id}_lo`, maxzoom: shardZ, layout: { visibility: v },
               paint: { "raster-opacity": opacity, "raster-fade-duration": 150 } }];
  for (const r of ["west", "central", "east"]) {
    L.push({ id: `${id}_${r}`, type: "raster", source: `${id}_${r}`, minzoom: shardZ, layout: { visibility: v },
             paint: { "raster-opacity": opacity, "raster-fade-duration": 150 } });
  }
  return L;
}

export function buildStyle({ labels = true } = {}) {
  const sources = {
    ...rasterPair("hillshade", "hillshade_z5-10.pmtiles", 5, 10, 11),
    ...rasterPair("population", "population_z6-11.pmtiles", 6, 11, 12),
    ...rasterPair("exposure", "exposure_z7-11.pmtiles", 7, 11, 12),
    cryo: { type: "vector", url: tile("cryosphere.pmtiles") },
    rg: { type: "vector", url: tile("rivers_gorges.pmtiles") },
    muni: { type: "vector", url: tile("municipalities.pmtiles") },
    places: { type: "vector", url: tile("places.pmtiles") },
    nepal: { type: "geojson", data: geo("nepal.geojson") },
    provinces: { type: "geojson", data: geo("provinces.geojson") },
    pdgl: { type: "geojson", data: geo("pdgl.geojson") },
    events: { type: "geojson", data: geo("events.geojson") },
    quakes: { type: "geojson", data: geo("earthquakes.geojson") },
    path: { type: "geojson", data: geo("flood_path_2026.geojson") },
    hydro: { type: "geojson", data: geo("hydropower.geojson") },
  };
  if (labels) sources.ofm = { type: "vector", url: "https://tiles.openfreemap.org/planet" };

  const layers = [
    { id: "bg", type: "background", paint: { "background-color": C.paper } },
    ...rasterLayers("hillshade", 0.62, true),
    ...rasterLayers("population", 0.85, false),
    ...rasterLayers("exposure", 0.9, false),
    { id: "muni-fill", type: "fill", source: "muni", "source-layer": "municipalities", layout: { visibility: "none" },
      paint: { "fill-color": ["interpolate", ["linear"], ["coalesce", ["get", "pop_ice100_vf"], 0],
        0, "rgba(0,0,0,0)", 100, "#cde2fb", 1000, "#86b6ef", 5000, "#3987e5", 15000, "#1c5cab", 30000, "#0d366b"],
        "fill-opacity": 0.75 } },
    { id: "muni-line", type: "line", source: "muni", "source-layer": "municipalities", minzoom: 6.5, layout: { visibility: "none" },
      paint: { "line-color": "#ffffff", "line-width": 0.6, "line-opacity": 0.8 } },
    { id: "nepal-fade", type: "line", source: "nepal", paint: { "line-color": C.ink, "line-width": 1.6 } },
    { id: "provinces", type: "line", source: "provinces", paint: { "line-color": C.ink2, "line-width": 0.6, "line-opacity": 0.5 } },
    { id: "rivers", type: "line", source: "rg", "source-layer": "rivers",
      paint: { "line-color": C.water, "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["interpolate", ["linear"], ["get", "area_km2"], 100, 0.2, 5000, 0.8, 50000, 1.8],
                       11, ["interpolate", ["linear"], ["get", "area_km2"], 100, 0.8, 5000, 2.2, 50000, 4]] } },
    { id: "glaciers", type: "fill", source: "cryo", "source-layer": "glaciers", paint: { "fill-color": C.ice, "fill-opacity": 0.85 } },
    { id: "lakes", type: "fill", source: "cryo", "source-layer": "lakes",
      paint: { "fill-color": ["case", [">", ["coalesce", ["get", "growth_pct"], 0], 20], "#0b5fc2", "#38a0d8"], "fill-outline-color": "#0b4f9e" } },
    { id: "gorges", type: "line", source: "rg", "source-layer": "gorges",
      paint: { "line-color": ["match", ["get", "cls"], "deep gorge", C.gorgeDeep, C.gorge],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "cls"], "deep gorge", 1.8, 1], 11, ["match", ["get", "cls"], "deep gorge", 5, 3]] } },
    { id: "hydro", type: "circle", source: "hydro", layout: { visibility: "none" },
      paint: { "circle-radius": 4, "circle-color": ["case", ["get", "in_gorge"], C.gorgeDeep, "#ffffff"], "circle-stroke-color": C.ink, "circle-stroke-width": 1 } },
    { id: "quakes", type: "circle", source: "quakes", layout: { visibility: "none" },
      paint: { "circle-color": C.quake, "circle-opacity": 0.5, "circle-stroke-color": "#fff", "circle-stroke-width": 0.4,
        "circle-radius": ["interpolate", ["exponential", 1.8], ["get", "m"], 4, 2, 6, 6, 8, 18] } },
    { id: "path-casing", type: "line", source: "path", paint: { "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.9 } },
    { id: "path", type: "line", source: "path", paint: { "line-color": C.ink, "line-width": 2.6 } },
    { id: "pdgl", type: "circle", source: "pdgl",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7], "circle-color": C.danger,
               "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } },
    { id: "places-risk", type: "circle", source: "places", "source-layer": "places", filter: ["==", ["get", "at_risk"], 1],
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 11, 6],
        "circle-color": ["match", ["slice", ["get", "risk_tier"], 0, 1], "1", C.danger, "2", "#ec835a", "3", C.gorge, "#fab219"],
        "circle-stroke-color": C.ink, "circle-stroke-width": 0.8 } },
    { id: "events", type: "circle", source: "events",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 10, 9],
        "circle-color": ["match", ["get", "seismic_status"], "recorded", C.ink, "partial", "#ffffff", "inconclusive", "#d9d8d3", "#ffffff"],
        "circle-stroke-color": ["match", ["get", "seismic_status"], "pre-network", C.muted, C.ink], "circle-stroke-width": 1.6 } },
  ];
  if (labels) {
    layers.push({ id: "ofm-places", type: "symbol", source: "ofm", "source-layer": "place", minzoom: 6,
      filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
      layout: { "text-field": ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"], "text-size": ["match", ["get", "class"], "city", 13, "town", 11.5, 10.5],
        "text-anchor": "left", "text-offset": [0.5, 0], "text-optional": true },
      paint: { "text-color": C.ink, "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.4 } });
  }
  layers.push({ id: "places-risk-label", type: "symbol", source: "places", "source-layer": "places", minzoom: 9.5,
    filter: ["==", ["get", "at_risk"], 1],
    layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-anchor": "top", "text-offset": [0, 0.7] },
    paint: { "text-color": C.ink, "text-halo-color": "#fff", "text-halo-width": 1.5 } });
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources, layers,
  };
}

export const LAYER_GROUPS = {
  hillshade: ["hillshade_lo", "hillshade_west", "hillshade_central", "hillshade_east"],
  population: ["population_lo", "population_west", "population_central", "population_east"],
  exposure: ["exposure_lo", "exposure_west", "exposure_central", "exposure_east"],
  municipalities: ["muni-fill", "muni-line"],
  glaciers: ["glaciers", "lakes"],
  gorges: ["gorges"],
  rivers: ["rivers"],
  pdgl: ["pdgl"],
  events: ["events"],
  quakes: ["quakes"],
  path: ["path", "path-casing"],
  places: ["places-risk", "places-risk-label"],
  hydro: ["hydro"],
};

export function setGroup(map, group, on) {
  for (const id of LAYER_GROUPS[group] || []) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
}

const fmt = (v, d = 0) => (v === null || v === undefined || Number.isNaN(+v)) ? "–" : (+v).toLocaleString("en", { maximumFractionDigits: d });

export function placeCard(p) {
  const tier = p.risk_tier && p.risk_tier !== "none" ? `<div class="pc-tier t${p.risk_tier[0]}">${p.risk_tier.slice(3)}</div>` : "";
  const ne = p.name_ne ? `<span class="pc-ne">${p.name_ne}</span>` : "";
  return `<div class="pcard"><h4>${p.name} ${ne}</h4>
    <div class="pc-sub">${p.municipality || ""}${p.district ? ", " + p.district : ""}</div>${tier}
    <dl>
      <dt>Height above river</dt><dd>${fmt(p.hand_m, 0)} m</dd>
      <dt>Glacier ice upstream</dt><dd>${fmt(p.upstream_glacier_km2, 0)} km²</dd>
      <dt>Dangerous lakes upstream</dt><dd>${fmt(p.upstream_pdgl_n)}${p.dist_below_pdgl_km ? ` · nearest ${fmt(p.dist_below_pdgl_km, 0)} km` : ""}</dd>
      <dt>Flood arrival (10 m/s)</dt><dd>${p.arrival_min_from_pdgl_10ms ? fmt(p.arrival_min_from_pdgl_10ms) + " min from lake" : (p.arrival_min_from_ice_10ms ? fmt(p.arrival_min_from_ice_10ms) + " min from ice" : "–")}</dd>
      <dt>In a gorge</dt><dd>${+p.in_gorge === 2 ? "deep gorge" : +p.in_gorge === 1 ? "yes" : "no"}</dd>
      <dt>Valley-floor residents ≤1 km</dt><dd>${fmt(p.valley_floor_pop_1km)}</dd>
      <dt>M≥4 quakes ≤30 km since 1900</dt><dd>${fmt(p.quakes_m4_30km)}</dd>
    </dl><p class="pc-note">Screening estimate, not an official hazard map.</p></div>`;
}

export function attachPopups(map) {
  const pop = new maplibregl.Popup({ closeButton: true, maxWidth: "320px", className: "np-popup" });
  const bind = (layer, html) => {
    map.on("click", layer, (e) => { pop.setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(map); });
    map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
  };
  bind("places-risk", placeCard);
  bind("events", (p) => `<div class="pcard"><h4>${p.event}</h4><div class="pc-sub">${p.date} · ${p.type}</div>
      <dl><dt>Dead + missing</dt><dd>${fmt(+p.dead + +p.missing)}</dd><dt>Seismic record</dt><dd>${p.seismic_status}</dd></dl>
      <p class="pc-note">${p.seismic_evidence}</p></div>`);
  bind("pdgl", (p) => `<div class="pcard"><h4>Potentially dangerous lake</h4><div class="pc-sub">${p.lake_id} ${p.name || ""}</div>
      <dl><dt>ICIMOD rank</dt><dd>${p.rank}</dd><dt>Sub-basin</dt><dd>${p.sub_basin}</dd><dt>Country</dt><dd>${p.country}</dd></dl></div>`);
  bind("gorges", (p) => `<div class="pcard"><h4>${p.cls === "deep gorge" ? "Deep gorge" : "Gorge"}: ${p.river}</h4>
      <dl><dt>Length</dt><dd>${fmt(p.length_km, 1)} km</dd><dt>Wall rise within 1 km</dt><dd>${fmt(p.relief_1km_mean)} m</dd>
      <dt>Narrowest width at +100 m</dt><dd>${fmt(p.width_100_min)} m</dd><dt>Glacier ice upstream</dt><dd>${fmt(p.up_glacier_km2)} km²</dd></dl></div>`);
  bind("quakes", (p) => `<div class="pcard"><h4>M${p.m} earthquake</h4><div class="pc-sub">${p.t} · depth ${p.d} km</div><p class="pc-note">${p.place}</p></div>`);
  bind("muni-fill", (p) => `<div class="pcard"><h4>${p.municipality}</h4><div class="pc-sub">${p.district}, ${p.province}</div>
      <dl><dt>Population (2020)</dt><dd>${fmt(p.pop_2020)}</dd>
      <dt>On valley floors ≤100 km below ice</dt><dd>${fmt(p.pop_ice100_vf)} (${fmt(p.pct_ice100_vf, 1)}%)</dd>
      <dt>Below a dangerous lake</dt><dd>${fmt(p.pop_pdgl_vf)}</dd>
      <dt>Fastest arrival from ice (10 m/s)</dt><dd>${fmt(p.min_arrival_min_from_ice_10ms)} min</dd>
      <dt>Children &lt;5 / adults 65+</dt><dd>${fmt(p.u5_share_pct, 1)}% / ${fmt(p.age65_share_pct, 1)}%</dd>
      <dt>District pop. &gt;60 min from hospital</dt><dd>${fmt(p.pct_pop_over_60min_hospital, 0)}%</dd>
      <dt>Roads on exposed floors</dt><dd>${fmt(p.road_km_ice100_vf, 1)} km</dd></dl></div>`);
  bind("hydro", (p) => `<div class="pcard"><h4>${p.name || "Hydropower plant"}</h4><div class="pc-sub">${p.river || ""}</div>
      <dl><dt>Inside a gorge</dt><dd>${p.in_gorge ? "yes" : "no"}</dd></dl></div>`);
}

export function newMap(container, opts = {}) {
  addProtocol();
  const map = new maplibregl.Map({
    container, style: buildStyle(opts), center: [84.1, 28.3], zoom: 6.15, minZoom: 5, maxZoom: 14,
    maxBounds: [[77.5, 25.0], [90.5, 32.0]], attributionControl: false, cooperativeGestures: !!opts.cooperative,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution:
    "© OpenStreetMap contributors · OpenFreeMap · Copernicus DEM · RGI 7.0 · HMA lakes · ICIMOD · USGS · WorldPop · analysis: Nepal in the Path" }));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-left");
  // start with the credits collapsed (the "i" button expands them) so they never cover the map on phones
  map.once("idle", () => map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
  return map;
}
