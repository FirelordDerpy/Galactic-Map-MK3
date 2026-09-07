import { COL_LETTERS, type GalaxyData } from "@/lib/galaxy";

export type ChartTool = "off" | "place" | "draw";

export type DraftWorld = {
  id: string;
  name: string;
  x: number;
  y: number;
  region: string;
  sector: string;
  grid: string;
  shape: string;
  wiki?: string;
  blurb?: string;
};

export type DraftSector = {
  name: string;
  pts: number[][];
  closed: boolean;
  wiki?: string;
  blurb?: string;
};

const STORAGE_KEY = "atlas-chart-drafts-v1";

export const REGION_WEALTH: Record<string, string> = {
  Core: "$50",
  Colonies: "$40",
  "Inner Rim": "$35",
  "Expansion Region": "$25",
  "Mid Rim": "$25",
  "The Slice": "$25",
  "Trailing Sectors": "$25",
  "Western Reaches": "$25",
  "New Territories": "$25",
  "Outer Rim": "$20",
  "Unknown Regions": "$10",
  "Wild Space": "$10",
};

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function roundCoord(n: number): number {
  return Math.round(n);
}

export function colToLetters(n: number): string {
  if (n < 1) return "";
  let s = "";
  let col = n;
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s || COL_LETTERS[0]!;
}

export function gridSquare(grid: GalaxyData["grid"], x: number, y: number): string {
  const col = Math.round((x - grid.ox) / (grid.cellW || 1));
  const row = Math.round((y - grid.oy) / (grid.cellH || 1));
  if (!Number.isFinite(col) || !Number.isFinite(row)) return "";
  return `${colToLetters(Math.max(1, col))}${Math.max(1, row)}`;
}

function pointInPoly(x: number, y: number, pts: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]![0]!;
    const yi = pts[i]![1]!;
    const xj = pts[j]![0]!;
    const yj = pts[j]![1]!;
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function sectorAt(
  data: GalaxyData,
  x: number,
  y: number,
  extras: DraftSector[] = [],
): string {
  for (const s of extras) {
    if (s.pts.length >= 3 && pointInPoly(x, y, s.pts)) return s.name;
  }
  for (const s of [...data.sectors].sort((a, b) => Number(a.auto) - Number(b.auto))) {
    if (s.holes?.some((hole) => hole.length >= 3 && pointInPoly(x, y, hole))) continue;
    const rings = s.parts?.length ? s.parts : [s.pts];
    if (rings.some((ring) => ring.length >= 3 && pointInPoly(x, y, ring))) return s.name;
  }
  let best = "";
  let bestD = Infinity;
  for (const sys of data.systems) {
    if (!sys.sector) continue;
    const d = (sys.x - x) ** 2 + (sys.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = sys.sector;
    }
  }
  return best;
}

