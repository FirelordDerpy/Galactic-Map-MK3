import { withAutoSectors } from "@/lib/catalog";
import { createServerFn } from "@tanstack/react-start";
import { galaxy, type GalaxyData } from "@/lib/galaxy";
import { parseMapCsv, SHEET_CSV_URL } from "@/lib/parse-sheet";

export type GalaxyLoad = {
  data: GalaxyData;
  source: "live" | "snapshot";
  fetchedAt: number;
  hash: string;
  systemCount: number;
};

function pack(data: GalaxyData, source: GalaxyLoad["source"], hash: string): GalaxyLoad {
  const decorated = withAutoSectors(data);
  return {
    data: decorated,
    source,
    fetchedAt: Date.now(),
    hash,
    systemCount: decorated.systems.length,
  };
}

export const loadGalaxyFn = createServerFn({ method: "GET" }).handler(async (): Promise<GalaxyLoad> => {
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`sheet ${res.status}`);
    const text = await res.text();
    const data = parseMapCsv(text);
    if (!data.systems.length) throw new Error("empty sheet");
    return pack(data, "live", `${data.systems.length}-${data.sectors.length}`);
  } catch {
    return pack(galaxy, "snapshot", "snapshot");
  }
});

export async function fetchGalaxy(): Promise<GalaxyLoad> {
  try {
    return await loadGalaxyFn();
  } catch {
    return pack(galaxy, "snapshot", "snapshot");
  }
}