import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Maximize2, Minimize2, Navigation2 } from 'lucide-react';
import { LngLatBounds, Marker, type ExpressionSpecification, type MapLayerMouseEvent, type MapMouseEvent } from 'maplibre-gl';
import { useT } from '../../i18n';
import { useDialog } from '../../hooks/useDialog';
import { CloseButton, Notice } from '../ui/controls';
import { useFollowMe } from './useFollowMe';
import { escapeHtml } from '../../utils/html';
import { BusStop, RoutePlanResult, TripSegment } from '../../types';
import { LUGO_CENTER, stopById } from '../../data/transitData';
import { useRouteGeometry } from '../../data/routeGeometry';
import { WalkPaths, walkHopKey } from '../../services/walkingPath';
import { useIsDark } from '../../hooks/useIsDark';
import { useMapLibre } from '../../hooks/useMapLibre';
import { DRAW, mapColors, stopDotPaint } from './palette';
import { readerMark, type ReaderMark } from './reader';
import { claim, dropLayers, fingerReach, hoverLabels, isClaimed, placeLayer, setSource } from './mapLayers';
import { MapUnavailable } from './MapUnavailable';
import { stopNamesLayer } from './StopNames';

interface Place {
  lat: number;
  lng: number;
  name: string;
}

interface RouteMapProps {
  plan: RoutePlanResult | null;
  walkPaths?: WalkPaths;
  origin?: Place;
  destination?: Place;
  /** Index of the leg being made right now (trip companion): drawn in full and framed, the rest faint. */
  focusSegment?: number;
  /** The reader's own position, drawn and kept in view (trip companion). Left out, the map has a button that finds the reader instead. */
  position?: { lat: number; lng: number } | null;
  /** A stop tapped on the map, its dot, its name or its boarding pin. */
  onSelectStop?: (stop: BusStop) => void;
  className?: string;
}

/** Room the fit leaves around the trip: more at the top, where the "Paso a paso" chip sits, and clear of the zoom bar and the attribution. */
const FIT = {
  padding: { top: DRAW.fit.tripTop, left: DRAW.fit.trip, bottom: DRAW.fit.trip + DRAW.fit.credit, right: DRAW.fit.trip + DRAW.fit.zoomBar },
  maxZoom: 15,
  linear: true,
};
/** The same fit drawn in place: a map's first, and the one a resize puts back. */
const FIT_NOW = { ...FIT, duration: 0 };
const FAINT = DRAW.trip.faint;
const LAYERS = ['app-walks', 'app-walks-guess', 'app-legs', 'app-calls'];

/** Rough relative luminance of a #rrggbb colour, enough to pick black or white ink. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35;
}

function pinElement(color: string, label: string): HTMLElement {
  const ink = isLight(color) ? 'border-on-pale-pin text-on-pale-pin' : 'border-on-line text-on-line';
  const el = document.createElement('div');
  el.className = 'route-map-pin';
  el.innerHTML = `<div class="flex size-full items-center justify-center rounded-pill border-strong font-sans text-map-pin font-bold shadow-pin ${ink}" style="background:${escapeHtml(color)}">${escapeHtml(label)}</div>`;
  return el;
}

/** The walk segment just before bus leg `index`, skipping a wait; -1 when there is none. */
function walkBefore(segments: TripSegment[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    if (segments[i].type === 'bus') return -1;
    if (segments[i].type === 'walk') return i;
  }
  return -1;
}

