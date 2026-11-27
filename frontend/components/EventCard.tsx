import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export interface Event {
  id: string;
  name: string;
  description: string;
  city: string;
  venue: string;
  address: string;
  lat: number;
  lng: number;
  date: string;
  endDate?: string;
  time: string;
  category: string;
  price: number;
  priceLabel: string;
  imageUrl: string;
  isVerified: boolean;
  isTrending: boolean;
  isFeatured: boolean;
  ageSuitability: string;
  isOutdoor: boolean;
  ticketUrl?: string;
  ticketProvider?: string;
  isSoldOut: boolean;
  isLimitedSpaces: boolean;
  attendeeCount: number;
  averageRating: number;
  reviewCount: number;
  food?: any;
  parking?: any;
  accessibility?: any;
  ageGuide?: any;
  tags?: string[];
  lastUpdated?: string;
  source?: string;
}

interface Props {
  event: Event;
  onPress: () => void;
  onBookNow?: () => void;
  showBookNow?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Music: '#8B5CF6', Food: '#F59E0B', Arts: '#EC4899', Family: '#10B981',
  Sports: '#3B82F6', Comedy: '#F97316', Markets: '#14B8A6', Outdoors: '#84CC16',
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// "Arch 2, Newcastle Upon Tyne, NE1 2NP" -> "NE1 2NP Newcastle"
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
export const postcodeArea = (address?: string, fallbackCity?: string): string | null => {
  const m = (address || '').match(UK_POSTCODE);
  if (!m) return null;
  const postcode = `${m[1]} ${m[2]}`.toUpperCase();
  const parts = (address || '').split(',').map(p => p.trim()).filter(Boolean);
  const idx = parts.findIndex(p => UK_POSTCODE.test(p));
  let town = idx > 0 ? parts[idx - 1] : '';
  if (!town || /\d/.test(town)) town = fallbackCity || '';
  town = town.replace(/\s+upon\s+tyne$/i, '').replace(/\s+on\s+tyne$/i, '');
  return town ? `${postcode} ${town}` : postcode;
};

export default function EventCard({ event, onPress, onBookNow, showBookNow = false }: Props) {
  const { activeColors, activeRadius, kidsMode } = useTheme();

  const catColor = CATEGORY_COLORS[event.category] || activeColors.primary;

  return (
    <TouchableOpacity
      testID={`event-card-${event.id}`}
      onPress={onPress}
      style={[styles.card, {
        backgroundColor: activeColors.surface,
        borderRadius: activeRadius.lg,
        borderColor: activeColors.border,
      }]}
      activeOpacity={0.92}
    >
      {/* Image */}
      <View style={[styles.imageContainer, { borderRadius: activeRadius.lg }]}>
        <Image
          source={{ uri: event.imageUrl }}
          style={[styles.image, { borderTopLeftRadius: activeRadius.lg, borderTopRightRadius: activeRadius.lg }]}
          resizeMode="cover"
        />
        {/* Floating Badges */}
        <View style={styles.badgesTop}>
          {event.isTrending && (
            <View style={[styles.badge, styles.trendingBadge]}>
              <Text style={styles.badgeText}>🔥 Trending</Text>
            </View>
          )}
          {event.isVerified && (
            <View style={[styles.badge, { backgroundColor: activeColors.primary }]}>
              <Ionicons name="checkmark-circle" size={10} color="#fff" />
              <Text style={styles.badgeText}> Verified</Text>
            </View>
          )}
        </View>
        {event.isSoldOut && (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        )}
        {event.isLimitedSpaces && !event.isSoldOut && (
          <View style={[styles.limitedBadge, { backgroundColor: activeColors.error }]}>
            <Text style={styles.badgeText}>⚡ Limited spaces</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={[styles.content, { padding: kidsMode ? 16 : 14 }]}>
        {/* Category + Price Row */}
        <View style={styles.row}>
          <View style={[styles.categoryPill, { backgroundColor: catColor + '22', borderRadius: activeRadius.full }]}>
            <Text style={[styles.categoryText, { color: catColor, fontSize: kidsMode ? 13 : 11 }]}>
              {event.category}
            </Text>
          </View>
          <Text style={[styles.price, { color: event.price === 0 ? activeColors.success : activeColors.primary, fontSize: kidsMode ? 15 : 14 }]}>
            {event.priceLabel}
          </Text>
        </View>

        {/* Name */}
        <Text style={[styles.name, { color: activeColors.textMain, fontSize: kidsMode ? 18 : 16 }]} numberOfLines={2}>
          {event.name}
        </Text>

        {/* Date + Venue */}
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={13} color={activeColors.textMuted} />
          <Text style={[styles.meta, { color: activeColors.textMuted }]}> {formatDate(event.date)}</Text>
          <Text style={[styles.meta, { color: activeColors.border }]}>  •  </Text>
          <Ionicons name="location-outline" size={13} color={activeColors.textMuted} />
          <Text style={[styles.meta, { color: activeColors.textMuted, flex: 1 }]} numberOfLines={1}> {(() => { const pa = postcodeArea(event.address, (event as any).city); return pa ? `${pa} · ${event.venue}` : event.venue; })()}</Text>
        </View>

        {/* Age Suitability */}
        <View style={styles.row}>
          <Ionicons name="people-outline" size={13} color={activeColors.textMuted} />
          <Text style={[styles.meta, { color: activeColors.textMuted }]}> {event.ageSuitability}</Text>
          {event.averageRating > 0 && (
            <>
              <Text style={[styles.meta, { color: activeColors.border }]}>  •  </Text>
              <Ionicons name="star" size={12} color="#FFB800" />
              <Text style={[styles.meta, { color: activeColors.textMuted }]}> {event.averageRating.toFixed(1)}</Text>
            </>
          )}
        </View>

        {showBookNow && event.ticketUrl && (
          <TouchableOpacity
            testID={`book-now-${event.id}`}
            onPress={onBookNow}
            style={[styles.bookBtn, { backgroundColor: activeColors.primary, borderRadius: activeRadius.full }]}
            disabled={event.isSoldOut}
          >
            <Text style={styles.bookBtnText}>{event.isSoldOut ? 'Sold Out' : 'Book Now'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, borderWidth: 1, overflow: 'hidden' },
  imageContainer: { width: '100%' },
  image: { width: '100%', aspectRatio: 16 / 9 },
  badgesTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  trendingBadge: { backgroundColor: '#FF4444' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  soldOutOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  soldOutText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  limitedBadge: { position: 'absolute', bottom: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  content: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  categoryPill: { paddingHorizontal: 10, paddingVertical: 3, marginRight: 8 },
  categoryText: { fontWeight: '700' },
  price: { fontWeight: '800', marginLeft: 'auto' },
  name: { fontWeight: '700', lineHeight: 22 },
  meta: { fontSize: 13, lineHeight: 18 },
  bookBtn: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
