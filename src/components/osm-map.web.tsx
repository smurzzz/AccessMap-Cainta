import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, type CSSProperties } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildMapHtml, type OSM_Bounds, type OSM_Pin, type OSM_Point } from './osm-map-html';

export type { OSM_Bounds, OSM_Pin, OSM_Point } from './osm-map-html';

export type OSMMapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
};

type Props = {
  pins?: OSM_Pin[];
  line?: OSM_Point[];
  focus?: OSM_Point;
  bounds?: OSM_Bounds;
  activePinId?: string | null;
  userLocation?: OSM_Point | null;
  height?: number;
  onPinPress?: (id: string) => void;
};

type MapUpdate = {
  pins: OSM_Pin[];
  line: OSM_Point[];
  activePinId?: string | null;
  userLocation?: OSM_Point | null;
  focus?: OSM_Point | null;
};

const OSMMapWeb = forwardRef<OSMMapHandle, Props>(function OSMMapWeb(
  { pins = [], line, focus, bounds, activePinId, userLocation, height = 320, onPinPress },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const lastSentRef = useRef<string>('');

  const html = useMemo(
    () =>
      buildMapHtml({
        pins,
        line: line ?? [],
        focus: focus ?? null,
        bounds: bounds ?? null,
        activePinId: activePinId ?? null,
        userLocation: userLocation ?? null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const post = useCallback((payload: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'amx-apply', payload }), '*');
  }, []);

  const postCommand = useCallback((command: 'zoomIn' | 'zoomOut' | 'recenter') => {
    if (!readyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'amx-cmd', payload: command }), '*');
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => postCommand('zoomIn'),
    zoomOut: () => postCommand('zoomOut'),
    recenter: () => postCommand('recenter'),
  }), [postCommand]);

  useEffect(() => {
    const payload: MapUpdate = {
      pins,
      line: line ?? [],
      activePinId: activePinId ?? null,
      userLocation: userLocation ?? null,
      focus: focus ?? null,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSentRef.current) return;
    lastSentRef.current = serialized;
    if (!readyRef.current) {
      pendingRef.current = serialized;
      return;
    }
    post(payload);
  }, [pins, line, focus, bounds, activePinId, userLocation, post]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}') as {
          type?: string;
          id?: string;
        };
        if (data.type === 'pin' && data.id && onPinPress) onPinPress(data.id);
        else if (data.type === 'ready') {
          readyRef.current = true;
          const pending = pendingRef.current;
          pendingRef.current = null;
          if (pending) {
            try {
              post(JSON.parse(pending) as MapUpdate);
            } catch {
              // ignore malformed pending payload
            }
          }
        }
      } catch {
        // ignore malformed messages
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPinPress, post]);

  const iframeStyle: CSSProperties = {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  };

  return (
    <View style={[styles.shell, { height }]}>
      <iframe
        ref={iframeRef}
        title="AccessMap"
        srcDoc={html}
        style={iframeStyle}
        allowFullScreen
      />
    </View>
  );
});

export default OSMMapWeb;

const styles = StyleSheet.create({
  shell: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#eff4ff',
  },
});