type Line = GeoJSON.Feature<GeoJSON.LineString, { faint: boolean; label?: string; color?: string; width?: number }>;
const line = (path: [number, number][], properties: Line['properties']): Line => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates: path.map(([lat, lng]) => [lng, lat]) },
});
const collection = <T extends GeoJSON.Feature>(features: T[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

/**
 * A planned trip, drawn: walking legs dotted (the real pavement where the router answered,
 * a straight dashed hint where it did not), each bus leg in its line colour sliced from that
 * direction's real road geometry between the two stops it rides.
 */
export function RouteMap({ plan, origin, destination, walkPaths = {}, focusSegment, position, onSelectStop, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const colors = mapColors(useIsDark());
  const geometryReady = useRouteGeometry();
  // Turned and zoomed with the wheel like the network map: a trip is read street by street.
  const { map, styled, unavailable } = useMapLibre(containerRef, { center: LUGO_CENTER, zoom: 12, region: t.planner.routeMap, turns: true });
  /**
   * The bounds this map is meant to show, so a resize can put the view back: the map is
   * built inside a column that is `display: none` on a phone until there is a plan, and a
   * fit worked out for a box that no longer exists clipped the trip to a couple of streets.
   */
  const shownRef = useRef<LngLatBounds | null>(null);
  /** The map already framed once: another option, or the next leg on the ride, is travelled to rather than cut to (as on the board's map). */
  const framed = useRef<typeof map>(null);
  /** The map over the whole screen, for as long as the reader wants it: on a phone the card is 240 px tall. Back or Escape gives the card back. */
  const [full, setFull] = useState(false);
  const frameRef = useDialog(full, () => setFull(false));
  /** A stop tapped leaves the planner for its board, so the map gives the screen back first. */
  const choose = useRef<(stop: BusStop) => void>(() => {});
  choose.current = (stop) => {
    setFull(false);
    onSelectStop?.(stop);
  };
  // Where the reader is, found as the network map finds it; the companion passes its own fix.
  const follow = useFollowMe(map, styled, colors, () => {});

  // A new size is a new frame for the trip: grown, it stayed the size of the card in the middle of the screen.
  useEffect(() => {
    if (!map) return;
    map.resize();
    if (shownRef.current) map.fitBounds(shownRef.current, FIT_NOW);
  }, [map, full]);

  useEffect(() => {
    if (!map) return;
    const refit = () => {
      // Only when the trip has actually fallen off the map: a reader who zoomed in keeps their view.
      const want = shownRef.current;
      const view = map.getBounds();
      if (want && !(view.contains(want.getSouthWest()) && view.contains(want.getNorthEast()))) map.fitBounds(want, FIT_NOW);
    };
    map.on('resize', refit);
    return () => {
      map.off('resize', refit);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !styled || !geometryReady) return;
    const hover = hoverLabels(map);
    const markers: Marker[] = [];
    const bounds = new LngLatBounds();
    const extend = (points: [number, number][]) => points.forEach(([lat, lng]) => bounds.extend([lng, lat]));
    const walks: Line[] = [];
    const guesses: Line[] = [];
    const legs: Line[] = [];
    const calls: GeoJSON.Feature<GeoJSON.Point, { label: string; id: string }>[] = [];
    /** The stops whose names are written: where each leg boards and ends first, so a crowded spot goes to them. */
    const ends: BusStop[] = [];
    const called: BusStop[] = [];
    const boards = new Set<string>();
    /** No name over a pin: [lat, lng, radius]. */
    const pins: [number, number, number][] = [];

    // Which parts are the reader's now: the focused leg is drawn as always and framed; the
    // rest drops to a quarter opacity. A walk is focused through the bus leg it leads into.
    const segments = plan?.segments || [];
    const focused = focusSegment !== undefined && segments[focusSegment] !== undefined;
    const legIsFocused = (index: number) => !focused || index === focusSegment;
    const walkIntoIsFocused = (index: number) => !focused || walkBefore(segments, index) === focusSegment;
    const lastIndex = segments.length - 1;
    const finalWalkIsFocused = !focused || (segments[lastIndex]?.type === 'walk' && focusSegment === lastIndex);

    /** A walk drawn, and the points it covers. */
    const walk = (a: [number, number], b: [number, number], emphasised: boolean): [number, number][] => {
      const detailed = walkPaths[walkHopKey(a, b)];
      if (detailed) walks.push(line(detailed.path, { faint: !emphasised, label: escapeHtml(t.planner.walkLeg(detailed.meters, detailed.minutes)) }));
      else guesses.push(line([a, b], { faint: !emphasised }));
      return detailed ? detailed.path : [a, b];
    };
    const pin = (at: [number, number], color: string, label: string, tooltip: string, emphasised: boolean, stop?: BusStop) => {
      const el = pinElement(color, label);
      el.addEventListener('mouseenter', () => hover.show([at[1], at[0]], escapeHtml(tooltip)));
      el.addEventListener('mouseleave', () => hover.leave());
      // A boarding pin is its stop, as the dots are.
      if (stop && onSelectStop)
        el.addEventListener('click', (e) => {
          claim(e);
          choose.current(stop);
        });
      markers.push(new Marker({ element: el, opacity: String(emphasised ? 1 : FAINT) }).setLngLat([at[1], at[0]]));
      pins.push([at[0], at[1], DRAW.stopRadius.pin]);
    };

    // Walking legs join the previous point to the next known one: origin -> first stop, last stop -> destination.
    let previous: [number, number] | null = origin ? [origin.lat, origin.lng] : null;
    if (origin) {
      const firstLeg = segments.findIndex((seg) => seg.type === 'bus');
      const emphasised = firstLeg === -1 ? finalWalkIsFocused : walkIntoIsFocused(firstLeg);
      pin([origin.lat, origin.lng], colors.originPin, 'A', origin.name, emphasised);
      if (emphasised) extend([[origin.lat, origin.lng]]);
    }

    segments.forEach((segment, index) => {
      if (segment.type !== 'bus' || !segment.line || !segment.fromStop || !segment.toStop) return;
      const emphasised = legIsFocused(index);
      const direction = segment.line.directions.find((d) => d.id === segment.directionId) || segment.line.directions[0];
      const from = direction.stops.indexOf(segment.fromStop.id);
      const to = direction.stops.indexOf(segment.toStop.id);
      const start = direction.stopPathIndex?.[from];
      const end = direction.stopPathIndex?.[to];
      const slice: [number, number][] =
        start !== undefined && end !== undefined && end > start
          ? direction.pathCoordinates.slice(start, end + 1)
          : [
              [segment.fromStop.lat, segment.fromStop.lng],
              [segment.toStop.lat, segment.toStop.lng],
            ];

      if (previous) {
        const walkEmphasised = walkIntoIsFocused(index);
        const path = walk(previous, [segment.fromStop.lat, segment.fromStop.lng], walkEmphasised);
        if (walkEmphasised && focused) extend(path);
      }

      legs.push(
        line(slice, {
          faint: !emphasised,
          color: segment.line.color,
          width: emphasised ? DRAW.trip.legNow : DRAW.trip.leg,
          label: escapeHtml(t.planner.lineWithStops(segment.line.number, segment.stopsCount ?? 0)),
        }),
      );
      pin(slice[0], segment.line.color, segment.line.number.slice(0, 3), `${t.planner.board} ${segment.fromStop.name}`, emphasised, segment.fromStop);

      // Where the ride calls and where it is left, as the neutral stop dot every map uses: a dot in the line's colour on a line of that colour is a bump, not a stop.
      for (let i = from + 1; i <= to && emphasised; i++) {
        const stop = stopById(direction.stops[i]);
        if (!stop) continue;
        calls.push({ type: 'Feature', properties: { label: escapeHtml(stop.name), id: stop.id }, geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] } });
        if (i < to) called.push(stop);
      }
      if (emphasised) {
        ends.push(segment.fromStop, segment.toStop);
        boards.add(segment.fromStop.id);
      }

      if (emphasised) extend(slice);
      previous = [segment.toStop.lat, segment.toStop.lng];
    });

    if (destination) {
      const end: [number, number] = [destination.lat, destination.lng];
      if (previous) {
        const path = walk(previous, end, finalWalkIsFocused);
        if (finalWalkIsFocused) extend(path);
      }
      pin(end, colors.destinationPin, 'B', destination.name, finalWalkIsFocused);
      if (finalWalkIsFocused) extend([end]);
    }

    const opacity = (full: number): ExpressionSpecification => ['case', ['boolean', ['get', 'faint'], false], FAINT, full];
    setSource(map, 'app-walks', collection(walks));
    placeLayer(map, {
      id: 'app-walks',
      type: 'line',
      source: 'app-walks',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.walkRouted, 'line-width': DRAW.trip.walk, 'line-opacity': opacity(DRAW.trip.walkOpacity), 'line-dasharray': [...DRAW.trip.walkDots] },
    });
    setSource(map, 'app-walks-guess', collection(guesses));
    placeLayer(map, {
      id: 'app-walks-guess',
      type: 'line',
      source: 'app-walks-guess',
      paint: { 'line-color': colors.walkStraight, 'line-width': DRAW.trip.walkGuess, 'line-opacity': opacity(DRAW.trip.walkGuessOpacity), 'line-dasharray': [...DRAW.trip.walkGuessDashes] },
    });
    setSource(map, 'app-legs', collection(legs));
    placeLayer(map, {
      id: 'app-legs',
      type: 'line',
      source: 'app-legs',
      layout: { 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': opacity(DRAW.trip.legOpacity) },
    });
    setSource(map, 'app-calls', collection(calls));
    placeLayer(map, {
      id: 'app-calls',
      type: 'circle',
      source: 'app-calls',
      paint: stopDotPaint(colors, DRAW.stopRadius.overview),
    });
    for (const marker of markers) marker.addTo(map);

    // The stops named from the zoom the network map names them at; a boarding stop's name clears its pin.
    const names = stopNamesLayer(map, {
      ink: colors.nameInk,
      halo: colors.nameHalo,
      radius: DRAW.stopRadius.overview,
      radiusOf: (stop) => (boards.has(stop.id) ? DRAW.stopRadius.pin : undefined),
      onTap: onSelectStop ? (stop) => choose.current(stop) : undefined,
    });

    // The dot nearest the finger, within its reach past the dot's edge, as on the network map.
    const onClick = (e: MapMouseEvent) => {
      if (!onSelectStop || isClaimed(e)) return;
      const reach = DRAW.stopRadius.overview + DRAW.stopRing + fingerReach();
      const { x, y } = e.point;
      const away = (stop: BusStop) => {
        const p = map.project([stop.lng, stop.lat]);
        return Math.hypot(p.x - x, p.y - y);
      };
      const near = map
        .queryRenderedFeatures([[x - reach, y - reach], [x + reach, y + reach]], { layers: ['app-calls'] })
        .map((f) => stopById(String(f.properties.id)))
        .filter((stop): stop is BusStop => !!stop && away(stop) <= reach)
        .sort((a, b) => away(a) - away(b))[0];
      if (!near) return;
      claim(e);
      choose.current(near);
    };
    map.on('click', onClick);
    const named = [...new Map([...ends, ...called].map((stop) => [stop.id, stop])).values()];
    let naming: boolean | null = null;
    const nameStops = () => {
      const want = map.getZoom() >= DRAW.names.zoom;
      if (want !== naming) names.setStops((naming = want) ? named : [], pins);
    };
    nameStops();
    map.on('zoom', nameStops);

    // The routed walks, the legs and the calls name themselves under a mouse, as the pins do.
    const label = (e: MapLayerMouseEvent) =>
      hover.fromLayer(e, () => {
        const text = e.features?.[0]?.properties?.label;
        if (typeof text === 'string') hover.show(e.lngLat, text, -DRAW.tooltip.lift);
      });
    const leave = () => hover.leave();
    for (const id of ['app-walks', 'app-legs', 'app-calls']) {
      map.on('mousemove', id, label);
      map.on('mouseleave', id, leave);
    }

    if (!bounds.isEmpty()) {
      shownRef.current = bounds;
      map.fitBounds(bounds, framed.current === map ? FIT : FIT_NOW);
      framed.current = map;
    }
    return () => {
      for (const id of ['app-walks', 'app-legs', 'app-calls']) {
        map.off('mousemove', id, label);
        map.off('mouseleave', id, leave);
      }
      map.off('zoom', nameStops);
      map.off('click', onClick);
      names.remove();
      hover.remove();
      for (const marker of markers) marker.remove();
      dropLayers(map, LAYERS, LAYERS);
    };
  }, [map, styled, geometryReady, plan, walkPaths, origin?.lat, origin?.lng, destination?.lat, destination?.lng, colors, focusSegment, t]);

  // The reader, on its own marks so a fix every few seconds moves a dot instead of redrawing
  // the trip, and kept in view with the smallest pan rather than a recentre on every fix.
  const readerRef = useRef<ReaderMark | null>(null);
  useEffect(() => {
    if (!map || !styled) return;
    const reader = readerMark(map, colors);
    readerRef.current = reader;
    return () => {
      reader.remove();
      readerRef.current = null;
    };
  }, [map, styled, colors]);
  useEffect(() => {
    const reader = readerRef.current;
    if (!map || !reader) return;
    if (!position) return reader.hide();
    reader.place([position.lat, position.lng], 0);
    // Leaflet's panInside: the least move that brings the dot inside the margin.
    const p = map.project([position.lng, position.lat]);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const pad = DRAW.fit.follow;
    const dx = p.x < pad ? p.x - pad : p.x > w - pad ? p.x - (w - pad) : 0;
    const dy = p.y < pad ? p.y - pad : p.y > h - pad ? p.y - (h - pad) : 0;
    if (dx || dy) map.panBy([dx, dy]);
  }, [map, styled, colors, position?.lat, position?.lng]);

  if (unavailable) return <MapUnavailable className={className} />;
  const sizeLabel = full ? t.planner.shrinkMap : t.planner.enlargeMap;
  const LocateIcon = follow.isTurning ? Navigation2 : LocateFixed;
  return (
    <div
      ref={frameRef}
      role={full ? 'dialog' : undefined}
      aria-modal={full || undefined}
      aria-label={full ? t.planner.routeMap : undefined}
      className={full ? 'fixed inset-0 z-dialog bg-bg' : `relative ${className ?? ''}`}
    >
      {/* First, so the focus lands on it when the map takes the screen. */}
      <button type="button" onClick={() => setFull(!full)} aria-label={sizeLabel} title={sizeLabel} className="absolute right-3 top-3 z-map-float flex size-12 items-center justify-center map-glass text-ink-2 shadow-float">
        {full ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}
      </button>
      <div ref={containerRef} className="size-full" />
      {position === undefined && (
        <>
          {follow.error && (
            <div className="pointer-events-none absolute inset-x-0 bottom-20 z-map-alert px-3">
              <Notice role="alert" className="pointer-events-auto flex items-center gap-1 py-1 pr-1 shadow-raised">
                <span className="min-w-0 flex-1">{follow.error}</span>
                <CloseButton label={t.map.closePopup} onClick={() => follow.setError(null)} />
              </Notice>
            </div>
          )}
          <button
            type="button"
            onClick={follow.toggle}
            disabled={follow.isLocating}
            aria-pressed={follow.isFollowing}
            aria-label={follow.label}
            title={follow.label}
            className={`absolute bottom-5 left-3 z-map-float flex size-12 items-center justify-center map-glass shadow-float disabled:opacity-disabled ${follow.isFollowing ? 'border-accent text-accent' : 'text-ink-2'}`}
          >
            <LocateIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
