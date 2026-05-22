/**
 * Native fallback for the Leaflet map.
 * Native platforms cannot run react-leaflet (it requires the DOM), so we
 * show an area-grouped list and tell the user to use the web preview for
 * the interactive map.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SectionList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Event } from './EventCard';

interface Props {
  events: Event[];
  city: string;
  onEventPress: (id: string) => void;
  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
}

function groupByArea(events: Event[]) {
  const map: Record<string, Event[]> = {};
  events.forEach(e => {
    const parts = e.address?.split(',') ?? [];
    const area = parts.length > 1 ? parts[1].trim() : (parts[0]?.trim() || 'City Centre');
    if (!map[area]) map[area] = [];
    map[area].push(e);
  });
  return Object.entries(map)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([title, data]) => ({ title, data }));
}

export default function EventMap({ events, city, onEventPress, primaryColor, surfaceColor, textColor, mutedColor }: Props) {
  const sections = groupByArea(events);

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.banner, { backgroundColor: primaryColor + '11' }]}>
        <Ionicons name="information-circle" size={18} color={primaryColor} />
        <Text style={[styles.bannerText, { color: textColor }]}>
          Open Vybe in your browser for the interactive map view 🗺️
        </Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={[styles.areaPin, { backgroundColor: primaryColor }]}>
              <Ionicons name="location" size={12} color="#fff" />
            </View>
            <Text style={[styles.sectionTitle, { color: textColor }]}>{section.title}</Text>
            <Text style={[styles.sectionCount, { color: mutedColor }]}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onEventPress(item.id)}
            style={[styles.row, { backgroundColor: surfaceColor, borderColor: primaryColor + '22' }]}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={2} style={[styles.title, { color: textColor }]}>{item.name}</Text>
              <Text numberOfLines={1} style={[styles.meta, { color: mutedColor }]}>📍 {item.venue}</Text>
              <Text style={[styles.price, { color: primaryColor }]}>{item.priceLabel}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12 },
  bannerText: { fontSize: 13, flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  areaPin: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, padding: 10, marginBottom: 10, borderRadius: 12, borderWidth: 1 },
  thumb: { width: 70, height: 70, borderRadius: 8 },
  title: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 12 },
  price: { fontSize: 13, fontWeight: '800', marginTop: 2 },
});