export function inferPlacement(data: GalaxyData, x: number, y: number, extras: DraftSector[] = []) {
  const rx = roundCoord(x);
  const ry = roundCoord(y);
  const votes = new Map<string, number>();
  const ranked = [...data.systems]
    .map((s) => ({ s, d: (s.x - rx) ** 2 + (s.y - ry) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);
  for (const { s } of ranked) votes.set(s.region, (votes.get(s.region) ?? 0) + 1);
  let region = ranked[0]?.s.region ?? "Outer Rim";
  let top = 0;
  for (const [r, n] of votes) if (n > top) {
    top = n;
    region = r;
  }
  return {
    x: rx,
    y: ry,
    region,
    sector: sectorAt(data, rx, ry, extras),
    grid: gridSquare(data.grid, rx, ry),
  };
}

export function sectorShapeCell(name: string, pts: number[][]): string {
  const body = pts.map(([px, py]) => `${roundCoord(px!)},${roundCoord(py!)}`).join(";");
  return `${name.trim() || "Unnamed"}|${body}`;
}

export const WORLD_HEADERS = [
  "",
  "Command District",
  "Name",
  "Region",
  "Development",
  "Type",
  "Level modifier",
  "Region wealth",
  "Monthly Value in Billions",
  "Primary Industry",
  "Wealth Generated industry Base",
  "Bonus",
  "Essential Resources",
  "",
  "Luxury Resources",
  "",
  "",
  "Interest group 1",
  "Wants",
  "Interest group 2",
  "Wants",
  "Description (MOST IMPORTANT IS WOOKIE LINK)",
  "",
  "X Coordinates",
  "Y Coordinates",
  'Hyperlane Connections. Format {to: "name", type: "major, minor, restricted, smuggler trail" }, {',
  "Map Sector (CANNON MAPS)",
  "Sector Shape on map",
  "Sector Location on Map",
  "Grid Square",
] as const;

export function worldCells(w: DraftWorld): string[] {
  const cells = Array.from({ length: WORLD_HEADERS.length }, () => "");
  cells[1] = "0 None";
  cells[2] = w.name.trim() || "Unnamed";
  cells[3] = w.region;
  cells[4] = "Level 0";
  cells[5] = "Nothing";
  cells[6] = "0";
  cells[7] = REGION_WEALTH[w.region] ?? "$25";
  cells[8] = "$0";
  cells[9] = "Generic Industry";
  cells[10] = "5";
  cells[12] = "N/A";
  cells[13] = "0";
  cells[14] = "N/A";
  cells[15] = "0";
  cells[17] = "Citizens";
  cells[18] = "Coffee";
  cells[19] = "Citizens";
  cells[20] = "Coffee";
  cells[21] = [w.wiki, w.blurb].filter(Boolean).join(" ");
  cells[23] = String(w.x);
  cells[24] = String(w.y);
  cells[26] = w.sector;
  cells[27] = w.shape;
  cells[29] = w.grid;
  return cells;
}

function mdCell(value: string): string {
  const v = value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  return v || "     ";
}

export function worldMarkdown(worlds: DraftWorld[]): string {
  const headers = [...WORLD_HEADERS, ...Array.from({ length: 18 }, () => "")];
  const header = `| ${headers.map((h) => (h ? h : "     ")).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const rows = worlds.map((w) => {
    const cells = [...worldCells(w), ...Array.from({ length: 18 }, () => "")];
    return `| ${cells.map(mdCell).join(" | ")} |`;
  });
  return [header, sep, ...rows].join("\n");
}

export function worldTsv(w: DraftWorld): string {
  return worldCells(w).join("\t");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&" + "amp;" : ch === "<" ? "&" + "lt;" : ch === ">" ? "&" + "gt;" : "&" + "quot;",
  );
}

function worldHtml(worlds: DraftWorld[]): string {
  const body = worlds
    .map((w) => `<tr>${worldCells(w).map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><tbody>${body}</tbody></table>`;
}

export async function copyText(text: string, html?: string): Promise<boolean> {
  try {
    if (html && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export async function copyWorlds(worlds: DraftWorld[]): Promise<boolean> {
  if (worlds.length === 0) return false;
  const md = worldMarkdown(worlds);
  const html = worldHtml(worlds);
  const tsv = worlds.map(worldTsv).join("\n");
  try {
    if (typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([md], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through */
  }
  return copyText(tsv);
}

export function loadDrafts(): { worlds: DraftWorld[]; sectors: DraftSector[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { worlds: [], sectors: [] };
    const parsed = JSON.parse(raw) as { worlds?: DraftWorld[]; sectors?: DraftSector[] };
    return {
      worlds: Array.isArray(parsed.worlds) ? parsed.worlds : [],
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors : [],
    };
  } catch {
    return { worlds: [], sectors: [] };
  }
}

export function saveDrafts(worlds: DraftWorld[], sectors: DraftSector[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ worlds, sectors }));
  } catch {
    /* ignore */
  }
}
