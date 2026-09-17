import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMapHtml, type OSM_Bounds, type OSM_Pin, type OSM_Point } from './osm-map-html';

export type { OSM_Bounds, OSM_Pin, OSM_Point } from './osm-map-html';

export type OSMMapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
  /** Fly to a pin and mark it active (Google-Maps-style selection). `offsetY` shifts the camera so the pin sits above bottom UI. */
  focusPin: (id: string, offsetY?: number) => void;
};

type MapCommand = 'zoomIn' | 'zoomOut' | 'recenter' | 'focusPin';

type QueuedCommand = { command: MapCommand; args: (string | number)[] };

type Props = {
  pins?: OSM_Pin[];
  line?: OSM_Point[];
  focus?: OSM_Point;
  bounds?: OSM_Bounds;
  activePinId?: string | null;
  userLocation?: OSM_Point | null;
  /** Vertical camera offset (px) so the focused pin sits above bottom UI, Google-Maps-style. */
  focusOffsetY?: number;
  height?: number;
  onPinPress?: (id: string) => void;
};

/** The data subset that can change after mount and flows through the bridge. */
type MapUpdate = {
  pins: OSM_Pin[];
  line: OSM_Point[];
  activePinId?: string | null;
  userLocation?: OSM_Point | null;
  focus?: OSM_Point | null;
};

const OSMMap = forwardRef<OSMMapHandle, Props>(function OSMMap(
  { pins = [], line, focus, bounds, activePinId, userLocation, focusOffsetY, height = 320, onPinPress },
  ref,
) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const lastSentRef = useRef<string>('');
  // Commands fired before the embedded page announces itself are replayed on ready.
  const commandQueueRef = useRef<QueuedCommand[]>([]);

  // The HTML is built once per mount; everything after goes through the bridge — no reloads.
  const html = useMemo(
    () =>
      buildMapHtml({
        pins,
        line: line ?? [],
        focus: focus ?? null,
        bounds: bounds ?? null,
        activePinId: activePinId ?? null,
        userLocation: userLocation ?? null,
        focusOffsetY: focusOffsetY ?? null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const injectUpdate = useCallback((payload: MapUpdate) => {
    const script = `window.__mapBridge.apply(${JSON.stringify(payload)}); true;`;
    webviewRef.current?.injectJavaScript(script);
  }, []);

  const injectCommand = useCallback((command: MapCommand, args: (string | number)[] = []) => {
    if (!readyRef.current) {
      commandQueueRef.current.push({ command, args });
      return;
    }
    // JSON.stringify([...]).slice(1, -1) yields safe literals: `"pin-1"` for strings, `1` for numbers.
    const argsSuffix = args.length > 0 ? JSON.stringify(args).slice(1, -1) : '';
    webviewRef.current?.injectJavaScript(`window.__mapBridge.${command}(${argsSuffix}); true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => injectCommand('zoomIn'),
    zoomOut: () => injectCommand('zoomOut'),
    recenter: () => injectCommand('recenter'),
    focusPin: (id: string, offsetY?: number) =>
      injectCommand('focusPin', offsetY != null ? [id, offsetY] : [id]),
  }), [injectCommand]);

  // Diff current props against what the map already has; push changes over the bridge.
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
    injectUpdate(payload);
  }, [pins, line, focus, bounds, activePinId, userLocation, injectUpdate]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
        if (data.type === 'pin' && data.id && onPinPress) onPinPress(data.id);
        else if (data.type === 'ready') {
          readyRef.current = true;
          const pending = pendingRef.current;
          pendingRef.current = null;
          if (pending) {
            try {
              injectUpdate(JSON.parse(pending) as MapUpdate);
            } catch {
              // ignore malformed pending payload
            }
          }
          const queued = commandQueueRef.current;
          commandQueueRef.current = [];
          for (const { command, args } of queued) injectCommand(command, args);
        }
      } catch {
        // ignore malformed messages from the embedded page
      }
    },
    [onPinPress, injectUpdate, injectCommand],
  );

  return (
    <View style={[styles.shell, { height }]}>
      <WebView
        ref={webviewRef}
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
});

export default OSMMap;

const styles = StyleSheet.create({
  shell: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#eff4ff',
  },
  web: {
    flex: 1,
    backgroundColor: '#eff4ff',
  },
});
