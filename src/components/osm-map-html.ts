export type OSM_Pin = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  color?: string;
};

export type OSM_Point = {
  latitude: number;
  longitude: number;
};

export type OSM_Bounds = {
  southWest: OSM_Point;
  northEast: OSM_Point;
};

export const CENTER_LAT = 14.582;
export const CENTER_LNG = 121.132;

const STADIA_TILE_URL = 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';
const STADIA_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; Stadia Maps';
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';

/** Stadia Alidade Smooth when a key is configured; plain OSM tiles otherwise (and as a runtime fallback). */
export function resolveTileProvider(): { url: string; attribution: string; stadia: boolean } {
  const apiKey = process.env.EXPO_PUBLIC_STADIA_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    return {
      url: `${STADIA_TILE_URL}?api_key=${encodeURIComponent(apiKey.trim())}`,
      attribution: STADIA_ATTRIBUTION,
      stadia: true,
    };
  }
  return { url: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, stadia: false };
}

export type MapHtmlState = {
  pins: OSM_Pin[];
  line: OSM_Point[];
  focus?: OSM_Point | null;
  bounds?: OSM_Bounds | null;
  activePinId?: string | null;
  userLocation?: OSM_Point | null;
};

/** JSON.stringify that is safe to embed inside a <script> block. */
function json(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
}

/**
 * Builds the complete Leaflet page. Initial data is baked in; later updates arrive through
 * `window.__mapBridge.apply(...)` (native: injectJavaScript, web: postMessage) so the map
 * never reloads when pins, the route, or the active pin change.
 */
