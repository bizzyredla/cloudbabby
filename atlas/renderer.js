// The 3D map's base layer: Mapbox Standard Satellite with terrain and 3D buildings (Mapbox GL JS, WebGL2).
// Throws when the device can't run it or Mapbox doesn't answer, so the page can offer the 2D map instead.
import { clamp, zoneFeature } from './core.js';

const GL = 'https://api.mapbox.com/mapbox-gl-js/v3.17.0/mapbox-gl';
const fc = (features = []) => ({ type: 'FeatureCollection', features });
const line = (pts) => fc(pts.length < 2 ? [] : [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }]);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadScript() {
  if (window.mapboxgl) return Promise.resolve();
  return new Promise((res, rej) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `${GL}.css`;
    document.head.append(l);
    const el = document.createElement('script');
    el.src = `${GL}.js`; el.onload = res; el.onerror = () => rej(new Error('Mapbox GL JS did not load'));
    document.head.append(el);
  });
}

export async function createRenderer(host, opts) {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) throw new Error('nogl');
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  if (!opts.token) throw new Error('notoken');
  await loadScript();
  const lib = window.mapboxgl;
  let current = { center: opts.camera.center, zoom: opts.camera.zoom, pitch: 0, bearing: 0 };
  let zones = []; let selected = 0; let visible = false; let route = [];
  // Its own box: Mapbox's stylesheet makes the map container position: relative, which would collapse the host.
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;inset:0';
  host.append(box);
  const gl = new lib.Map({
    container: box,
    style: 'mapbox://styles/mapbox/standard-satellite',
    accessToken: opts.token,
    center: current.center, zoom: current.zoom,
    attributionControl: false, maxPitch: 67, maxZoom: 19, minZoom: 5.7,
    maxBounds: [[-122.6, 31.7], [-113, 36.9]],
    config: { basemap: { lightPreset: 'day', showPointOfInterestLabels: false } },
  });
  gl.addControl(new lib.AttributionControl({ compact: true }), 'bottom-right');
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Mapbox did not answer')), 20000);
    gl.once('load', () => { clearTimeout(t); res(); });
    gl.on('error', (e) => {
      const st = e && e.error && e.error.status;
      if (st === 401 || st === 403) { clearTimeout(t); rej(new Error('Mapbox key refused')); }
    });
  }).catch((e) => { try { gl.remove(); } catch (x) { /* gone */ } box.remove(); throw e; });

  // Hills and mountains, then buildings (only at street level), then territory outlines and the route on top.
  gl.addSource('atlas-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
  gl.setTerrain({ source: 'atlas-dem', exaggeration: 1.1 });
  gl.addSource('atlas-streets', { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' });
  gl.addLayer({
    id: 'atlas-buildings', type: 'fill-extrusion', source: 'atlas-streets', 'source-layer': 'building', minzoom: 15,
    filter: ['==', ['get', 'extrude'], 'true'],
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'], 0, '#b9b2a2', 60, '#cfc9bb', 200, '#e4e0d6'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.6, ['get', 'height']],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.6,
      'fill-extrusion-vertical-gradient': true,
    },
  });
  gl.addSource('atlas-zones', { type: 'geojson', data: fc() });
  gl.addLayer({ id: 'atlas-zone-fill', type: 'fill', source: 'atlas-zones', paint: { 'fill-color': '#f6d58e', 'fill-opacity': ['case', ['==', ['get', 'n'], 0], 0, 0.08] } });
  gl.addLayer({ id: 'atlas-outline', type: 'line', source: 'atlas-zones', paint: { 'line-width': 1.8, 'line-opacity': 0.8, 'line-color': '#c8e0c9' } });
  gl.addSource('atlas-route', { type: 'geojson', data: fc() });
  gl.addLayer({ id: 'atlas-route-line', type: 'line', source: 'atlas-route', paint: { 'line-color': '#34d399', 'line-width': 4, 'line-dasharray': [2, 1.5] } });

  const notify = () => opts.move();
  gl.on('move', () => {
    current = { center: gl.getCenter().toArray(), zoom: gl.getZoom(), bearing: gl.getBearing(), pitch: gl.getPitch() };
    notify();
  });
  const observer = new ResizeObserver(() => { gl.resize(); notify(); });
  observer.observe(host);
  function overlay() {
    const shapes = zones.filter((z) => visible || z.n === selected);
    gl.getSource('atlas-zones').setData(fc(shapes.map((z) => { const f = zoneFeature(z); f.properties.n = z.n === selected ? z.n : 0; return f; })));
    gl.setPaintProperty('atlas-outline', 'line-color', ['case', ['!=', ['get', 'n'], 0], '#ffcb7f', '#c8e0c9']);
    gl.setPaintProperty('atlas-outline', 'line-width', ['case', ['!=', ['get', 'n'], 0], 3, 1.4]);
    gl.getSource('atlas-route').setData(line(route));
  }
  return {
    move(camera) {
      const to = { ...camera };
      if (to.zoom != null) to.zoom = clamp(to.zoom, 5.7, 19);
      gl.easeTo({ ...to, duration: reduced() ? 0 : 700 });
    },
    state: () => ({ ...current }),
    project: (p) => gl.project(p),
    unproject: (x, y) => gl.unproject([x, y]).toArray(),
    layers(z, s, v, r) { zones = z; selected = s; visible = v; route = r; overlay(); },
    destroy() { observer.disconnect(); try { gl.remove(); } catch (x) { /* gone */ } box.remove(); },
  };
}
