import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Index() {
  const { profile } = useUser();
  const { activeColors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // Wait for profile to load (userId will be set after AsyncStorage loads)
    if (profile.userId) {
      if (profile.onboardingComplete) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [profile.userId, profile.onboardingComplete]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: activeColors.background }}>
      <ActivityIndicator size="large" color={activeColors.primary} />
    </View>
  );
}
