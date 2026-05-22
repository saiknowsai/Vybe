import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { useApp, Friend } from '../../contexts/AppContext';
import EmptyState from '../../components/EmptyState';

const AVATARS = ['🧑', '👩', '🧔', '👱', '🧕', '👨‍🦱', '🧑‍🦰', '👩‍🦳'];

export default function FriendsScreen() {
  const { activeColors, activeRadius } = useTheme();
  const { profile, updateProfile } = useUser();
  const { friends, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, loadFriends } = useApp();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showSetUsername, setShowSetUsername] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    if (profile.userId) loadFriends(profile.userId);
  }, [profile.userId]);

  const accepted = friends.filter(f => f.status === 'accepted');
  const pending_received = friends.filter(f => f.status === 'pending_received');
  const pending_sent = friends.filter(f => f.status === 'pending_sent');

  const handleSendRequest = async () => {
    if (!searchUsername.trim()) return;
    setSending(true);
    const result = await sendFriendRequest(searchUsername.trim(), profile.userId, profile.username);
    setSending(false);
    if (result.success) {
      Alert.alert('Request Sent!', `Friend request sent to @${searchUsername.trim()}`);
      setSearchUsername('');
      setShowAddFriend(false);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return;
    const username = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const displayName = newDisplayName.trim() || username;
    try {
      await fetch(`${API_URL}/api/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.userId, username, display_name: displayName, avatar_index: 0, city: profile.city }),
      });
      await updateProfile({ username, displayName });
      setShowSetUsername(false);
    } catch { Alert.alert('Error', 'Could not save username. Try again.'); }
  };

  const FriendCard = ({ friend }: { friend: Friend }) => (
    <View style={[styles.friendCard, { backgroundColor: activeColors.surface, borderRadius: activeRadius.lg, borderColor: activeColors.border }]}>
      <View style={[styles.avatar, { backgroundColor: activeColors.surfaceHighlight }]}>
        <Text style={styles.avatarText}>{AVATARS[friend.avatarIndex ?? 0]}</Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: activeColors.textMain }]}>{friend.displayName || friend.username}</Text>
        <Text style={[styles.friendUsername, { color: activeColors.textMuted }]}>@{friend.username}</Text>
        {friend.city && <Text style={[styles.friendCity, { color: activeColors.textMuted }]}>📍 {friend.city}</Text>}
      </View>
      {friend.status === 'pending_received' && (
        <View style={styles.requestActions}>
          <TouchableOpacity
            testID={`accept-${friend.requestId}`}
            onPress={() => acceptFriendRequest(friend.requestId, profile.userId)}
            style={[styles.acceptBtn, { backgroundColor: activeColors.success, borderRadius: activeRadius.full }]}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            testID={`reject-${friend.requestId}`}
            onPress={() => rejectFriendRequest(friend.requestId)}
            style={[styles.rejectBtn, { borderColor: activeColors.border, borderRadius: activeRadius.full }]}
          >
            <Ionicons name="close" size={16} color={activeColors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      {friend.status === 'pending_sent' && (
        <View style={[styles.sentBadge, { backgroundColor: activeColors.surfaceHighlight, borderRadius: activeRadius.full }]}>
          <Text style={[styles.sentText, { color: activeColors.textMuted }]}>Pending</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: activeColors.border }]}>
        <Text style={[styles.headerTitle, { color: activeColors.textMain }]}>Friends</Text>
        <TouchableOpacity
          testID="add-friend-btn"
          onPress={() => {
            if (!profile.username || profile.username.startsWith('user_')) {
              setShowSetUsername(true);
            } else {
              setShowAddFriend(true);
            }
          }}
          style={[styles.addBtn, { backgroundColor: activeColors.primary, borderRadius: activeRadius.full }]}
        >
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Friend</Text>
        </TouchableOpacity>
      </View>

      {/* My username display */}
      {profile.username && !profile.username.startsWith('user_') ? (
        <View style={[styles.myUsernameBar, { backgroundColor: activeColors.surfaceHighlight, borderBottomColor: activeColors.border }]}>
          <Text style={[styles.myUsernameText, { color: activeColors.textMuted }]}>
            Your username: <Text style={{ fontWeight: '800', color: activeColors.primary }}>@{profile.username}</Text>
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          testID="set-username-prompt"
          onPress={() => setShowSetUsername(true)}
          style={[styles.myUsernameBar, { backgroundColor: activeColors.surfaceHighlight, borderBottomColor: activeColors.border }]}
        >
          <Ionicons name="person-circle-outline" size={18} color={activeColors.primary} />
          <Text style={[styles.myUsernameText, { color: activeColors.primary, fontWeight: '700' }]}>
            Set your username so friends can find you →
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: activeColors.border }]}>
        {(['friends', 'requests'] as const).map(t => (
          <TouchableOpacity
            testID={`friends-tab-${t}`}
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, { borderBottomColor: tab === t ? activeColors.primary : 'transparent' }]}
          >
            <Text style={[styles.tabText, { color: tab === t ? activeColors.primary : activeColors.textMuted }]}>
              {t === 'friends' ? `Friends (${accepted.length})` : `Requests (${pending_received.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'friends' ? (
        <FlatList
          testID="friends-list"
          data={accepted}
          keyExtractor={f => f.userId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <FriendCard friend={item} />}
          ListEmptyComponent={
            <EmptyState
              emoji="👯"
              title="No friends yet"
              subtitle="Add friends to see their upcoming events and invite them to events you're going to"
              actionLabel="Add a Friend"
              onAction={() => setShowAddFriend(true)}
              testID="no-friends"
            />
          }
        />
      ) : (
        <FlatList
          testID="requests-list"
          data={[...pending_received, ...pending_sent]}
          keyExtractor={f => f.requestId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <FriendCard friend={item} />}
          ListEmptyComponent={
            <EmptyState emoji="📬" title="No pending requests" subtitle="Send a friend request to get started" testID="no-requests" />
          }
        />
      )}

      {/* Add Friend Modal */}
      <Modal visible={showAddFriend} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowAddFriend(false)}>
            <View style={[styles.sheet, { backgroundColor: activeColors.surface }]}>
              <View style={[styles.handle, { backgroundColor: activeColors.border }]} />
              <Text style={[styles.sheetTitle, { color: activeColors.textMain }]}>Add Friend</Text>
              <Text style={[styles.sheetSubtitle, { color: activeColors.textMuted }]}>Enter their username to send a request</Text>
              <TextInput
                testID="friend-username-input"
                value={searchUsername}
                onChangeText={setSearchUsername}
                placeholder="@username"
                placeholderTextColor={activeColors.textMuted}
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: activeColors.surfaceHighlight, color: activeColors.textMain, borderRadius: activeRadius.md }]}
                autoFocus
              />
              <TouchableOpacity
                testID="send-request-btn"
                onPress={handleSendRequest}
                disabled={sending || !searchUsername.trim()}
                style={[styles.sendBtn, { backgroundColor: searchUsername.trim() ? activeColors.primary : activeColors.border, borderRadius: activeRadius.full }]}
              >
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Request</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set Username Modal */}
      <Modal visible={showSetUsername} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSetUsername(false)}>
            <View style={[styles.sheet, { backgroundColor: activeColors.surface }]}>
              <View style={[styles.handle, { backgroundColor: activeColors.border }]} />
              <Text style={[styles.sheetTitle, { color: activeColors.textMain }]}>Set Your Username</Text>
              <Text style={[styles.sheetSubtitle, { color: activeColors.textMuted }]}>Friends will use this to find and add you</Text>
              <TextInput
                testID="new-username-input"
                value={newUsername}
                onChangeText={t => setNewUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. john_doe"
                placeholderTextColor={activeColors.textMuted}
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: activeColors.surfaceHighlight, color: activeColors.textMain, borderRadius: activeRadius.md }]}
                autoFocus
              />
              <TextInput
                testID="new-displayname-input"
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                placeholder="Display Name (optional)"
                placeholderTextColor={activeColors.textMuted}
                style={[styles.input, { backgroundColor: activeColors.surfaceHighlight, color: activeColors.textMain, borderRadius: activeRadius.md, marginTop: 8 }]}
              />
              <TouchableOpacity
                testID="save-username-btn"
                onPress={handleSaveUsername}
                disabled={!newUsername.trim()}
                style={[styles.sendBtn, { backgroundColor: newUsername.trim() ? activeColors.primary : activeColors.border, borderRadius: activeRadius.full }]}
              >
                <Text style={styles.sendBtnText}>Save Username</Text>
              </TouchableOpacity>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  myUsernameBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  myUsernameText: { fontSize: 14 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: '700' },
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },
  friendCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28 },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  friendUsername: { fontSize: 13, marginBottom: 2 },
  friendCity: { fontSize: 12 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  sentBadge: { paddingHorizontal: 12, paddingVertical: 6 },
  sentText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sheetSubtitle: { fontSize: 14, marginBottom: 16 },
  input: { padding: 14, fontSize: 16, marginBottom: 16 },
  sendBtn: { paddingVertical: 14, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
