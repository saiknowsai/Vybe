import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { THEMES, ThemeName } from '../../constants/themes';

const AVATARS = ['🧑', '👩', '🧔', '👱', '🧕', '👨‍🦱', '🧑‍🦰', '👩‍🦳', '👨‍🦳', '🧑‍🤝‍🧑', '🦸', '🧙'];

const BADGES = [
  { id: 'explorer', emoji: '🧭', label: 'Explorer', desc: '5 different event types' },
  { id: 'local_hero', emoji: '🏙️', label: 'Local Hero', desc: '10 events in home city' },
  { id: 'social_butterfly', emoji: '🦋', label: 'Social Butterfly', desc: 'Invited 3 friends' },
  { id: 'foodie', emoji: '🍕', label: 'Foodie', desc: 'Attended 5 food events' },
  { id: 'night_owl', emoji: '🦉', label: 'Night Owl', desc: '5 evening events' },
];

export default function ProfileScreen() {
  const { activeColors, activeRadius, themeName, kidsMode, setTheme, toggleKidsMode } = useTheme();
  const { profile, updateProfile } = useUser();

  const [editMode, setEditMode] = useState(false);
  const [draftName, setDraftName] = useState(profile.displayName || profile.username);
  const [draftBio, setDraftBio] = useState(profile.bio);
  const [draftCity, setDraftCity] = useState(profile.city);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  const saveProfile = async () => {
    await updateProfile({ displayName: draftName, bio: draftBio, city: draftCity });
    // Sync display name to backend
    try {
      await fetch(`${API_URL}/api/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.userId,
          username: profile.username,
          display_name: draftName,
          avatar_index: profile.avatarIndex,
          city: draftCity,
          bio: draftBio,
        }),
      });
    } catch {}
    setEditMode(false);
  };

  const earnedBadges = profile.badges || [];
  const goingCount = profile.goingEvents?.length || 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: activeColors.surface, borderBottomColor: activeColors.border }]}>
          <Text style={[styles.headerTitle, { color: activeColors.textMain }]}>Profile</Text>
          <TouchableOpacity
            testID="edit-profile-btn"
            onPress={() => editMode ? saveProfile() : setEditMode(true)}
            style={[styles.editBtn, { borderColor: activeColors.primary, borderRadius: activeRadius.full }]}
          >
            <Text style={[styles.editBtnText, { color: activeColors.primary }]}>
              {editMode ? 'Save' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Avatar + Info */}
        <View style={[styles.profileSection, { backgroundColor: activeColors.surface }]}>
          <TouchableOpacity testID="avatar-picker-btn" onPress={() => setShowAvatarPicker(true)}>
            <View style={[styles.avatarCircle, { backgroundColor: activeColors.surfaceHighlight, borderColor: activeColors.primary }]}>
              <Text style={styles.avatarEmoji}>{AVATARS[profile.avatarIndex || 0]}</Text>
            </View>
            <View style={[styles.avatarBadge, { backgroundColor: activeColors.primary }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          {editMode ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TextInput
                testID="edit-displayname-input"
                value={draftName}
                onChangeText={setDraftName}
                style={[styles.editInput, { color: activeColors.textMain, borderBottomColor: activeColors.primary }]}
                placeholder="Display Name"
                placeholderTextColor={activeColors.textMuted}
              />
              <TextInput
                testID="edit-city-input"
                value={draftCity}
                onChangeText={setDraftCity}
                style={[styles.editInput, { color: activeColors.textMain, borderBottomColor: activeColors.border }]}
                placeholder="City"
                placeholderTextColor={activeColors.textMuted}
              />
              <TextInput
                testID="edit-bio-input"
                value={draftBio}
                onChangeText={setDraftBio}
                multiline
                style={[styles.editInput, { color: activeColors.textMain, borderBottomColor: activeColors.border }]}
                placeholder="Bio (optional)"
                placeholderTextColor={activeColors.textMuted}
              />
            </KeyboardAvoidingView>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={[styles.displayName, { color: activeColors.textMain }]}>
                {profile.displayName || profile.username || 'Anonymous'}
              </Text>
              {profile.username && !profile.username.startsWith('user_') && (
                <Text style={[styles.username, { color: activeColors.textMuted }]}>@{profile.username}</Text>
              )}
              <Text style={[styles.cityText, { color: activeColors.textMuted }]}>
                📍 {profile.city || 'Set your city'}
              </Text>
              {profile.bio ? <Text style={[styles.bio, { color: activeColors.textMuted }]}>{profile.bio}</Text> : null}
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: activeColors.surface, borderTopColor: activeColors.border, borderBottomColor: activeColors.border }]}>
          {[
            { label: 'Going', value: goingCount, icon: '🎟️' },
            { label: 'Interests', value: profile.interests?.length || 0, icon: '❤️' },
            { label: 'Badges', value: earnedBadges.length, icon: '🏆' },
          ].map(stat => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statEmoji}>{stat.icon}</Text>
              <Text style={[styles.statValue, { color: activeColors.textMain }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: activeColors.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: activeColors.textMain }]}>Badges</Text>
          <View style={styles.badgesGrid}>
            {BADGES.map(badge => {
              const earned = earnedBadges.includes(badge.id);
              return (
                <View key={badge.id} style={[styles.badgeCard, { backgroundColor: activeColors.surface, borderColor: earned ? activeColors.primary : activeColors.border, borderRadius: activeRadius.md, opacity: earned ? 1 : 0.5 }]}>
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  <Text style={[styles.badgeLabel, { color: activeColors.textMain }]}>{badge.label}</Text>
                  <Text style={[styles.badgeDesc, { color: activeColors.textMuted }]}>{badge.desc}</Text>
                  {earned && <Ionicons name="checkmark-circle" size={16} color={activeColors.primary} style={styles.badgeCheck} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Theme Switcher */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: activeColors.textMain }]}>Theme</Text>
          <View style={styles.themesGrid}>
            {(Object.keys(THEMES) as ThemeName[]).map(name => {
              const t = THEMES[name];
              const isActive = themeName === name && !kidsMode;
              return (
                <TouchableOpacity
                  testID={`theme-${name}`}
                  key={name}
                  onPress={() => { setTheme(name); }}
                  style={[styles.themeCard, {
                    backgroundColor: t.colors.background,
                    borderColor: isActive ? t.colors.primary : activeColors.border,
                    borderWidth: isActive ? 2.5 : 1,
                    borderRadius: activeRadius.md,
                  }]}
                >
                  <View style={[styles.themeColor, { backgroundColor: t.colors.primary }]} />
                  <Text style={{ color: t.colors.textMain, fontSize: 18 }}>{t.emoji}</Text>
                  <Text style={{ color: t.colors.textMain, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{t.label}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={16} color={t.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Kids Mode + Privacy */}
        <View style={[styles.section, { backgroundColor: activeColors.surface, borderRadius: activeRadius.lg, marginHorizontal: 16 }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: activeColors.textMain }]}>🧒 Kids Mode</Text>
              <Text style={[styles.settingDesc, { color: activeColors.textMuted }]}>Family events only, bright colours</Text>
            </View>
            <Switch
              testID="kids-mode-switch"
              value={kidsMode}
              onValueChange={toggleKidsMode}
              trackColor={{ false: activeColors.border, true: activeColors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={[styles.section, { backgroundColor: activeColors.surface, borderRadius: activeRadius.lg, marginHorizontal: 16 }]}>
          <Text style={[styles.sectionTitle, { color: activeColors.textMain, paddingHorizontal: 0 }]}>Privacy Settings</Text>
          <Text style={[styles.privacyInfo, { color: activeColors.textMuted }]}>
            You have {profile.goingEvents?.filter(g => g.privacy === 'private').length || 0} private and{' '}
            {profile.goingEvents?.filter(g => g.privacy === 'public').length || 0} public event attendances.
          </Text>
          <Text style={[styles.privacyNote, { color: activeColors.textMuted }]}>
            Manage individual event privacy from each event's page.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal visible={showAvatarPicker} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowAvatarPicker(false)}>
          <View style={[styles.sheet, { backgroundColor: activeColors.surface }]}>
            <View style={[styles.handle, { backgroundColor: activeColors.border }]} />
            <Text style={[styles.sheetTitle, { color: activeColors.textMain }]}>Choose Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((av, i) => (
                <TouchableOpacity
                  testID={`avatar-option-${i}`}
                  key={i}
                  onPress={async () => { await updateProfile({ avatarIndex: i }); setShowAvatarPicker(false); }}
                  style={[styles.avatarOption, {
                    backgroundColor: profile.avatarIndex === i ? activeColors.primary : activeColors.surfaceHighlight,
                    borderRadius: activeRadius.md,
                  }]}
                >
                  <Text style={styles.avatarOptionText}>{av}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '900' },
  editBtn: { borderWidth: 1.5, paddingVertical: 6, paddingHorizontal: 16 },
  editBtnText: { fontWeight: '700', fontSize: 14 },
  profileSection: { alignItems: 'center', padding: 24, gap: 12, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  avatarEmoji: { fontSize: 44 },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { alignItems: 'center', gap: 4 },
  displayName: { fontSize: 22, fontWeight: '800' },
  username: { fontSize: 15 },
  cityText: { fontSize: 14 },
  bio: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  editInput: { fontSize: 18, fontWeight: '600', borderBottomWidth: 1.5, paddingVertical: 8, marginBottom: 12, minWidth: 200, textAlign: 'center' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, marginVertical: 8 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 12 },
  section: { paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14, paddingHorizontal: 16 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: { width: '47%', padding: 14, borderWidth: 1.5, gap: 4, position: 'relative' },
  badgeEmoji: { fontSize: 28 },
  badgeLabel: { fontSize: 14, fontWeight: '700' },
  badgeDesc: { fontSize: 11, lineHeight: 16 },
  badgeCheck: { position: 'absolute', top: 10, right: 10 },
  themesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  themeCard: { width: '47%', padding: 12, alignItems: 'center', gap: 6 },
  themeColor: { width: 32, height: 8, borderRadius: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12 },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  settingDesc: { fontSize: 13, lineHeight: 18 },
  privacyInfo: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, marginBottom: 8 },
  privacyNote: { fontSize: 12, paddingHorizontal: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  avatarOption: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  avatarOptionText: { fontSize: 36 },
});
