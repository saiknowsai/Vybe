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
  const [aiLoading, setAiLoading] = useState(false);

  const city = profile.city || 'London';

  const fetchEvents = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true); else setLoading(true);
    try {
      let url = `${API_URL}/api/events?city=${encodeURIComponent(city)}&limit=30&kids_mode=${kidsMode}`;
      if (category !== 'All') url += `&category=${category}`;
      if (budget !== 'any') url += `&budget=${budget}`;
      if (mode === 'book') url += `&has_tickets=true`;

      const res = await fetch(url);
      const data = await res.json();
      let list: Event[] = Array.isArray(data) ? data : [];

      // If city not in UK list and no results, trigger AI search
      if (list.length === 0 && !UK_CITIES.includes(city)) {
        setAiLoading(true);
        const aiRes = await fetch(`${API_URL}/api/ai/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city, interests: profile.interests, age_group: profile.ageGroup }),
        });
        const aiData = await aiRes.json();
        list = aiData.events || [];
        setAiLoading(false);
      }

      if (mode === 'book') {
        list = list.filter(e => e.ticketUrl);
      }
      setEvents(list);
    } catch {
      setEvents([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [city, category, budget, mode, kidsMode, profile.interests, profile.ageGroup]);

  React.useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const surpriseMe = () => {
    if (events.length === 0) return;
    const random = events[Math.floor(Math.random() * events.length)];
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
        <Text style={[styles.appName, { color: activeColors.primary }]}>NearbyEvents</Text>
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
          disabled={events.length === 0}
          style={[styles.surpriseBtn, { backgroundColor: activeColors.secondary, borderRadius: activeRadius.full }]}
        >
          <Text style={[styles.surpriseBtnText, { color: activeColors.textMain, fontSize: kidsMode ? 18 : 15 }]}>
            Surprise Me 🎲
          </Text>
        </TouchableOpacity>
        <Text style={[styles.eventCount, { color: activeColors.textMuted }]}>
          {events.length} events
        </Text>
      </View>

      {/* AI Loading indicator */}
      {aiLoading && (
        <View style={[styles.aiLoading, { backgroundColor: activeColors.surfaceHighlight }]}>
          <ActivityIndicator size="small" color={activeColors.primary} />
          <Text style={[styles.aiText, { color: activeColors.textMuted }]}>
            Finding events in {city} with AI...
          </Text>
        </View>
      )}

      {/* Events Feed */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={activeColors.primary} />
      ) : (
        <FlatList
          testID="events-list"
          data={events}
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
              subtitle={`Try changing filters or search in another city`}
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  modalInput: { padding: 12, marginBottom: 12, fontSize: 15 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  cityRowText: { flex: 1, fontSize: 16, fontWeight: '600' },
});
