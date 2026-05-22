/**
 * Web-only Leaflet map. Metro resolves this file when bundling for `web`.
 * Native platforms get `EventMap.tsx` (area-grouped list) instead.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Event } from './EventCard';

// Inject Leaflet CSS once via document.head — avoids Metro CSS-import quirks
const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
function ensureLeafletCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_HREF;
  document.head.appendChild(link);

  // Inline override so popups + container look polished
  const style = document.createElement('style');
  style.id = 'leaflet-overrides';
  style.textContent = `
    .leaflet-container { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; border-radius: 16px; }
    .leaflet-popup-content-wrapper { border-radius: 12px; }
    .leaflet-popup-content { margin: 10px 12px; min-width: 200px; }
    .vybe-marker-emoji {
      display:flex; align-items:center; justify-content:center;
      width:40px; height:40px; border-radius:20px;
      background:#fff; border:2px solid #FF7A00;
      box-shadow:0 2px 8px rgba(0,0,0,0.18); font-size:20px;
    }
    .vybe-popup-title { font-size: 14px; font-weight: 800; color: #1a1a1a; margin-bottom: 4px; }
    .vybe-popup-meta { font-size: 11px; color: #6b6b6b; margin-bottom: 6px; }
    .vybe-popup-btn {
      display: inline-block; background: #FF7A00; color: #fff;
      padding: 6px 12px; border-radius: 16px; font-size: 12px;
      font-weight: 700; cursor: pointer; text-decoration: none;
      border: none; width: 100%;
    }
  `;
  document.head.appendChild(style);
}

const CATEGORY_EMOJI: Record<string, string> = {
  Music: '🎵', Food: '🍕', Arts: '🎨', Family: '👨‍👩‍👧',
  Sports: '⚽', Comedy: '😂', Markets: '🛒', Outdoors: '🌿',
};

const buildIcon = (category: string) => {
  const emoji = CATEGORY_EMOJI[category] || '📍';
  return L.divIcon({
    className: 'vybe-marker',
    html: `<div class="vybe-marker-emoji">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -16],
  });
};

/** Fit the map bounds to all event markers whenever the events list changes */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

interface Props {
  events: Event[];
  city: string;
  onEventPress: (id: string) => void;
  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
}

export default function EventMap({
  events,
  city,
  onEventPress,
  primaryColor,
  surfaceColor,
  textColor,
  mutedColor,
}: Props) {
  useEffect(() => { ensureLeafletCss(); }, []);

  // Default center per known city; otherwise UK average centre
  const defaultCenter = useMemo<[number, number]>(() => {
    const FALLBACK: Record<string, [number, number]> = {
      London: [51.5074, -0.1278], Manchester: [53.4808, -2.2426],
      Birmingham: [52.4862, -1.8904], Leeds: [53.8008, -1.5491],
      Newcastle: [54.9783, -1.6178], Liverpool: [53.4084, -2.9916],
      Edinburgh: [55.9533, -3.1883], Glasgow: [55.8642, -4.2518],
      Bristol: [51.4545, -2.5879], Cardiff: [51.4816, -3.1791],
    };
    return FALLBACK[city] || [54.5, -2.5];
  }, [city]);

  // Only events with valid coords
  const mapped = useMemo(
    () =>
      events
        .filter(e => typeof e.lat === 'number' && typeof e.lng === 'number')
        .map(e => ({ ...e, _pt: [e.lat!, e.lng!] as [number, number] })),
    [events]
  );

  const points = useMemo(() => mapped.map(e => e._pt), [mapped]);

  return (
    <View style={styles.wrap}>
      {/* Map itself */}
      <View style={styles.mapBox}>
        {/*
          // @ts-ignore react-leaflet emits DOM elements; React Native Web
          renders Views as div, so embedding native DOM children inside is fine
          on web.
        */}
        <MapContainer
          // @ts-ignore
          center={defaultCenter}
          zoom={12}
          style={{ height: '100%', width: '100%', borderRadius: 16 }}
          scrollWheelZoom
        >
          <TileLayer
            // @ts-ignore
            attribution='&copy; OpenStreetMap'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.length > 0 && <FitBounds points={points} />}
          {mapped.map(e => (
            <Marker
              key={e.id}
              position={e._pt}
              // @ts-ignore
              icon={buildIcon(e.category)}
            >
              <Popup>
                <div className="vybe-popup-title">{e.name}</div>
                <div className="vybe-popup-meta">
                  📍 {e.venue} · 📅 {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
                <div className="vybe-popup-meta">
                  💷 {e.priceLabel || (e.price === 0 ? 'Free' : `£${e.price}`)}
                </div>
                <button
                  className="vybe-popup-btn"
                  onClick={() => onEventPress(e.id)}
                >
                  View Event →
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </View>

      {/* Bottom horizontal scroll of all events */}
      <View style={[styles.list, { backgroundColor: surfaceColor }]}>
        <Text style={[styles.listTitle, { color: textColor }]}>
          📍 {mapped.length} events on map
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listScroll}>
          {mapped.map(e => (
            <TouchableOpacity
              key={e.id}
              testID={`map-card-${e.id}`}
              onPress={() => onEventPress(e.id)}
              style={[styles.card, { backgroundColor: surfaceColor, borderColor: primaryColor + '33' }]}
              activeOpacity={0.85}
            >
              <Image source={{ uri: e.imageUrl }} style={styles.cardImg} resizeMode="cover" />
              <View style={styles.cardBody}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: textColor }]}>{e.name}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="location-outline" size={11} color={mutedColor} />
                  <Text numberOfLines={1} style={[styles.cardMetaText, { color: mutedColor }]}>{e.venue}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Ionicons name="calendar-outline" size={11} color={mutedColor} />
                  <Text style={[styles.cardMetaText, { color: mutedColor }]}>
                    {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Text style={[styles.cardPrice, { color: e.price === 0 ? '#10B981' : primaryColor }]}>
                  {e.priceLabel || (e.price === 0 ? 'Free' : `£${e.price}`)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  mapBox: { flex: 1, marginHorizontal: 8, marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  list: { paddingTop: 12, paddingBottom: 8 },
  listTitle: { fontSize: 14, fontWeight: '800', paddingHorizontal: 16, marginBottom: 8 },
  listScroll: { paddingHorizontal: 12, gap: 10 },
  card: { width: 220, borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginRight: 10 },
  cardImg: { width: '100%', height: 90 },
  cardBody: { padding: 10, gap: 4 },
  cardTitle: { fontSize: 13, fontWeight: '800' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 11, flex: 1 },
  cardPrice: { fontSize: 13, fontWeight: '800', marginTop: 2 },
});
