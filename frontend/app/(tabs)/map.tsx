import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  SectionList, Image, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { Event } from '../../components/EventCard';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const CATEGORY_ICONS: Record<string, string> = {
  Music: '🎵', Food: '🍕', Arts: '🎨', Family: '👨‍👩‍👧',
  Sports: '⚽', Comedy: '😂', Markets: '🛒', Outdoors: '🌿',
};

const CATEGORY_COLORS: Record<string, string> = {
  Music: '#8B5CF6', Food: '#F59E0B', Arts: '#EC4899', Family: '#10B981',
  Sports: '#3B82F6', Comedy: '#F97316', Markets: '#14B8A6', Outdoors: '#84CC16',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Group events by area (venue district, derived from address) */
function groupByArea(events: Event[]): { title: string; data: Event[] }[] {
  const map: Record<string, Event[]> = {};
  events.forEach(event => {
    // Use first part of address as area label
    const parts = event.address?.split(',') ?? [];
    const area = parts.length > 1 ? parts[1].trim() : (parts[0]?.trim() || 'City Centre');
    if (!map[area]) map[area] = [];
    map[area].push(event);
  });
  return Object.entries(map)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([title, data]) => ({ title, data }));
}

export default function NearbyScreen() {
  const { activeColors, activeRadius } = useTheme();
  const { profile } = useUser();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const city = profile.city || 'London';

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/events?city=${encodeURIComponent(city)}&limit=50`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch { setEvents([]); }
    setLoading(false);
    setRefreshing(false);
  }, [city]);

  React.useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = search.trim()
    ? events.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.venue?.toLowerCase().includes(search.toLowerCase()) ||
        e.address?.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  const sections = groupByArea(filtered);

  const renderEvent = ({ item }: { item: Event }) => {
    const catColor = CATEGORY_COLORS[item.category] || activeColors.primary;
    const catIcon = CATEGORY_ICONS[item.category] || '📍';

    return (
      <TouchableOpacity
        testID={`map-event-${item.id}`}
        onPress={() => router.push(`/event/${item.id}`)}
        style={[styles.eventRow, {
          backgroundColor: activeColors.surface,
          borderRadius: activeRadius.md,
          borderColor: activeColors.border,
        }]}
        activeOpacity={0.88}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.thumb, { borderRadius: activeRadius.sm }]}
          resizeMode="cover"
        />

        <View style={styles.rowBody}>
          {/* Category chip + badges */}
          <View style={styles.chipRow}>
            <View style={[styles.catChip, { backgroundColor: catColor + '22' }]}>
              <Text style={[styles.catText, { color: catColor }]}>{catIcon} {item.category}</Text>
            </View>
            {item.isVerified && (
              <View style={[styles.verifiedChip, { backgroundColor: activeColors.primary + '22' }]}>
                <Ionicons name="checkmark-circle" size={11} color={activeColors.primary} />
                <Text style={[styles.verifiedText, { color: activeColors.primary }]}> Verified</Text>
              </View>
            )}
            {item.isTrending && <Text style={styles.trendEmoji}>🔥</Text>}
          </View>

          <Text style={[styles.eventName, { color: activeColors.textMain }]} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.metaLine}>
            <Ionicons name="calendar-outline" size={12} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: activeColors.textMuted }]}> {formatDate(item.date)}</Text>
            <Text style={[styles.dot, { color: activeColors.border }]}>  •  </Text>
            <Ionicons name="time-outline" size={12} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: activeColors.textMuted }]}> {item.time}</Text>
          </View>

          <View style={styles.metaLine}>
            <Ionicons name="location-outline" size={12} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: activeColors.textMuted }]} numberOfLines={1}> {item.venue}</Text>
          </View>

          <View style={styles.bottomLine}>
            <Text style={[
              styles.price,
              { color: item.price === 0 ? activeColors.success : activeColors.primary }
            ]}>
              {item.priceLabel}
            </Text>
            <Text style={[styles.ageTag, { color: activeColors.textMuted }]}>
              {item.ageSuitability}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string; data: Event[] } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: activeColors.background }]}>
      <View style={[styles.areaPin, { backgroundColor: activeColors.primary }]}>
        <Ionicons name="location" size={12} color="#fff" />
      </View>
      <Text style={[styles.sectionTitle, { color: activeColors.textMain }]}>{section.title}</Text>
      <View style={[styles.countBadge, { backgroundColor: activeColors.surfaceHighlight }]}>
        <Text style={[styles.countText, { color: activeColors.textMuted }]}>{section.data.length}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: activeColors.surface, borderBottomColor: activeColors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: activeColors.textMain }]}>Nearby</Text>
          <Text style={[styles.headerSub, { color: activeColors.textMuted }]}>
            {city} · {events.length} events by area
          </Text>
        </View>
        <View style={[styles.cityBadge, { backgroundColor: activeColors.primary + '22', borderRadius: activeRadius.full }]}>
          <Ionicons name="location" size={14} color={activeColors.primary} />
          <Text style={[styles.cityBadgeText, { color: activeColors.primary }]}>{city}</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: activeColors.surface, borderBottomColor: activeColors.border }]}>
        <Ionicons name="search" size={18} color={activeColors.textMuted} />
        <TextInput
          testID="area-search-input"
          value={search}
          onChangeText={setSearch}
          placeholder="Search events or venues..."
          placeholderTextColor={activeColors.textMuted}
          style={[styles.searchInput, { color: activeColors.textMain }]}
        />
        {search.length > 0 && (
          <TouchableOpacity testID="clear-search" onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={activeColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={activeColors.primary} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📍</Text>
          <Text style={[styles.emptyTitle, { color: activeColors.textMain }]}>No events found</Text>
          <Text style={[styles.emptySub, { color: activeColors.textMuted }]}>
            Try searching for another city from the Home tab
          </Text>
        </View>
      ) : (
        <SectionList
          testID="area-events-list"
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderEvent}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchEvents(true)}
              colors={[activeColors.primary]}
              tintColor={activeColors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 1 },
  cityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  cityBadgeText: { fontSize: 13, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  list: { paddingBottom: 32 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  areaPin: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  countText: { fontSize: 12, fontWeight: '700' },
  eventRow: {
    flexDirection: 'row', gap: 12, padding: 12,
    borderWidth: 1, marginHorizontal: 16, marginBottom: 10,
  },
  thumb: { width: 86, height: 86 },
  rowBody: { flex: 1, gap: 4 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  catText: { fontSize: 11, fontWeight: '700' },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  verifiedText: { fontSize: 10, fontWeight: '700' },
  trendEmoji: { fontSize: 13 },
  eventName: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  metaLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  metaText: { fontSize: 12 },
  dot: { fontSize: 12 },
  bottomLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price: { fontSize: 14, fontWeight: '800' },
  ageTag: { fontSize: 11 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
