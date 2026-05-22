import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EventList {
  id: string;
  name: string;
  emoji: string;
  eventIds: string[];
  createdAt: string;
  isDefault?: boolean;
}

export interface Friend {
  requestId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarIndex: number;
  city: string;
  status: 'pending_sent' | 'pending_received' | 'accepted';
}

const DEFAULT_LISTS: EventList[] = [
  { id: 'solo', name: 'Solo Adventures', emoji: '🧍', eventIds: [], createdAt: new Date().toISOString(), isDefault: true },
  { id: 'family', name: 'With Family', emoji: '👨‍👩‍👧', eventIds: [], createdAt: new Date().toISOString(), isDefault: true },
  { id: 'friends', name: 'With Friends', emoji: '👯', eventIds: [], createdAt: new Date().toISOString(), isDefault: true },
];

interface AppContextType {
  lists: EventList[];
  friends: Friend[];
  createList: (name: string, emoji: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  addToList: (listId: string, eventId: string) => Promise<void>;
  removeFromList: (listId: string, eventId: string) => Promise<void>;
  isInList: (listId: string, eventId: string) => boolean;
  getEventLists: (eventId: string) => string[];
  sendFriendRequest: (username: string, myUserId: string, myUsername: string) => Promise<{ success: boolean; message: string }>;
  acceptFriendRequest: (requestId: string, userId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  loadFriends: (userId: string) => Promise<void>;
  refreshLists: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [lists, setLists] = useState<EventList[]>(DEFAULT_LISTS);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    const saved = await AsyncStorage.getItem('eventLists');
    if (saved) {
      setLists(JSON.parse(saved));
    } else {
      await AsyncStorage.setItem('eventLists', JSON.stringify(DEFAULT_LISTS));
    }
  };

  const saveLists = async (updated: EventList[]) => {
    setLists(updated);
    await AsyncStorage.setItem('eventLists', JSON.stringify(updated));
  };

  const createList = async (name: string, emoji: string) => {
    const newList: EventList = {
      id: `list_${Date.now()}`,
      name,
      emoji,
      eventIds: [],
      createdAt: new Date().toISOString(),
    };
    await saveLists([...lists, newList]);
  };

  const deleteList = async (listId: string) => {
    const l = lists.find(l => l.id === listId);
    if (l?.isDefault) return;
    await saveLists(lists.filter(l => l.id !== listId));
  };

  const addToList = async (listId: string, eventId: string) => {
    const updated = lists.map(l =>
      l.id === listId && !l.eventIds.includes(eventId)
        ? { ...l, eventIds: [...l.eventIds, eventId] }
        : l
    );
    await saveLists(updated);
  };

  const removeFromList = async (listId: string, eventId: string) => {
    const updated = lists.map(l =>
      l.id === listId ? { ...l, eventIds: l.eventIds.filter(id => id !== eventId) } : l
    );
    await saveLists(updated);
  };

  const isInList = (listId: string, eventId: string) =>
    lists.find(l => l.id === listId)?.eventIds.includes(eventId) ?? false;

  const getEventLists = (eventId: string) =>
    lists.filter(l => l.eventIds.includes(eventId)).map(l => l.id);

  const sendFriendRequest = async (username: string, myUserId: string, myUsername: string) => {
    try {
      const res = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: myUserId, from_username: myUsername, to_username: username }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.detail || 'Failed to send request' };
      return { success: true, message: 'Request sent!' };
    } catch {
      return { success: false, message: 'Network error' };
    }
  };

  const acceptFriendRequest = async (requestId: string, userId: string) => {
    await fetch(`${API_URL}/api/friends/request/${requestId}/accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    await loadFriends(userId);
  };

  const rejectFriendRequest = async (requestId: string) => {
    await fetch(`${API_URL}/api/friends/request/${requestId}/reject`, { method: 'PUT' });
  };

  const loadFriends = async (userId: string) => {
    try {
      const [acceptedRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/api/friends/${userId}`),
        fetch(`${API_URL}/api/friends/requests/${userId}`),
      ]);
      const accepted = await acceptedRes.json();
      const requests = await requestsRes.json();
      setFriends([...accepted, ...requests]);
    } catch { /* Ignore */ }
  };

  const refreshLists = async () => loadLists();

  return (
    <AppContext.Provider value={{
      lists, friends, createList, deleteList, addToList, removeFromList,
      isInList, getEventLists, sendFriendRequest, acceptFriendRequest,
      rejectFriendRequest, loadFriends, refreshLists,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
