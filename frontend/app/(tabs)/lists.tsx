import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useApp, EventList } from '../../contexts/AppContext';
import EmptyState from '../../components/EmptyState';

const EMOJI_OPTIONS = ['🎭', '🎵', '🍕', '🎨', '⚽', '🌿', '🛒', '🎪', '🏖️', '🎡', '🎢', '🎠', '🧳', '❤️', '⭐', '🔥'];

export default function ListsScreen() {
  const { activeColors, activeRadius } = useTheme();
  const { lists, createList, deleteList } = useApp();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎭');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createList(newName.trim(), newEmoji);
    setNewName('');
    setNewEmoji('🎭');
    setShowCreate(false);
  };

  const handleDelete = (list: EventList) => {
    if (list.isDefault) {
      Alert.alert('Cannot delete', 'Default lists cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete List',
      `Delete "${list.name}"? All saved events will be removed from this list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteList(list.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: activeColors.border }]}>
        <Text style={[styles.headerTitle, { color: activeColors.textMain }]}>My Lists</Text>
        <TouchableOpacity
          testID="create-list-btn"
          onPress={() => setShowCreate(true)}
          style={[styles.addBtn, { backgroundColor: activeColors.primary, borderRadius: activeRadius.full }]}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>New List</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        testID="lists-feed"
        data={lists}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`list-${item.id}`}
            onPress={() => router.push(`/list/${item.id}` as any)}
            style={[styles.listCard, { backgroundColor: activeColors.surface, borderRadius: activeRadius.lg, borderColor: activeColors.border }]}
            activeOpacity={0.85}
          >
            <View style={[styles.listEmoji, { backgroundColor: activeColors.surfaceHighlight, borderRadius: activeRadius.md }]}>
              <Text style={styles.emojiText}>{item.emoji}</Text>
            </View>
            <View style={styles.listInfo}>
              <Text style={[styles.listName, { color: activeColors.textMain }]}>{item.name}</Text>
              <Text style={[styles.listCount, { color: activeColors.textMuted }]}>
                {item.eventIds.length} {item.eventIds.length === 1 ? 'event' : 'events'}
              </Text>
            </View>
            <View style={styles.listActions}>
              {!item.isDefault && (
                <TouchableOpacity
                  testID={`delete-list-${item.id}`}
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={20} color={activeColors.textMuted} />
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-forward" size={20} color={activeColors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="📋"
            title="No lists yet"
            subtitle="Create your first list to save events you love"
            actionLabel="Create a List"
            onAction={() => setShowCreate(true)}
            testID="no-lists"
          />
        }
      />

      {/* Create List Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCreate(false)}>
            <View style={[styles.sheet, { backgroundColor: activeColors.surface }]}>
              <View style={[styles.handle, { backgroundColor: activeColors.border }]} />
              <Text style={[styles.sheetTitle, { color: activeColors.textMain }]}>Create New List</Text>

              {/* Emoji Picker */}
              <Text style={[styles.fieldLabel, { color: activeColors.textMuted }]}>Pick an emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
                {EMOJI_OPTIONS.map(e => (
                  <TouchableOpacity
                    testID={`emoji-${e}`}
                    key={e}
                    onPress={() => setNewEmoji(e)}
                    style={[styles.emojiOption, {
                      backgroundColor: newEmoji === e ? activeColors.primary : activeColors.surfaceHighlight,
                      borderRadius: activeRadius.md,
                    }]}
                  >
                    <Text style={styles.emojiOptionText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Name Input */}
              <Text style={[styles.fieldLabel, { color: activeColors.textMuted }]}>List name</Text>
              <TextInput
                testID="list-name-input"
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Date Night 💑"
                placeholderTextColor={activeColors.textMuted}
                style={[styles.input, { backgroundColor: activeColors.surfaceHighlight, color: activeColors.textMain, borderRadius: activeRadius.md }]}
                maxLength={30}
                autoFocus
              />

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  testID="cancel-create-list"
                  onPress={() => setShowCreate(false)}
                  style={[styles.cancelBtn, { borderColor: activeColors.border, borderRadius: activeRadius.full }]}
                >
                  <Text style={[styles.cancelBtnText, { color: activeColors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="confirm-create-list"
                  onPress={handleCreate}
                  disabled={!newName.trim()}
                  style={[styles.createBtn, { backgroundColor: newName.trim() ? activeColors.primary : activeColors.border, borderRadius: activeRadius.full }]}
                >
                  <Text style={styles.createBtnText}>Create {newEmoji}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, gap: 14 },
  listEmoji: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  emojiText: { fontSize: 28 },
  listInfo: { flex: 1 },
  listName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  listCount: { fontSize: 13 },
  listActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  emojiRow: { marginBottom: 16 },
  emojiOption: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  emojiOptionText: { fontSize: 24 },
  input: { padding: 14, fontSize: 16, marginBottom: 24 },
  sheetActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  cancelBtnText: { fontWeight: '700', fontSize: 15 },
  createBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
