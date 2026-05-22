import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useApp } from '../../contexts/AppContext';
import EmptyState from '../../components/EmptyState';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeColors, activeRadius } = useTheme();
  const { lists, removeFromList } = useApp();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const list = lists.find(l => l.id === id);

  useEffect(() => {
    if (!list || list.eventIds.length === 0) { setEvents([]); return; }
    setLoading(true);
    Promise.all(
      list.eventIds.map(eid => fetch(`${API_URL}/api/events/${eid}`).then(r => r.ok ? r.json() : null))
    ).then(results => {
      setEvents(results.filter(Boolean));
      setLoading(false);
    });
  }, [list?.eventIds.join(',')]);

  if (!list) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
        <EmptyState emoji="🔍" title="List not found" testID="list-not-found" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      <View style={[styles.header, { borderBottomColor: activeColors.border }]}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={activeColors.textMain} />
        </TouchableOpacity>
        <Text style={styles.emoji}>{list.emoji}</Text>
        <View style={styles.headerInfo}>
          <Text style={[styles.listName, { color: activeColors.textMain }]}>{list.name}</Text>
          <Text style={[styles.listCount, { color: activeColors.textMuted }]}>{list.eventIds.length} events</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={activeColors.primary} />
      ) : (
        <FlatList
          testID="list-events"
          data={events}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`list-event-${item.id}`}
              onPress={() => router.push(`/event/${item.id}`)}
              style={[styles.eventRow, { backgroundColor: activeColors.surface, borderRadius: activeRadius.lg, borderColor: activeColors.border }]}
              activeOpacity={0.85}
            >
              <Image source={{ uri: item.imageUrl }} style={[styles.eventImg, { borderRadius: activeRadius.sm }]} />
              <View style={styles.eventInfo}>
                <Text style={[styles.eventName, { color: activeColors.textMain }]} numberOfLines={2}>{item.name}</Text>
                <Text style={[styles.eventMeta, { color: activeColors.textMuted }]}>📅 {formatDate(item.date)}</Text>
                <Text style={[styles.eventMeta, { color: activeColors.textMuted }]}>📍 {item.venue}</Text>
                <Text style={[styles.eventPrice, { color: item.price === 0 ? activeColors.success : activeColors.primary }]}>{item.priceLabel}</Text>
              </View>
              <TouchableOpacity
                testID={`remove-from-list-${item.id}`}
                onPress={() => removeFromList(list.id, item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={activeColors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="📭"
              title="No events saved yet"
              subtitle="Browse events and tap the bookmark icon to save them here"
              actionLabel="Explore Events"
              onAction={() => router.replace('/(tabs)/home')}
              testID="no-list-events"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1 },
  emoji: { fontSize: 32 },
  headerInfo: { flex: 1 },
  listName: { fontSize: 20, fontWeight: '800' },
  listCount: { fontSize: 13 },
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },
  eventRow: { flexDirection: 'row', padding: 12, gap: 12, borderWidth: 1, alignItems: 'flex-start' },
  eventImg: { width: 80, height: 80 },
  eventInfo: { flex: 1, gap: 3 },
  eventName: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  eventMeta: { fontSize: 12 },
  eventPrice: { fontSize: 14, fontWeight: '800', marginTop: 2 },
});
