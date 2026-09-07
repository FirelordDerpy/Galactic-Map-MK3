declare module "polygon-clipping" {
  export type Pair = [number, number];
  export type Ring = Pair[];
  export type Polygon = Ring[];
  export type MultiPolygon = Polygon[];
  type Geom = Polygon | MultiPolygon;
  export function intersection(geom: Geom, ...geoms: Geom[]): MultiPolygon;
  export function xor(geom: Geom, ...geoms: Geom[]): MultiPolygon;
  export function union(geom: Geom, ...geoms: Geom[]): MultiPolygon;
  export function difference(subjectGeom: Geom, ...clipGeoms: Geom[]): MultiPolygon;
  const polygonClipping: {
    intersection: typeof intersection;
    xor: typeof xor;
    union: typeof union;
    difference: typeof difference;
  };
  export default polygonClipping;
}
