import { Delaunay } from "d3-delaunay";
import polygonClipping from "polygon-clipping";
import raw from "@/data/sw-catalog.json";
import { gridSquare, roundCoord } from "@/lib/chart-tools";
import { REGION_ORDER, type GalaxyData, type SectorPoly, type StarSystem } from "@/lib/galaxy";

export type CatalogPlanet = {
  n: string;
  r: string;
  s: string;
  g: string;
  ax: number;
  ay: number;
  k?: number;
  dia?: number;
  grav?: number;
  moons?: number;
  suns?: number;
  day?: number;
  year?: number;
};

export type CatalogSector = {
  n: string;
  r: string;
  count: number;
  notables: string[];
  grids: string[];
};

type Fit = { xf: { a: number; b: number }; yf: { a: number; b: number } };

export function normName(s: string): string {
  return s.toLowerCase().replace(/[''`´]/g, "").replace(/[^a-z0-9]+/g, "");
}

export function sectorKey(s: string): string {
  return normName(s.replace(/\s+sector$/i, ""));
}

const CATALOG = raw as CatalogPlanet[];
const BY_NORM = new Map<string, CatalogPlanet>();
for (const p of CATALOG) BY_NORM.set(normName(p.n), p);

const FALLBACK_X = { a: 290.42, b: 1504.07 };
const FALLBACK_Y = { a: 307.7, b: 510.15 };

const JUNK_SECTORS = new Set(
  ["zuma", "unknown", "none", "na", "wildspace"].concat(REGION_ORDER.map((r) => normName(r))),
);

const SECTOR_PLANETS = new Map<string, CatalogPlanet[]>();
for (const p of CATALOG) {
  const key = sectorKey(p.s);
  if (!key || JUNK_SECTORS.has(key)) continue;
  const list = SECTOR_PLANETS.get(key);
  if (list) list.push(p);
  else SECTOR_PLANETS.set(key, [p]);
}

export const CATALOG_SECTORS: CatalogSector[] = [...SECTOR_PLANETS.entries()]
  .map(([, planets]) => {
    const names = new Map<string, number>();
    const regions = new Map<string, number>();
    const grids = new Map<string, number>();
    for (const p of planets) {
      names.set(p.s, (names.get(p.s) ?? 0) + 1);
      regions.set(p.r, (regions.get(p.r) ?? 0) + 1);
      if (p.g) grids.set(p.g, (grids.get(p.g) ?? 0) + 1);
    }
    const n = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? planets[0]!.s;
    const r = [...regions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Outer Rim";
    const rankedGrids = [...grids.entries()].sort((a, b) => b[1] - a[1]);
    const gridCut = Math.max(2, (rankedGrids[0]?.[1] ?? 1) * 0.35);
    const notables = planets
      .filter((p) => p.k)
      .map((p) => p.n)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 6);
    return {
      n,
      r,
      count: planets.length,
      notables: notables.length ? notables : planets.slice(0, 4).map((p) => p.n),
      grids: rankedGrids.filter((g) => g[1] >= gridCut).slice(0, 4).map((g) => g[0]),
    };
  })
  .sort((a, b) => b.count - a.count || a.n.localeCompare(b.n));

let fitCache: { n: number; fit: Fit } | null = null;

export function wikiUrl(name: string): string {
  return `https://starwars.fandom.com/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}

export function sectorWiki(name: string): string {
  if (/(cluster|worlds|hegemony|node|zone|regions|spur|nebula)$/i.test(name.trim())) {
    return wikiUrl(name.trim());
  }
  return wikiUrl(`${name.trim()} sector`);
}

export function catalogBlurb(p: CatalogPlanet): string {
  const bits: string[] = [];
  if (p.s) bits.push(`${p.s} sector`);
  if (p.g) bits.push(`Atlas ${p.g}`);
  if (p.suns) bits.push(`${p.suns} sun${p.suns === 1 ? "" : "s"}`);
  if (p.moons) bits.push(`${p.moons} moon${p.moons === 1 ? "" : "s"}`);
  if (p.dia) bits.push(`diameter ${Math.round(p.dia)} km`);
  if (p.grav) bits.push(`${p.grav}g`);
  if (p.day) bits.push(`${p.day}h day`);
  if (p.year) bits.push(`${p.year}d year`);
  return bits.join(" · ");
}

export function sectorBlurb(s: CatalogSector): string {
  const bits = [`${s.count} world${s.count === 1 ? "" : "s"}`];
  if (s.grids.length) bits.push(`Atlas ${s.grids.join(", ")}`);
  if (s.notables.length) bits.push(s.notables.slice(0, 4).join(", "));
  return bits.join(" · ");
}

function linreg(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const a = den ? num / den : 0;
  return { a, b: my - a * mx };
}

function sheetFit(data: GalaxyData): Fit {
  if (fitCache && fitCache.n === data.systems.length) return fitCache.fit;
  const axs: number[] = [];
  const sxs: number[] = [];
  const ays: number[] = [];
  const sys: number[] = [];
  for (const s of data.systems) {
    const p = BY_NORM.get(normName(s.name));
    if (!p) continue;
    axs.push(p.ax);
    sxs.push(s.x);
    ays.push(p.ay);
    sys.push(s.y);
  }
  const fit: Fit = {
    xf: axs.length >= 12 ? linreg(axs, sxs) : FALLBACK_X,
    yf: ays.length >= 12 ? linreg(ays, sys) : FALLBACK_Y,
  };
  fitCache = { n: data.systems.length, fit };
  return fit;
}

export function atlasToSheet(data: GalaxyData, ax: number, ay: number): { x: number; y: number } {
  const { xf, yf } = sheetFit(data);
  return { x: roundCoord(xf.a * ax + xf.b), y: roundCoord(yf.a * ay + yf.b) };
}

function onChart(systems: StarSystem[]): Set<string> {
  const set = new Set<string>();
  for (const s of systems) {
    const n = normName(s.name);
    if (n) set.add(n);
  }
  return set;
}

export function missingPlanets(systems: StarSystem[], query: string, limit = 40): CatalogPlanet[] {
  const have = onChart(systems);
  const q = query.trim().toLowerCase();
  const scored: { p: CatalogPlanet; n: number }[] = [];
  for (const p of CATALOG) {
    if (have.has(normName(p.n))) continue;
    if (q) {
      const name = p.n.toLowerCase();
      let n = -1;
      if (name === q) n = 0;
      else if (name.startsWith(q)) n = 1;
      else if (name.includes(q)) n = 2;
      else if (p.s.toLowerCase().includes(q) || p.r.toLowerCase().includes(q) || p.g.toLowerCase() === q) n = 3;
      if (n < 0) continue;
      scored.push({ p, n });
    } else scored.push({ p, n: p.k ? 0 : 4 });
  }
  scored.sort((a, b) => a.n - b.n || (b.p.k ?? 0) - (a.p.k ?? 0) || a.p.n.localeCompare(b.p.n));
  return scored.slice(0, limit).map((x) => x.p);
}

export function missingCount(systems: StarSystem[]): number {
  const have = onChart(systems);
  let n = 0;
  for (const p of CATALOG) if (!have.has(normName(p.n))) n += 1;
  return n;
}

export function placementFromCatalog(data: GalaxyData, p: CatalogPlanet) {
  const pos = atlasToSheet(data, p.ax, p.ay);
  return {
    name: p.n,
    region: p.r,
    sector: p.s,
    grid: gridSquare(data.grid, pos.x, pos.y),
    x: pos.x,
    y: pos.y,
    shape: "",
    wiki: wikiUrl(p.n),
    blurb: catalogBlurb(p),
    atlasGrid: p.g,
  };
}

function drawnSectorKeys(data: GalaxyData): Set<string> {
  const set = new Set<string>();
  for (const s of data.sectors) {
    if (s.auto) continue;
    const k = sectorKey(s.name);
    if (k) set.add(k);
  }
  return set;
}

export function missingSectors(data: GalaxyData, query: string, limit = 40): CatalogSector[] {
  const have = drawnSectorKeys(data);
  const q = query.trim().toLowerCase();
  const scored: { s: CatalogSector; n: number }[] = [];
  for (const s of CATALOG_SECTORS) {
    if (have.has(sectorKey(s.n))) continue;
    if (q) {
      const name = s.n.toLowerCase();
      let n = -1;
      if (name === q) n = 0;
      else if (name.startsWith(q)) n = 1;
      else if (name.includes(q)) n = 2;
      else if (s.r.toLowerCase().includes(q) || s.notables.some((w) => w.toLowerCase().includes(q))) n = 3;
      if (n < 0) continue;
      scored.push({ s, n });
    } else scored.push({ s, n: 0 });
  }
  scored.sort((a, b) => a.n - b.n || b.s.count - a.s.count || a.s.n.localeCompare(b.s.n));
  return scored.slice(0, limit).map((x) => x.s);
}

export function missingSectorCount(data: GalaxyData): number {
  const have = drawnSectorKeys(data);
  let n = 0;
  for (const s of CATALOG_SECTORS) if (!have.has(sectorKey(s.n))) n += 1;
  return n;
}

function cross(o: number[], a: number[], b: number[]): number {
  return (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
}

function convexHull(pts: number[][]): number[][] {
  const p = [...pts].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
  if (p.length <= 2) return p;
  const lower: number[][] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: number[][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function hexAround(x: number, y: number, r: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push([roundCoord(x + Math.cos(a) * r), roundCoord(y + Math.sin(a) * r)]);
  }
  return pts;
}

function padPoly(pts: number[][], pad: number): number[][] {
  const cx = pts.reduce((s, p) => s + p[0]!, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1]!, 0) / pts.length;
  return pts.map(([x, y]) => {
    const dx = x! - cx;
    const dy = y! - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [roundCoord(x! + (dx / len) * pad), roundCoord(y! + (dy / len) * pad)];
  });
}

function uniquePts(pts: number[][]): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const p of pts) {
    const k = `${p[0]},${p[1]}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function median(nums: number[]): number {
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

function rejectOutliers(pts: number[][], maxSpread: number): number[][] {
  if (pts.length < 3) return pts;
  const mx = median(pts.map((p) => p[0]!));
  const my = median(pts.map((p) => p[1]!));
  const kept = pts.filter((p) => Math.hypot(p[0]! - mx, p[1]! - my) <= maxSpread);
  return kept.length ? kept : pts;
}

export function hullFromPoints(pts: number[][]): number[][] {
  const local = uniquePts(rejectOutliers(pts.map(([x, y]) => [roundCoord(x!), roundCoord(y!)]), 720));
  if (local.length === 0) return [];
  if (local.length === 1) return hexAround(local[0]![0]!, local[0]![1]!, 150);
  if (local.length === 2) {
    const mx = (local[0]![0]! + local[1]![0]!) / 2;
    const my = (local[0]![1]! + local[1]![1]!) / 2;
    const r = Math.max(140, Math.hypot(local[1]![0]! - local[0]![0]!, local[1]![1]! - local[0]![1]!) / 2 + 80);
    return hexAround(mx, my, r);
  }
  const hull = convexHull(local);
  const xs = hull.map((p) => p[0]!);
  const ys = hull.map((p) => p[1]!);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  if (hull.length < 5 || Math.min(w, h) < 180) {
    return hexAround((minX + maxX) / 2, (minY + maxY) / 2, Math.max(150, Math.max(w, h) / 2 + 90));
  }
  return padPoly(hull, Math.max(90, 220 - Math.min(w, h) / 2));
}

export function hullForSector(data: GalaxyData, sector: CatalogSector): number[][] {
  const atlas: number[][] = [];
  const planets = SECTOR_PLANETS.get(sectorKey(sector.n)) ?? [];
  for (const p of planets) atlas.push([p.ax, p.ay]);
  const clustered = rejectOutliers(atlas, 2.1);
  const pts: number[][] = clustered.map(([ax, ay]) => {
    const xy = atlasToSheet(data, ax!, ay!);
    return [xy.x, xy.y];
  });
  const key = sectorKey(sector.n);
  for (const s of data.systems) {
    if (s.sector && sectorKey(s.sector) === key) pts.push([roundCoord(s.x), roundCoord(s.y)]);
  }
  const hull = hullFromPoints(pts);
  return hull.length ? hull : hexAround(data.core.x, data.core.y, 140);
}

function isJunkSector(raw: string): boolean {
  const key = sectorKey(raw);
  if (!key || JUNK_SECTORS.has(key)) return true;
  if (key.startsWith("unknown")) return true;
  return false;
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return ring;
  return [...ring, [a[0], a[1]]];
}

function asRing(pts: number[][]): [number, number][] {
  return closeRing(pts.map((p) => [p[0]!, p[1]!]));
}

function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j]![0]! * ring[i]![1]! - ring[i]![0]! * ring[j]![1]!;
  }
  return Math.abs(a) / 2;
}

function roundRing(ring: [number, number][]): number[][] {
  return closeRing(ring).map(([x, y]) => [roundCoord(x), roundCoord(y)]);
}

function geomParts(geom: [number, number][][][]): { outers: number[][][]; holes: number[][][] } {
  const outers: number[][][] = [];
  const holes: number[][][] = [];
  for (const poly of geom) {
    const outer = poly[0];
    if (!outer || outer.length < 4 || ringArea(outer) < 900) continue;
    outers.push(roundRing(outer));
    for (const hole of poly.slice(1)) {
      if (hole.length >= 4 && ringArea(hole) >= 900) holes.push(roundRing(hole));
    }
  }
  outers.sort((a, b) => ringArea(b) - ringArea(a));
  return { outers, holes };
}

export function withAutoSectors(data: GalaxyData): GalaxyData {
  const official = data.sectors.filter((s) => !s.auto);
  try {
    return buildAutoSectors(data, official);
  } catch {
    return { ...data, sectors: official };
  }
}

function buildAutoSectors(data: GalaxyData, official: SectorPoly[]): GalaxyData {
  const drawn = new Set(official.map((s) => sectorKey(s.name)).filter(Boolean));
  const names = new Map<string, string>();
  const sites: { x: number; y: number; key: string; official: boolean }[] = [];
  const seen = new Map<string, number>();

  for (const sys of data.systems) {
    const rawName = sys.sector.trim();
    const key = isJunkSector(rawName) ? "" : sectorKey(rawName);
    const slot = `${Math.round(sys.x)}:${Math.round(sys.y)}`;
    const n = seen.get(slot) ?? 0;
    seen.set(slot, n + 1);
    const ang = n * 2.399963;
    const x = sys.x + (n ? Math.cos(ang) * 1.4 * n : 0);
    const y = sys.y + (n ? Math.sin(ang) * 1.4 * n : 0);
    if (key && !names.has(key)) {
      names.set(key, rawName.replace(/\s+sector$/i, "").trim() || rawName);
    }
    sites.push({ x, y, key, official: Boolean(key) && drawn.has(key) });
  }

  if (sites.length < 3) return { ...data, sectors: official };

  const allPts = sites.map((s) => [s.x, s.y] as [number, number]);
  const hull = padPoly(convexHull(allPts), 220);
  if (hull.length < 3) return { ...data, sectors: official };
  const bound = [asRing(hull)];
  const xs = allPts.map((p) => p[0]);
  const ys = allPts.map((p) => p[1]);
  const pad = 260;
  const voronoi = Delaunay.from(allPts).voronoi([
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ]);

  const cells = new Map<string, [number, number][][][]>();
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i]!;
    if (!site.key || site.official) continue;
    const cell = voronoi.cellPolygon(i);
    if (!cell || cell.length < 4) continue;
    const poly = [closeRing(cell.map((p) => [p[0], p[1]] as [number, number]))];
    const list = cells.get(site.key) ?? [];
    list.push(poly);
    cells.set(site.key, list);
  }

  const officialGeom = official
    .filter((s) => s.pts.length >= 3)
    .map((s) => [asRing(s.pts)] as [number, number][][]);

  const auto: SectorPoly[] = [];
  for (const [key, polys] of cells) {
    if (polys.length === 0) continue;
    let geom: [number, number][][][] = [];
    try {
      geom = polygonClipping.union(polys[0]!, ...polys.slice(1));
    } catch {
      geom = polys;
    }
    try {
      geom = polygonClipping.intersection(geom, bound);
    } catch {
      /* keep */
    }
    if (officialGeom.length) {
      try {
        geom = polygonClipping.difference(geom, ...officialGeom);
      } catch {
        /* keep */
      }
    }
    const { outers, holes } = geomParts(geom);
    if (!outers.length) continue;
    auto.push({
      name: names.get(key) ?? key,
      pts: outers[0]!,
      parts: outers.length > 1 ? outers : undefined,
      holes: holes.length ? holes : undefined,
      auto: true,
    });
  }

  return { ...data, sectors: [...official, ...auto] };
}

export function placementFromCatalogSector(data: GalaxyData, sector: CatalogSector) {
  const pts = hullForSector(data, sector);
  const x = roundCoord(pts.reduce((s, p) => s + p[0]!, 0) / pts.length);
  const y = roundCoord(pts.reduce((s, p) => s + p[1]!, 0) / pts.length);
  return {
    name: sector.n,
    pts,
    closed: true as const,
    wiki: sectorWiki(sector.n),
    blurb: sectorBlurb(sector),
    x,
    y,
  };
}
