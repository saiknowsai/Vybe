import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const INTERESTS = [
  { key: 'Music', emoji: '🎵', label: 'Music' },
  { key: 'Food', emoji: '🍕', label: 'Food & Drink' },
  { key: 'Family', emoji: '👨‍👩‍👧', label: 'Family' },
  { key: 'Arts', emoji: '🎨', label: 'Arts & Culture' },
  { key: 'Sports', emoji: '⚽', label: 'Sports' },
  { key: 'Comedy', emoji: '😂', label: 'Comedy' },
  { key: 'Markets', emoji: '🛒', label: 'Markets' },
  { key: 'Outdoors', emoji: '🌿', label: 'Outdoors' },
];

export default function InterestsScreen() {
  const { activeColors, activeRadius } = useTheme();
  const { profile, updateProfile, completeOnboarding } = useUser();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : prev.length < 5 ? [...prev, key] : prev
    );
  };

  const finish = async () => {
    if (selected.length < 1) {
      Alert.alert('Pick at least 1', 'Choose at least one interest to personalise your feed.');
      return;
    }
    setLoading(true);
    await updateProfile({ interests: selected });

    // Register user profile in backend for friends discovery
    try {
      const username = `user_${profile.userId.slice(-6)}`;
      await updateProfile({ username, displayName: username });
      await fetch(`${API_URL}/api/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.userId,
          username,
          display_name: username,
          avatar_index: 0,
          city: profile.city,
        }),
      });
    } catch { /* Ignore registration errors */ }

    await completeOnboarding();
    setLoading(false);
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={activeColors.textMain} />
        </TouchableOpacity>

        {/* Step indicators */}
        <View style={styles.steps}>
          {[1, 2, 3].map(s => (
            <View key={s} style={[styles.dot, { backgroundColor: activeColors.primary }]} />
          ))}
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: activeColors.textMain }]}>What do you love? ❤️</Text>
          <Text style={[styles.subtitle, { color: activeColors.textMuted }]}>
            Pick up to 5 interests to personalise your feed
          </Text>
        </View>

        <View style={styles.grid}>
          {INTERESTS.map(item => {
            const isSelected = selected.includes(item.key);
            return (
              <TouchableOpacity
                testID={`interest-${item.key}`}
                key={item.key}
                onPress={() => toggle(item.key)}
                style={[
                  styles.card,
                  {
                    backgroundColor: isSelected ? activeColors.primary : activeColors.surface,
                    borderColor: isSelected ? activeColors.primary : activeColors.border,
                    borderRadius: activeRadius.lg,
                  }
                ]}
                activeOpacity={0.85}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={[styles.label, { color: isSelected ? '#fff' : activeColors.textMain }]}>
                  {item.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkMark}>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.countText, { color: activeColors.textMuted }]}>
          {selected.length} / 5 selected
        </Text>

        <TouchableOpacity
          testID="finish-onboarding-btn"
          onPress={finish}
          disabled={loading || selected.length === 0}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: selected.length > 0 ? activeColors.primary : activeColors.border,
              borderRadius: activeRadius.full,
            }
          ]}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Discover Events 🎉</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  back: { marginBottom: 16, padding: 4 },
  steps: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  header: { marginBottom: 28, gap: 8 },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  card: {
    width: '47%', padding: 18, borderWidth: 1.5,
    alignItems: 'center', gap: 8, position: 'relative', minHeight: 90,
  },
  emoji: { fontSize: 32 },
  label: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  checkMark: { position: 'absolute', top: 10, right: 10 },
  countText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  primaryBtn: { paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
