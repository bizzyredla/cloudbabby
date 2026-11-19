// Small helpers shared by the 3D map (atlas/app.js) and its renderer.
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export function prepareZones(zones) {
  return zones.map((t) => {
    const pts = t.rings.flatMap((p) => p[0]),
      xx = pts.map((p) => p[1]),
      yy = pts.map((p) => p[0]);
    return {
      ...t,
      box: [Math.min(...xx), Math.min(...yy), Math.max(...xx), Math.max(...yy)],
    };
  });
}
export function zoomTo(points, w, h, pad = 90) {
  if (!points.length) return { center: [-118.25, 34.05], zoom: 8.6 };
  let xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    x = (Math.max(...xs) + Math.min(...xs)) / 2,
    y = (Math.max(...ys) + Math.min(...ys)) / 2;
  let dx = Math.max(0.004, Math.max(...xs) - Math.min(...xs)),
    dy =
      Math.max(0.004, Math.max(...ys) - Math.min(...ys)) /
      Math.cos((y * Math.PI) / 180);
  return {
    center: [x, y],
    zoom: clamp(
      Math.log2(
        (Math.min(Math.max(90, w - pad) / dx, Math.max(85, h - pad) / dy) *
          360) /
          512,
      ),
      5.7,
      16,
    ),
  };
}
export function zoneFeature(t) {
  return {
    type: 'Feature',
    properties: { n: t.n },
    geometry: {
      type: 'MultiPolygon',
      coordinates: t.rings.map((p) => p.map((r) => r.map(([y, x]) => [x, y]))),
    },
  };
}
export const paths = {
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  route: 'M5 6h10a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10 M3 4l3 2-3 2 M17 16l3 2-3 2',
  zones: 'M3 7l8-4 10 4-9 5z M3 12l9 5 9-5 M3 17l9 5 9-5',
  search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  locate:
    'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  fit: 'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',
  close: 'M6 6l12 12 M18 6L6 18',
  chevron: 'M9 5l7 7-7 7',
  filter:
    'M3 7h6m4 0h8M3 17h10m4 0h4 M13 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M17 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  compass: 'M15 5l-2 9-6 4 2-9z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1',
  target: 'M3 20l3-11 15-6-7 16-3-5z',
  check: 'M4 12l5 5L20 6',
  box: 'M3 8l9-5 9 5-9 5z M3 8v9l9 5 9-5V8 M12 13v9',
  back: 'M14 5l-7 7 7 7',
  trash: 'M5 7h14 M9 7V4h6v3 M7 8l1 12h8l1-12',
  up: 'M12 20V4 M6 10l6-6 6 6',
  down: 'M12 4v16 M6 14l6 6 6-6',
};
export const icon = (n, size = 18) =>
  '<svg width="' +
  size +
  '" height="' +
  size +
  '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' +
  paths[n] +
  '"/></svg>';
