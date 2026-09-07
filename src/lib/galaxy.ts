import raw from "@/data/galaxy.json";

export type StarSystem = {
  id: string;
  name: string;
  region: string;
  dev: string;
  level: number;
  type: string;
  wealth: string;
  monthly: string;
  monthlyN: number;
  industry: string;
  bonus: string;
  ess: string;
  lux: string;
  ig1: string;
  ig1w: string;
  ig2: string;
  ig2w: string;
  blurb: string;
  wiki: string;
  x: number;
  y: number;
  lanes: string[];
  sector: string;
  grid: string;
  district: number | null;
  notable: boolean;
};

export type Hyperlane = {
  name: string;
  major: boolean;
  sys: number[];
  ends: number[];
};

export type SectorPoly = {
  name: string;
  pts: number[][];
  parts?: number[][][];
  holes?: number[][][];
  auto?: boolean;
};

export type GalaxyData = {
  systems: StarSystem[];
  lanes: Hyperlane[];
  sectors: SectorPoly[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  grid: {
    cellW: number;
    cellH: number;
    ox: number;
    oy: number;
    colMin: number;
    colMax: number;
    rowMin: number;
    rowMax: number;
  };
  core: { x: number; y: number };
};

export const galaxy = raw as unknown as GalaxyData;

export const REGION_ORDER = [
  "Core",
  "Colonies",
  "Inner Rim",
  "Expansion Region",
  "Mid Rim",
  "The Slice",
  "Trailing Sectors",
  "Western Reaches",
  "New Territories",
  "Outer Rim",
  "Unknown Regions",
  "Wild Space",
] as const;

const REGION_HEX: Record<string, string> = {
  Core: "#e2c36a",
  Colonies: "#d7b056",
  "Inner Rim": "#c9a24e",
  "Expansion Region": "#b48a44",
  "Mid Rim": "#9e7c4c",
  "The Slice": "#c4a265",
  "Trailing Sectors": "#8d7350",
  "Western Reaches": "#7d6a4c",
  "New Territories": "#a89060",
  "Outer Rim": "#6e7f8a",
  "Unknown Regions": "#5c6b78",
  "Wild Space": "#4a5560",
};

export const REGION_GLOW: Record<string, string> = REGION_HEX;

export function regionColor(region: string): string {
  return REGION_HEX[region] ?? "#8a8478";
}

export const COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const VIP_LABELS = new Set([
  "Coruscant",
  "Corellia",
  "Alderaan",
  "Tatooine",
  "Naboo",
  "Kashyyyk",
  "Mandalore",
  "Kamino",
  "Hoth",
  "Bespin",
  "Endor",
  "Yavin 4",
  "Jakku",
  "Lothal",
  "Dathomir",
  "Korriban",
  "Dromund Kaas",
  "Nal Hutta",
  "Nar Shaddaa",
  "Kessel",
  "Mon Cala",
  "Ryloth",
  "Geonosis",
  "Mustafar",
]);

export function fitBounds(data: GalaxyData) {
  return data.bounds;
}

export function searchSystems(data: GalaxyData, query: string, limit = 12): StarSystem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { s: StarSystem; n: number }[] = [];
  for (const s of data.systems) {
    const name = s.name.toLowerCase();
    let n = -1;
    if (name === q) n = 0;
    else if (name.startsWith(q)) n = 1;
    else if (name.includes(q)) n = 2;
    else if (s.sector.toLowerCase().includes(q) || s.grid.toLowerCase() === q || s.region.toLowerCase().includes(q))
      n = 3;
    if (n >= 0) scored.push({ s, n });
  }
  scored.sort((a, b) => a.n - b.n || a.s.name.localeCompare(b.s.name));
  return scored.slice(0, limit).map((x) => x.s);
}
