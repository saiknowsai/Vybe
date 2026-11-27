import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';

const UK_CITIES = ['Newcastle', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Edinburgh', 'Glasgow', 'Cardiff', 'Bristol'];

export default function OnboardingWelcome() {
  const { activeColors, activeRadius } = useTheme();
  const { updateProfile } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [manualCity, setManualCity] = useState('');
  const [showManual, setShowManual] = useState(false);

  const detectLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'No worries! You can select your city manually.');
        setShowManual(true);
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const city = geo[0]?.city || geo[0]?.subregion || 'Newcastle';
      await updateProfile({ city });
      router.push('/onboarding/age');
    } catch {
      Alert.alert('Could not detect location', 'Please select your city manually.');
      setShowManual(true);
    }
    setLoading(false);
  };

  const selectCity = async (city: string) => {
    await updateProfile({ city });
    router.push('/onboarding/age');
  };

  const submitManual = async () => {
    const city = manualCity.trim() || 'Newcastle';
    await updateProfile({ city });
    router.push('/onboarding/age');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: activeColors.primary }]}>
              <Ionicons name="location" size={48} color="#fff" />
            </View>
            <Text style={[styles.title, { color: activeColors.textMain }]}>Vybe</Text>
            <Text style={[styles.subtitle, { color: activeColors.textMuted }]}>
              Discover amazing events happening near you
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.steps}>
            {[1, 2, 3].map(s => (
              <View key={s} style={[styles.dot, { backgroundColor: s === 1 ? activeColors.primary : activeColors.border }]} />
            ))}
          </View>

          <Text style={[styles.stepTitle, { color: activeColors.textMain }]}>Where are you?</Text>
          <Text style={[styles.stepSub, { color: activeColors.textMuted }]}>
            We'll find events in your city
          </Text>

          {/* Auto-detect button */}
          <TouchableOpacity
            testID="detect-location-btn"
            onPress={detectLocation}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: activeColors.primary, borderRadius: activeRadius.full }]}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="navigate" size={20} color="#fff" /><Text style={styles.primaryBtnText}> Detect My Location</Text></>
            }
          </TouchableOpacity>

          <TouchableOpacity testID="manual-city-btn" onPress={() => setShowManual(!showManual)} style={styles.textLink}>
            <Text style={[styles.textLinkText, { color: activeColors.primary }]}>
              {showManual ? 'Hide' : 'Choose my city instead'}
            </Text>
          </TouchableOpacity>

          {showManual && (
            <View style={styles.manualSection}>
              {/* Quick UK cities */}
              <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>Popular UK cities</Text>
              <View style={styles.cityGrid}>
                {UK_CITIES.map(city => (
                  <TouchableOpacity
                    testID={`city-${city}`}
                    key={city}
                    onPress={() => selectCity(city)}
                    style={[styles.cityChip, { backgroundColor: activeColors.surfaceHighlight, borderRadius: activeRadius.md, borderColor: activeColors.border }]}
                  >
                    <Text style={[styles.cityChipText, { color: activeColors.textMain }]}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Other city input */}
              <Text style={[styles.sectionLabel, { color: activeColors.textMuted, marginTop: 16 }]}>Or type any city</Text>
              <TextInput
                testID="city-input"
                value={manualCity}
                onChangeText={setManualCity}
                placeholder="e.g. Paris, New York..."
                placeholderTextColor={activeColors.textMuted}
                style={[styles.input, { backgroundColor: activeColors.surfaceHighlight, borderColor: activeColors.border, color: activeColors.textMain, borderRadius: activeRadius.md }]}
                returnKeyType="done"
                onSubmitEditing={submitManual}
              />
              <TouchableOpacity
                testID="submit-city-btn"
                onPress={submitManual}
                style={[styles.primaryBtn, { backgroundColor: activeColors.secondary, borderRadius: activeRadius.full, marginTop: 8 }]}
              >
                <Text style={[styles.primaryBtnText, { color: activeColors.textMain }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20, alignItems: 'stretch' },
  header: { alignItems: 'center', marginBottom: 32, gap: 12 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  stepSub: { fontSize: 15, marginBottom: 24 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  textLink: { alignSelf: 'center', paddingVertical: 8 },
  textLinkText: { fontSize: 15, fontWeight: '600' },
  manualSection: { marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityChip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  cityChipText: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, padding: 14, fontSize: 16 },
});
