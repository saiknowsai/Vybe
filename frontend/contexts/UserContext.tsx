import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GoingEvent {
  eventId: string;
  privacy: 'public' | 'private';
  markedAt: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarIndex: number;
  city: string;
  bio: string;
  ageGroup: string;
  interests: string[];
  onboardingComplete: boolean;
  goingEvents: GoingEvent[];
  badges: string[];
}

const DEFAULT_PROFILE: UserProfile = {
  userId: '',
  username: '',
  displayName: '',
  avatarIndex: 0,
  city: 'London',
  bio: '',
  ageGroup: 'adult',
  interests: [],
  onboardingComplete: false,
  goingEvents: [],
  badges: [],
};

interface UserContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  markGoing: (eventId: string, privacy: 'public' | 'private') => Promise<void>;
  removeGoing: (eventId: string) => Promise<void>;
  isGoing: (eventId: string) => boolean;
  getGoingPrivacy: (eventId: string) => 'public' | 'private' | null;
  completeOnboarding: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({} as UserContextType);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('userProfile');
      if (saved) {
        setProfile(JSON.parse(saved));
      } else {
        // Generate a unique user ID on first launch
        const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const initial = { ...DEFAULT_PROFILE, userId };
        setProfile(initial);
        await AsyncStorage.setItem('userProfile', JSON.stringify(initial));
      }
    })();
  }, []);

  const saveProfile = async (updated: UserProfile) => {
    setProfile(updated);
    await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const updated = { ...profile, ...updates };
    await saveProfile(updated);
  };

  const markGoing = async (eventId: string, privacy: 'public' | 'private') => {
    const filtered = profile.goingEvents.filter(g => g.eventId !== eventId);
    const updated = { ...profile, goingEvents: [...filtered, { eventId, privacy, markedAt: new Date().toISOString() }] };
    await saveProfile(updated);
  };

  const removeGoing = async (eventId: string) => {
    const updated = { ...profile, goingEvents: profile.goingEvents.filter(g => g.eventId !== eventId) };
    await saveProfile(updated);
  };

  const isGoing = (eventId: string) => profile.goingEvents.some(g => g.eventId === eventId);

  const getGoingPrivacy = (eventId: string): 'public' | 'private' | null => {
    const g = profile.goingEvents.find(g => g.eventId === eventId);
    return g ? g.privacy : null;
  };

  const completeOnboarding = async () => {
    await updateProfile({ onboardingComplete: true });
  };

  return (
    <UserContext.Provider value={{ profile, updateProfile, markGoing, removeGoing, isGoing, getGoingPrivacy, completeOnboarding }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
