import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { Event } from '../../components/EventCard';
import EventMap from '../../components/EventMap';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function MapScreen() {
  const { activeColors, activeRadius } = useTheme();
  const { profile } = useUser();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const city = profile.city || 'Newcastle';

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/events returns ALL events for the city — seeded + any AI events
      // already in the DB. No new AI generation is triggered from the map view.
      const res = await fetch(`${API_URL}/api/events?city=${encodeURIComponent(city)}&limit=100`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, [city]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: activeColors.surface, borderBottomColor: activeColors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: activeColors.textMain }]}>Map View 🗺️</Text>
          <Text style={[styles.headerSub, { color: activeColors.textMuted }]}>
            {city} · {events.length} events
          </Text>
        </View>
        <View style={[styles.cityBadge, { backgroundColor: activeColors.primary + '22', borderRadius: activeRadius.full }]}>
          <Ionicons name="location" size={14} color={activeColors.primary} />
          <Text style={[styles.cityBadgeText, { color: activeColors.primary }]}>{city}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={activeColors.primary} />
          <Text style={[styles.loaderText, { color: activeColors.textMuted }]}>Loading map…</Text>
        </View>
      ) : (
        <EventMap
          events={events}
          city={city}
          onEventPress={(id) => router.push(`/event/${id}`)}
          primaryColor={activeColors.primary}
          surfaceColor={activeColors.surface}
          textColor={activeColors.textMain}
          mutedColor={activeColors.textMuted}
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
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { fontSize: 13 },
});
