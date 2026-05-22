import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';

const AGE_GROUPS = [
  { key: 'under18', label: 'Under 18', emoji: '🧒', desc: 'Teen & youth events' },
  { key: 'adult_18_25', label: '18-25', emoji: '🎓', desc: 'Student & young adult events' },
  { key: 'adult_26_35', label: '26-35', emoji: '🚀', desc: 'Millennial-friendly events' },
  { key: 'adult_36_50', label: '36-50', emoji: '💼', desc: 'Family & professional events' },
  { key: 'adult_50plus', label: '50+', emoji: '🌿', desc: 'Relaxed & cultural events' },
  { key: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦', desc: 'Events for all the family' },
];

export default function AgeScreen() {
  const { activeColors, activeRadius } = useTheme();
  const { updateProfile } = useUser();
  const router = useRouter();
  const [selected, setSelected] = useState('');

  const handleSelect = async (key: string) => {
    setSelected(key);
    await updateProfile({ ageGroup: key });
    setTimeout(() => router.push('/onboarding/interests'), 300);
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
            <View key={s} style={[styles.dot, { backgroundColor: s <= 2 ? activeColors.primary : activeColors.border }]} />
          ))}
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: activeColors.textMain }]}>How old are you? 🎂</Text>
          <Text style={[styles.subtitle, { color: activeColors.textMuted }]}>
            We'll personalise your event recommendations
          </Text>
        </View>

        <View style={styles.grid}>
          {AGE_GROUPS.map(ag => {
            const isSelected = selected === ag.key;
            return (
              <TouchableOpacity
                testID={`age-${ag.key}`}
                key={ag.key}
                onPress={() => handleSelect(ag.key)}
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
                <Text style={styles.emoji}>{ag.emoji}</Text>
                <Text style={[styles.label, { color: isSelected ? '#fff' : activeColors.textMain }]}>{ag.label}</Text>
                <Text style={[styles.desc, { color: isSelected ? 'rgba(255,255,255,0.85)' : activeColors.textMuted }]}>
                  {ag.desc}
                </Text>
                {isSelected && (
                  <View style={styles.checkMark}>
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', padding: 16, borderWidth: 1.5,
    gap: 4, position: 'relative', minHeight: 100,
  },
  emoji: { fontSize: 28 },
  label: { fontSize: 17, fontWeight: '800' },
  desc: { fontSize: 12, lineHeight: 17 },
  checkMark: { position: 'absolute', top: 12, right: 12 },
});