export function buildMapHtml(state: MapHtmlState): string {
  const tiles = resolveTileProvider();
  const area = state.bounds
    ? {
        sw: { lat: state.bounds.southWest.latitude, lng: state.bounds.southWest.longitude },
        ne: { lat: state.bounds.northEast.latitude, lng: state.bounds.northEast.longitude },
      }
    : null;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #eff4ff; }
  .amx-pin { width: 18px; height: 18px; border-radius: 50%; border: 3px solid #ffffff; box-sizing: border-box; box-shadow: 0 1px 4px rgba(0,0,0,.35); transition: all .18s ease; }
  .amx-pin-active { width: 28px; height: 28px; box-shadow: 0 0 0 7px rgba(30,64,255,.22), 0 2px 10px rgba(0,0,0,.4); }
  .amx-user-wrap { position: relative; width: 14px; height: 14px; }
  .amx-user-halo { position: absolute; inset: 0; border-radius: 50%; background: rgba(30,64,255,.30); animation: amx-pulse 1.8s ease-out infinite; }
  .amx-user-core { position: absolute; inset: 0; border-radius: 50%; background: #1e40ff; border: 3px solid #ffffff; box-sizing: border-box; box-shadow: 0 0 0 2px rgba(30,64,255,.45); }
  @keyframes amx-pulse { 0% { transform: scale(1); opacity: .9; } 100% { transform: scale(3.4); opacity: 0; } }
  .amx-popup .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 4px 14px rgba(11,28,48,.28); }
  .amx-popup .leaflet-popup-content { margin: 0; font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; }
  .amx-popup-card { display: flex; align-items: center; gap: 9px; padding: 10px 12px; min-width: 150px; }
  .amx-popup-bar { width: 4px; align-self: stretch; border-radius: 2px; }
  .amx-popup-title { font-size: 13px; font-weight: 600; color: #0b1c30; line-height: 1.3; }
  .amx-popup-sub { font-size: 11px; color: #565e74; margin-top: 2px; }
  .leaflet-container { font-family: inherit; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var __pins = ${json(state.pins)};
  var __line = ${json(state.line)};
  var __focus = ${json(state.focus ?? null)};
  var __maxArea = ${json(area)};
  var __activePinId = ${json(state.activePinId ?? null)};
  var __user = ${json(state.userLocation ?? null)};

  var map = L.map('map', { zoomControl: false, scrollWheelZoom: true, attributionControl: true, maxBoundsViscosity: 0.8 })
    .setView([${CENTER_LAT}, ${CENTER_LNG}], 14);

  var tileLayer = L.tileLayer('${tiles.url}', { maxZoom: 20, attribution: '${tiles.attribution}' });
  var tileErrors = 0;
  tileLayer.on('tileerror', function () {
    tileErrors += 1;
    if (tileErrors === 3 && ${tiles.stadia ? 'true' : 'false'}) {
      map.removeLayer(tileLayer);
      tileLayer = L.tileLayer('${OSM_TILE_URL}', { maxZoom: 19, attribution: '${OSM_ATTRIBUTION}' }).addTo(map);
      tileLayer.bringToBack();
    }
  });
  tileLayer.addTo(map);

  var areaBounds = null;
  if (__maxArea) {
    areaBounds = L.latLngBounds(
      L.latLng(__maxArea.sw.lat, __maxArea.sw.lng),
      L.latLng(__maxArea.ne.lat, __maxArea.ne.lng)
    );
    // Bounds still constrain panning, but no green rectangle is drawn on the map.
    map.setMaxBounds(areaBounds);
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function postOut(payload) {
    var text = JSON.stringify(payload);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(text); }
    else { window.parent.postMessage(text, '*'); }
  }
  function postPin(id) { if (id) { postOut({ type: 'pin', id: id }); } }
  function postReady() { postOut({ type: 'ready' }); }

  function pinIcon(color, active) {
    var size = active ? 28 : 18;
    return L.divIcon({
      className: '',
      html: '<div class="amx-pin' + (active ? ' amx-pin-active' : '') + '" style="background:' + color + '"></div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2 - 2]
    });
  }

  function popupHtml(pin) {
    return '<div class="amx-popup-card">' +
      '<div class="amx-popup-bar" style="background:' + pin.color + '"></div>' +
      '<div><div class="amx-popup-title">' + escapeHtml(pin.title) + '</div>' +
      '<div class="amx-popup-sub">Verified accessibility info</div></div></div>';
  }

  var markersById = {};

  function findPin(id) {
    var list = __pins || [];
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  function renderMarkers() {
    var seen = {};
    var list = __pins || [];
    list.forEach(function (pin) {
      seen[pin.id] = true;
      var latlng = [pin.latitude, pin.longitude];
      var active = pin.id === __activePinId;
      var existing = markersById[pin.id];
      if (existing) {
        existing.setLatLng(latlng);
        if (existing.__color !== pin.color || existing.__active !== active) {
          existing.setIcon(pinIcon(pin.color, active));
          existing.__color = pin.color;
          existing.__active = active;
        }
        if (existing.__title !== pin.title) {
          existing.setPopupContent(popupHtml(pin));
          existing.__title = pin.title;
        }
      } else {
        var marker = L.marker(latlng, { icon: pinIcon(pin.color, active), riseOnHover: true }).addTo(map);
        marker.bindPopup(popupHtml(pin), { className: 'amx-popup', closeButton: false });
        marker.__color = pin.color;
        marker.__title = pin.title;
        marker.__active = active;
        marker.on('click', function () { postPin(pin.id); });
        markersById[pin.id] = marker;
      }
    });
    Object.keys(markersById).forEach(function (id) {
      if (!seen[id]) { map.removeLayer(markersById[id]); delete markersById[id]; }
    });
  }

  function setActivePin(id) {
    __activePinId = id || null;
    Object.keys(markersById).forEach(function (markerId) {
      var marker = markersById[markerId];
      var active = markerId === __activePinId;
      if (marker.__active !== active) {
        marker.setIcon(pinIcon(marker.__color, active));
        marker.__active = active;
      }
    });
  }

  var routeMain = null;
  var routeCasing = null;
  function linePoints() {
    return (__line || []).map(function (pt) { return [pt.latitude, pt.longitude]; });
  }

  function renderRoute() {
    if (routeMain) { map.removeLayer(routeMain); routeMain = null; }
    if (routeCasing) { map.removeLayer(routeCasing); routeCasing = null; }
    var pts = linePoints();
    if (pts.length < 2) { return; }
    routeCasing = L.polyline(pts, { color: '#dbe4ff', weight: 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    routeMain = L.polyline(pts, { color: '#1e40ff', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    routeCasing.bringToBack();
  }

  var userMarker = null;
  function renderUser(loc) {
    if (!loc) { return; }
    var latlng = [loc.latitude, loc.longitude];
    if (!userMarker) {
      userMarker = L.marker(latlng, {
        icon: L.divIcon({
          className: '',
          html: '<div class="amx-user-wrap"><div class="amx-user-halo"></div><div class="amx-user-core"></div></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        }),
        interactive: false,
        zIndexOffset: -500
      }).addTo(map);
    } else {
      userMarker.setLatLng(latlng);
    }
  }

  function collectPoints() {
    var points = [];
    (__pins || []).forEach(function (pin) { points.push([pin.latitude, pin.longitude]); });
    if (__line && __line.length > 1) { __line.forEach(function (pt) { points.push([pt.latitude, pt.longitude]); }); }
    if (__user) { points.push([__user.latitude, __user.longitude]); }
    return points;
  }

  function fitAll() {
    var points = collectPoints();
    if (points.length > 1) { map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 }); }
    else if (points.length === 1) { map.setView(points[0], 16); }
    else if (areaBounds) { map.fitBounds(areaBounds); }
    else { map.setView([${CENTER_LAT}, ${CENTER_LNG}], 14); }
  }

  window.__mapBridge = {
    apply: function (state) {
      if (!state) { return; }
      if (state.pins) { __pins = state.pins; renderMarkers(); }
      if (state.line) { __line = state.line; renderRoute(); }
      if (state.userLocation) { __user = state.userLocation; renderUser(__user); }
      var target = null;
      if (Object.prototype.hasOwnProperty.call(state, 'activePinId')) {
        setActivePin(state.activePinId);
        var pin = findPin(state.activePinId);
        if (pin) { target = [pin.latitude, pin.longitude]; }
      }
      if (!target && state.focus) { target = [state.focus.latitude, state.focus.longitude]; }
      if (target) { map.flyTo(target, Math.max(map.getZoom(), 16), { duration: 0.6 }); }
      if (state.fitAll) { fitAll(); }
    },
    zoomIn: function () { map.zoomIn(); },
    zoomOut: function () { map.zoomOut(); },
    recenter: function () {
      if (areaBounds) { map.flyToBounds(areaBounds, { duration: 0.6 }); }
      else { fitAll(); }
    }
  };

  window.addEventListener('message', function (event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!data) { return; }
      if (data.type === 'amx-apply' && data.payload) { window.__mapBridge.apply(data.payload); }
      else if (data.type === 'amx-cmd' && typeof window.__mapBridge[data.payload] === 'function') { window.__mapBridge[data.payload](); }
    } catch (err) { /* ignore malformed messages */ }
  });

  renderMarkers();
  renderRoute();
  renderUser(__user);
  if (__focus) { map.setView([__focus.latitude, __focus.longitude], 16); }
  else { fitAll(); }
  postReady();
<\/script>
</body>
</html>`;
}
