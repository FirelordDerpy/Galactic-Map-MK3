import type { GalaxyData, Hyperlane, SectorPoly, StarSystem } from "@/lib/galaxy";

export const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1ooXofLYahqqBM-czhBrr526wn8gh8QzjTo354chCOa8/export?format=csv&gid=1707025047";

const VIP = new Set([
  "Coruscant",
  "Corellia",
  "Tatooine",
  "Naboo",
  "Alderaan",
  "Kashyyyk",
  "Mandalore",
  "Kamino",
  "Mustafar",
  "Hoth",
  "Bespin",
  "Dagobah",
  "Yavin 4",
  "Endor",
  "Jakku",
  "Lothal",
]);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function colOf(header: string[], ...names: string[]): number {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0) return i;
  }
  const lower = names.map((n) => n.toLowerCase());
  return header.findIndex((h) => lower.some((n) => h.toLowerCase().includes(n)));
}

function num(s: string): number | null {
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "system";
}

function parseLanePart(raw: string): { name: string; end: boolean } | null {
  const end = /\[e\]/i.test(raw);
  const name = raw.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  return { name, end };
}

type Pt = { x: number; y: number; i: number };

function farthestPair(pts: Pt[]): { a: Pt; b: Pt } {
  let a = pts[0]!;
  let b = pts[1] ?? pts[0]!;
  let best = -1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i]!.x - pts[j]!.x) ** 2 + (pts[i]!.y - pts[j]!.y) ** 2;
      if (d > best) {
        best = d;
        a = pts[i]!;
        b = pts[j]!;
      }
    }
  }
  return { a, b };
}

function projectOrder(pts: Pt[], a: Pt, b: Pt): number[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  return pts
    .map((p) => ({ i: p.i, t: ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 }))
    .sort((x, y) => x.t - y.t)
    .map((p) => p.i);
}

function nearestNeighbor(pts: Pt[], start: Pt, saveForLast?: Pt): number[] {
  const remaining = pts.filter((p) => p.i !== start.i);
  const ordered = [start.i];
  let cur = start;
  while (remaining.length) {
    const lastOnly = saveForLast && remaining.length > 1;
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i]!;
      if (lastOnly && p.i === saveForLast.i) continue;
      const d = (p.x - cur.x) ** 2 + (p.y - cur.y) ** 2;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const next = remaining.splice(bestI, 1)[0]!;
    ordered.push(next.i);
    cur = next;
  }
  return ordered;
}

function orderLane(systems: StarSystem[], idxs: number[], endIdxs: number[]): number[] {
  const pts: Pt[] = idxs.map((i) => ({ x: systems[i]!.x, y: systems[i]!.y, i }));
  if (pts.length <= 2) return idxs;
  const ends = [...new Set(endIdxs)].filter((i) => idxs.includes(i));
  const endPts = pts.filter((p) => ends.includes(p.i));
  if (endPts.length >= 2) {
    const pair = farthestPair(endPts);
    return nearestNeighbor(pts, pair.a, pair.b);
  }
  if (endPts.length === 1) return nearestNeighbor(pts, endPts[0]!);
  const pair = farthestPair(pts);
  return projectOrder(pts, pair.a, pair.b);
}

function parseGrid(gs: string): [number, number] | null {
  const m = gs.toUpperCase().trim().match(/^([A-Z]+)\s*-?\s*(\d+)$/);
  if (!m) return null;
  let n = 0;
  for (const ch of m[1]!) n = n * 26 + (ch.charCodeAt(0) - 64);
  return [n, Number(m[2])];
}

function linreg(xs: number[], ys: number[]): [number, number] {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let numv = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    numv += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const a = den ? numv / den : 0;
  return [a, my - a * mx];
}

