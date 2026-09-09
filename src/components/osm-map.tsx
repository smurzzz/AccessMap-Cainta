import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

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

type Props = {
  pins?: OSM_Pin[];
  line?: OSM_Point[];
  focus?: OSM_Point;
  bounds?: OSM_Bounds;
  height?: number;
  onPinPress?: (id: string) => void;
};

const CENTER_LAT = 14.582;
const CENTER_LNG = 121.132;
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

function buildHtml(
  pins: OSM_Pin[],
  line: OSM_Point[] | undefined,
  focus: OSM_Point | undefined,
  bounds: OSM_Bounds | undefined,
): string {
  const pinsJs = JSON.stringify(
    pins.map((pin) => ({
      id: pin.id,
      lat: pin.latitude,
      lng: pin.longitude,
      title: pin.title,
      color: pin.color ?? '#059669',
    })),
  );
  const lineJs = JSON.stringify((line ?? []).map((point) => [point.latitude, point.longitude]));
  const focusJs = JSON.stringify(focus ?? null);
  const boundsJs = JSON.stringify(
    bounds
      ? {
          sw: { lat: bounds.southWest.latitude, lng: bounds.southWest.longitude },
          ne: { lat: bounds.northEast.latitude, lng: bounds.northEast.longitude },
        }
      : null,
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  .accessmap-pin { width: 20px; height: 20px; border-radius: 10px; border: 3px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var pins = ${pinsJs};
  var line = ${lineJs};
  var focus = ${focusJs};
  var maxArea = ${boundsJs};
  var map = L.map('map', { scrollWheelZoom: false }).setView([${CENTER_LAT}, ${CENTER_LNG}], 14);
  L.tileLayer('${TILE_URL}', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  if (maxArea) {
    var areaBounds = L.latLngBounds(
      L.latLng(maxArea.sw.lat, maxArea.sw.lng),
      L.latLng(maxArea.ne.lat, maxArea.ne.lng)
    );
    L.rectangle(areaBounds, {
      color: '#059669',
      weight: 2,
      dashArray: '6 4',
      fillColor: '#059669',
      fillOpacity: 0.06
    }).addTo(map);
    map.setMaxBounds(areaBounds);
    map.setMaxBoundsViscosity(0.8);
  }

  function postPin(id) {
    if (window.ReactNativeWebView && id) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', id: id }));
    }
  }

  function pinIcon(color) {
    return L.divIcon({
      className: '',
      html: '<div class="accessmap-pin" style="background:' + color + '"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -12]
    });
  }

  var bounds = [];
  pins.forEach(function (pin) {
    var marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(pin.color) }).addTo(map);
    marker.bindPopup('<b>' + pin.title + '</b>');
    marker.on('click', function () { postPin(pin.id); });
    bounds.push([pin.lat, pin.lng]);
  });

  if (line.length > 1) {
    L.polyline(line, { color: '#2563EB', weight: 5, opacity: 0.9 }).addTo(map);
    line.forEach(function (point) { bounds.push(point); });
  }

  if (focus) {
    map.setView([focus.latitude, focus.longitude], 16);
  } else if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
  } else if (maxArea) {
    map.setView(areaBounds.getCenter(), map.getBoundsZoom(areaBounds, false));
  }
</script>
</body>
</html>`;
}

export default function OSMMap({ pins = [], line, focus, bounds, height = 320, onPinPress }: Props) {
  const html = useMemo(() => buildHtml(pins, line, focus, bounds), [pins, line, focus, bounds]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (data.type === 'pin' && data.id && onPinPress) onPinPress(data.id);
    } catch {
      // ignore malformed messages from the embedded page
    }
  };

  return (
    <View style={[styles.shell, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        bounces={false}
        overScrollMode="never"
        onMessage={handleMessage}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f6f4ef',
  },
  web: {
    flex: 1,
    backgroundColor: '#f6f4ef',
  },
});