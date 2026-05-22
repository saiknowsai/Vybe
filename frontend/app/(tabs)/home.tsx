import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import EventCard, { Event } from '../../components/EventCard';
import FilterBar from '../../components/FilterBar';
import EmptyState from '../../components/EmptyState';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const CATEGORIES = [
  { key: 'All', label: 'All', emoji: '✨' },
  { key: 'Music', label: 'Music', emoji: '🎵' },
  { key: 'Food', label: 'Food', emoji: '🍕' },
  { key: 'Arts', label: 'Arts', emoji: '🎨' },
  { key: 'Family', label: 'Family', emoji: '👨‍👩‍👧' },
  { key: 'Sports', label: 'Sports', emoji: '⚽' },
  { key: 'Comedy', label: 'Comedy', emoji: '😂' },
  { key: 'Markets', label: 'Markets', emoji: '🛒' },
  { key: 'Outdoors', label: 'Outdoors', emoji: '🌿' },
];

const BUDGETS = [
  { key: 'any', label: 'Any Price' },
  { key: 'free', label: 'Free' },
  { key: 'under5', label: 'Under £5' },
  { key: 'under10', label: 'Under £10' },
  { key: 'under20', label: 'Under £20' },
];

const UK_CITIES = ['Newcastle', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Edinburgh', 'Glasgow', 'Cardiff', 'Bristol'];

export default function HomeScreen() {
  const { activeColors, activeRadius, kidsMode } = useTheme();
  const { profile, updateProfile } = useUser();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('All');
  const [budget, setBudget] = useState('any');
  const [mode, setMode] = useState<'discover' | 'book'>('discover');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [aiSource, setAiSource] = useState<'ai_generated' | 'cached' | 'fallback' | null>(null);

  const city = profile.city || 'London';

  // Client-side filtering for AI-fetched events
  const applyFilters = useCallback((list: Event[]) => {
    let filtered = list;
    if (kidsMode) {
      filtered = filtered.filter(e => ['All Ages', 'Family'].includes(e.ageSuitability || ''));
    }
    if (category !== 'All') {
      filtered = filtered.filter(e => e.category === category);
    }
    if (budget !== 'any') {
      const p = (e: Event) => Number(e.price ?? 0);
      if (budget === 'free') filtered = filtered.filter(e => p(e) === 0);
      else if (budget === 'under5') filtered = filtered.filter(e => p(e) <= 5);
      else if (budget === 'under10') filtered = filtered.filter(e => p(e) <= 10);
      else if (budget === 'under20') filtered = filtered.filter(e => p(e) <= 20);
    }
    if (mode === 'book') {
      filtered = filtered.filter(e => e.ticketUrl);
    }
    return filtered;
  }, [kidsMode, category, budget, mode]);

  const fetchEvents = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true); else setLoading(true);
    setAiSource(null);
    try {
      // Primary path: AI live events (Claude with web search + 6h cache)
      const aiRes = await fetch(`${API_URL}/api/ai/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          interests: profile.interests,
          age_group: profile.ageGroup,
          force_refresh: forceRefresh,
        }),
      });
      const aiData = await aiRes.json();
      const list: Event[] = Array.isArray(aiData?.events) ? aiData.events : [];
      setAiSource(aiData?.source || null);
      setEvents(list);
    } catch {
      // Final fallback: hit cached DB endpoint
      try {
        const res = await fetch(`${API_URL}/api/events?city=${encodeURIComponent(city)}&limit=30`);
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
        setAiSource('fallback');
      } catch {
        setEvents([]);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [city, profile.interests, profile.ageGroup]);

  React.useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const displayEvents = applyFilters(events);

  const surpriseMe = () => {
    if (displayEvents.length === 0) return;
    const random = displayEvents[Math.floor(Math.random() * displayEvents.length)];
    router.push(`/event/${random.id}`);
  };

  const filteredCities = UK_CITIES.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: activeColors.surface, borderBottomColor: activeColors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity testID="city-selector" onPress={() => setShowCityPicker(true)} style={styles.cityBtn}>
            <Ionicons name="location" size={18} color={activeColors.primary} />
            <Text style={[styles.cityText, { color: activeColors.textMain }]}>{city}</Text>
            <Ionicons name="chevron-down" size={14} color={activeColors.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={[styles.appName, { color: activeColors.primary }]}>Vybe</Text>
          <Text style={[styles.tagline, { color: activeColors.textMuted }]}>Find your vybe 🎯</Text>
        </View>
        <View style={styles.headerRight}>
          {kidsMode && <Text style={styles.kidsTag}>KIDS</Text>}
        </View>
      </View>

      {/* Discover / Book Tickets toggle */}
      <View style={[styles.toggleRow, { backgroundColor: activeColors.surface }]}>
        {(['discover', 'book'] as const).map(m => (
          <TouchableOpacity
            testID={`mode-${m}`}
            key={m}
            onPress={() => setMode(m)}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: mode === m ? activeColors.primary : 'transparent',
                borderRadius: activeRadius.full,
              }
            ]}
          >
            <Text style={[styles.toggleText, { color: mode === m ? '#fff' : activeColors.textMuted }]}>
              {m === 'discover' ? '🔍 Discover' : '🎟️ Book Tickets'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Filters */}
      <FilterBar
        items={CATEGORIES.filter(c => kidsMode ? ['All', 'Family', 'Outdoors', 'Markets'].includes(c.key) : true)}
        active={category}
        onSelect={setCategory}
        testIDPrefix="cat"
      />

      {/* Budget Filters */}
      <FilterBar items={BUDGETS} active={budget} onSelect={setBudget} testIDPrefix="budget" />

      {/* Surprise Me Button */}
      <View style={styles.surpriseRow}>
        <TouchableOpacity
          testID="surprise-me-btn"
          onPress={surpriseMe}
          disabled={displayEvents.length === 0}
          style={[styles.surpriseBtn, { backgroundColor: activeColors.secondary, borderRadius: activeRadius.full }]}
        >
          <Text style={[styles.surpriseBtnText, { color: activeColors.textMain, fontSize: kidsMode ? 18 : 15 }]}>
            Surprise Me 🎲
          </Text>
        </TouchableOpacity>
        <Text style={[styles.eventCount, { color: activeColors.textMuted }]}>
          {displayEvents.length} events{aiSource === 'cached' ? ' · cached' : aiSource === 'ai_generated' ? ' · live ✨' : ''}
        </Text>
      </View>

      {/* Events Feed */}
      {loading ? (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.aiBanner, { backgroundColor: activeColors.surfaceHighlight, borderRadius: activeRadius.md }]}>
            <ActivityIndicator size="small" color={activeColors.primary} />
            <Text style={[styles.aiBannerText, { color: activeColors.textMain }]} numberOfLines={1}>
              Finding your vybe in {city}… 🎯
            </Text>
          </View>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[styles.skeleton, { backgroundColor: activeColors.surface, borderRadius: activeRadius.lg, borderColor: activeColors.border }]}
            >
              <View style={[styles.skelImg, { backgroundColor: activeColors.surfaceHighlight }]} />
              <View style={styles.skelBody}>
                <View style={[styles.skelLine, { backgroundColor: activeColors.surfaceHighlight, width: '80%' }]} />
                <View style={[styles.skelLine, { backgroundColor: activeColors.surfaceHighlight, width: '60%', height: 10 }]} />
                <View style={styles.skelRow}>
                  <View style={[styles.skelChip, { backgroundColor: activeColors.surfaceHighlight }]} />
                  <View style={[styles.skelChip, { backgroundColor: activeColors.surfaceHighlight, width: 80 }]} />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          testID="events-list"
          data={displayEvents}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => router.push(`/event/${item.id}`)}
              showBookNow={mode === 'book'}
              onBookNow={() => {
                if (item.ticketUrl) {
                  const { Linking } = require('react-native');
                  Linking.openURL(item.ticketUrl);
                }
              }}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchEvents(true)} colors={[activeColors.primary]} tintColor={activeColors.primary} />}
          ListEmptyComponent={
            <EmptyState
              emoji={kidsMode ? '🎈' : '🔍'}
              title={kidsMode ? "No kid-friendly events found" : "No events found"}
              subtitle={`Try changing filters or pull down to refresh`}
              testID="no-events"
            />
          }
        />
      )}

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCityPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: activeColors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: activeColors.border }]} />
            <Text style={[styles.modalTitle, { color: activeColors.textMain }]}>Select City</Text>
            <TextInput
              testID="city-search-input"
              value={citySearch}
              onChangeText={setCitySearch}
              placeholder="Search any city worldwide..."
              placeholderTextColor={activeColors.textMuted}
              style={[styles.modalInput, { backgroundColor: activeColors.surfaceHighlight, color: activeColors.textMain, borderRadius: activeRadius.md }]}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredCities.map(c => (
                <TouchableOpacity
                  testID={`select-city-${c}`}
                  key={c}
                  onPress={async () => {
                    await updateProfile({ city: c });
                    setShowCityPicker(false);
                    setCitySearch('');
                  }}
                  style={[styles.cityRow, { borderBottomColor: activeColors.border }]}
                >
                  <Ionicons name="location-outline" size={18} color={activeColors.primary} />
                  <Text style={[styles.cityRowText, { color: activeColors.textMain }]}>{c}</Text>
                  {c === city && <Ionicons name="checkmark" size={18} color={activeColors.primary} />}
                </TouchableOpacity>
              ))}
              {citySearch.trim() && !UK_CITIES.some(c => c.toLowerCase() === citySearch.toLowerCase()) && (
                <TouchableOpacity
                  testID="custom-city-btn"
                  onPress={async () => {
                    await updateProfile({ city: citySearch.trim() });
                    setShowCityPicker(false);
                    setCitySearch('');
                  }}
                  style={[styles.cityRow, { borderBottomColor: activeColors.border }]}
                >
                  <Ionicons name="search" size={18} color={activeColors.primary} />
                  <Text style={[styles.cityRowText, { color: activeColors.primary }]}>Search "{citySearch}" with AI</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  headerLeft: { flex: 1 },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  cityBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cityText: { fontSize: 15, fontWeight: '700', maxWidth: 100 },
  appName: { fontSize: 18, fontWeight: '900' },
  kidsTag: { backgroundColor: '#FF5A5F', color: '#fff', fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  toggleRow: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8, padding: 4, borderRadius: 9999 },
  toggleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  toggleText: { fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  surpriseRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  surpriseBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  surpriseBtnText: { fontWeight: '800' },
  eventCount: { fontSize: 13 },
  aiLoading: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 10, borderRadius: 8, gap: 8, marginBottom: 8 },
  aiText: { fontSize: 13 },
  aiBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, marginBottom: 12 },
  aiBannerText: { fontSize: 14, fontWeight: '700', flex: 1 },
  skeleton: { borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  skelImg: { width: '100%', height: 140 },
  skelBody: { padding: 14, gap: 8 },
  skelLine: { height: 14, borderRadius: 4 },
  skelRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  skelChip: { width: 60, height: 20, borderRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  modalInput: { padding: 12, marginBottom: 12, fontSize: 15 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  cityRowText: { flex: 1, fontSize: 16, fontWeight: '600' },
});