export function parseMapCsv(text: string): GalaxyData {
  const rows = parseCsv(text);
  const hi = rows.findIndex((r) => r.includes("Name") && r.some((h) => h.includes("X Coordinates")));
  if (hi < 0) throw new Error("Map header not found");
  const header = rows[hi]!;
  const ni = colOf(header, "Name");
  const xi = colOf(header, "X Coordinates");
  const yi = colOf(header, "Y Coordinates");
  const ri = colOf(header, "Region");
  const di = colOf(header, "Development");
  const ti = colOf(header, "Type");
  const li = colOf(header, "Level modifier");
  const wi = colOf(header, "Region wealth");
  const mi = colOf(header, "Monthly Value in Billions");
  const ii = colOf(header, "Primary Industry");
  const bi = colOf(header, "Bonus");
  const ei = colOf(header, "Essential Resources");
  const lui = colOf(header, "Luxury Resources");
  const g1 = colOf(header, "Interest group 1");
  const g2 = colOf(header, "Interest group 2");
  const wants = header.map((h, j) => (h.trim() === "Wants" ? j : -1)).filter((j) => j >= 0);
  const desc = header.findIndex((h) => h.includes("Description"));
  const hc = header.findIndex((h) => h.includes("Hyperlane"));
  const sec = colOf(header, "Map Sector (CANNON MAPS)");
  const shp = colOf(header, "Sector Shape on map");
  const gs = colOf(header, "Grid Square");
  const cell = (r: string[], j: number) => (j >= 0 && j < r.length ? (r[j] ?? "").trim() : "");

  const systems: StarSystem[] = [];
  const used = new Set<string>();
  const laneEndNames = new Map<string, string[]>();
  for (const r of rows.slice(hi + 1)) {
    const name = cell(r, ni);
    if (!name || name === "Name") continue;
    const x = num(cell(r, xi));
    const y = num(cell(r, yi));
    if (x == null || y == null) continue;
    const blurb = cell(r, desc);
    const wiki = blurb.match(/https?:\/\/\S+/)?.[0]?.replace(/[).,]+$/, "") ?? "";
    const monthly = cell(r, mi);
    const monthlyN = num(monthly.replace("$", "")) ?? 0;
    const laneParts = cell(r, hc)
      .split(";")
      .map(parseLanePart)
      .filter((p): p is { name: string; end: boolean } => Boolean(p));
    const laneNames = laneParts.map((p) => p.name);
    for (const part of laneParts) {
      if (!part.end) continue;
      const list = laneEndNames.get(part.name) ?? [];
      list.push(name);
      laneEndNames.set(part.name, list);
    }
    let id = slug(name);
    let n = 2;
    while (used.has(id)) {
      id = `${slug(name)}-${n}`;
      n += 1;
    }
    used.add(id);
    systems.push({
      id,
      name,
      region: cell(r, ri) || "Outer Rim",
      dev: cell(r, di),
      level: Math.round(num(cell(r, li)) ?? 0),
      type: cell(r, ti),
      wealth: cell(r, wi),
      monthly,
      monthlyN,
      industry: cell(r, ii),
      bonus: cell(r, bi),
      ess: cell(r, ei),
      lux: cell(r, lui),
      ig1: cell(r, g1),
      ig1w: wants[0] != null ? cell(r, wants[0]) : "",
      ig2: cell(r, g2),
      ig2w: wants[1] != null ? cell(r, wants[1]) : "",
      blurb,
      wiki,
      x,
      y,
      lanes: laneNames,
      sector: cell(r, sec),
      grid: cell(r, gs),
      district: num(cell(r, 0)) || null,
      notable: Boolean(wiki) || monthlyN >= 20 || VIP.has(name),
    });
  }

  const byLane = new Map<string, { idxs: number[]; ends: number[] }>();
  systems.forEach((s, i) => {
    for (const ln of s.lanes) {
      const rec = byLane.get(ln) ?? { idxs: [], ends: [] };
      rec.idxs.push(i);
      byLane.set(ln, rec);
    }
  });
  for (const [laneName, names] of laneEndNames) {
    const rec = byLane.get(laneName);
    if (!rec) continue;
    const want = new Set(names);
    rec.ends = rec.idxs.filter((i) => want.has(systems[i]!.name));
  }

  const lanes: Hyperlane[] = [];
  for (const [name, rec] of byLane) {
    if (rec.idxs.length < 2) continue;
    const low = name.toLowerCase();
    lanes.push({
      name,
      major:
        rec.idxs.length >= 4 ||
        low.includes("run") ||
        low.includes("spine") ||
        low.includes("corridor") ||
        low.includes("trunk") ||
        low.includes("way"),
      sys: orderLane(systems, rec.idxs, rec.ends),
      ends: rec.ends,
    });
  }

  const sectors: SectorPoly[] = [];
  const seenSec = new Set<string>();
  for (const r of rows.slice(hi + 1)) {
    const shape = cell(r, shp);
    if (!shape.includes("|")) continue;
    const bar = shape.indexOf("|");
    const label = shape.slice(0, bar).trim();
    if (!label || seenSec.has(label)) continue;
    const pts: number[][] = [];
    for (const pair of shape.slice(bar + 1).split(";")) {
      const parts = pair.trim().split(/[,\s]+/);
      if (parts.length < 2) continue;
      const px = Number(parts[0]);
      const py = Number(parts[1]);
      if (Number.isFinite(px) && Number.isFinite(py)) pts.push([px, py]);
    }
    if (pts.length >= 3) {
      seenSec.add(label);
      sectors.push({ name: label, pts });
    }
  }

  const pairs: [number, number, number, number][] = [];
  for (const s of systems) {
    const gxy = parseGrid(s.grid);
    if (gxy) pairs.push([gxy[0], gxy[1], s.x, s.y]);
  }
  const cols = pairs.map((p) => p[0]);
  const rws = pairs.map((p) => p[1]);
  const xs = pairs.map((p) => p[2]);
  const ys = pairs.map((p) => p[3]);
  const [cellW, ox] = pairs.length >= 8 ? linreg(cols, xs) : [280, 1200];
  const [cellH, oy] = pairs.length >= 8 ? linreg(rws, ys) : [300, 400];
  const allx = systems.map((s) => s.x);
  const ally = systems.map((s) => s.y);
  const core = systems.find((s) => s.name === "Coruscant");
  return {
    systems,
    lanes,
    sectors,
    bounds: {
      minX: Math.min(...allx),
      maxX: Math.max(...allx),
      minY: Math.min(...ally),
      maxY: Math.max(...ally),
    },
    grid: {
      cellW,
      cellH,
      ox,
      oy,
      colMin: Math.min(...cols),
      colMax: Math.max(...cols),
      rowMin: Math.min(...rws),
      rowMax: Math.max(...rws),
    },
    core: { x: core?.x ?? allx[0]!, y: core?.y ?? ally[0]! },
  };
}
