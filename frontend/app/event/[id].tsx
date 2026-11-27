import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Image, Modal, TextInput, ActivityIndicator, Share, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { useApp } from '../../contexts/AppContext';
import { Event } from '../../components/EventCard';
import WeatherBadge from '../../components/WeatherBadge';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const formatDate = (d: string, end?: string) => {
  const start = new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  if (end && end !== d) {
    const endF = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    return `${start} — ${endF}`;
  }
  return start;
};

const TabContent = ({ event, tab, colors }: { event: Event; tab: string; colors: any }) => {
  if (tab === 'food') {
    const food = event.food || {};
    return (
      <View style={styles.tabContent}>
        {food.onSite?.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: colors.textMain }]}>🍽️ On-Site Food & Drink</Text>
            {food.onSite.map((item: string, i: number) => (
              <View key={i} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.detailText, { color: colors.textMain }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {food.nearby?.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: colors.textMain }]}>🗺️ Nearby Restaurants</Text>
            {food.nearby.map((item: string, i: number) => (
              <View key={i} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
                <Text style={[styles.detailText, { color: colors.textMain }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {(!food.onSite?.length && !food.nearby?.length) && (
          <Text style={[styles.noInfo, { color: colors.textMuted }]}>Food information not available for this event.</Text>
        )}
        {food.credit && (
          <Text style={[styles.creditText, { color: colors.textMuted }]}>Nearby places: {food.credit}</Text>
        )}
      </View>
    );
  }

  if (tab === 'parking') {
    const parking = event.parking || {};
    return (
      <View style={styles.tabContent}>
        {parking.carParks?.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: colors.textMain }]}>🚗 Car Parks</Text>
            {parking.carParks.map((item: string, i: number) => (
              <View key={i} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="car-outline" size={16} color={colors.primary} />
                <Text style={[styles.detailText, { color: colors.textMain }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {parking.publicTransport?.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: colors.textMain }]}>🚌 Public Transport</Text>
            {parking.publicTransport.map((item: string, i: number) => (
              <View key={i} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="bus-outline" size={16} color={colors.secondary} />
                <Text style={[styles.detailText, { color: colors.textMain }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {(!parking.carParks?.length && !parking.publicTransport?.length) && (
          <Text style={[styles.noInfo, { color: colors.textMuted }]}>Parking information not available.</Text>
        )}
        {parking.credit && (
          <Text style={[styles.creditText, { color: colors.textMuted }]}>Map data: {parking.credit}</Text>
        )}
      </View>
    );
  }

  if (tab === 'accessibility') {
    const a = event.accessibility || {};
    const items = [
      { key: 'wheelchair', icon: 'accessibility-outline', label: 'Wheelchair Access' },
      { key: 'hearingLoop', icon: 'ear-outline', label: 'Hearing Loop' },
      { key: 'quietSpaces', icon: 'volume-mute-outline', label: 'Quiet Spaces' },
      { key: 'bsl', icon: 'hand-left-outline', label: 'BSL Interpreted' },
      { key: 'assistance', icon: 'people-outline', label: 'Assistance Available' },
    ];
    return (
      <View style={styles.tabContent}>
        {items.map(item => (
          <View key={item.key} style={[styles.accessRow, { borderBottomColor: colors.border }]}>
            <Ionicons name={item.icon as any} size={20} color={a[item.key] ? colors.success : colors.textMuted} />
            <Text style={[styles.accessLabel, { color: a[item.key] ? colors.textMain : colors.textMuted }]}>{item.label}</Text>
            <View style={[styles.accessBadge, { backgroundColor: a[item.key] ? colors.success + '22' : colors.surfaceHighlight }]}>
              <Text style={{ color: a[item.key] ? colors.success : colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                {a[item.key] ? 'Available' : 'Not confirmed'}
              </Text>
            </View>
          </View>
        ))}
        {a.details && (
          <Text style={[styles.accessDetails, { color: colors.textMuted }]}>{a.details}</Text>
        )}
        {a.credit && (
          <Text style={[styles.creditText, { color: colors.textMuted }]}>Map data: {a.credit}</Text>
        )}
      </View>
    );
  }

  if (tab === 'age') {
    const ag = event.ageGuide || {};
    return (
      <View style={styles.tabContent}>
        <View style={[styles.ageCard, { backgroundColor: colors.surfaceHighlight, borderRadius: 12 }]}>
          <Text style={[styles.ageCardTitle, { color: colors.primary }]}>Suitable for</Text>
          <Text style={[styles.ageCardValue, { color: colors.textMain }]}>{ag.suitableFor || event.ageSuitability}</Text>
        </View>
        {ag.restrictions && (
          <View style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: colors.textMain }]}>⚠️ Restrictions</Text>
            <Text style={[styles.detailText, { color: colors.textMuted }]}>{ag.restrictions}</Text>
          </View>
        )}
        {ag.sections?.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: colors.textMain }]}>Areas & Sections</Text>
            {ag.sections.map((s: string, i: number) => (
              <View key={i} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="arrow-forward-circle" size={16} color={colors.primary} />
                <Text style={[styles.detailText, { color: colors.textMain }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
  return null;
};

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeColors, activeRadius } = useTheme();
  const { profile, markGoing, removeGoing, isGoing, getGoingPrivacy } = useUser();
  const { lists, addToList, removeFromList, isInList } = useApp();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('food');
  const [reviews, setReviews] = useState<any[]>([]);
  const [goingUsers, setGoingUsers] = useState<any[]>([]);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const TABS = [
    { key: 'food', label: '🍽️ Food', icon: 'restaurant-outline' },
    { key: 'parking', label: '🚗 Parking', icon: 'car-outline' },
    { key: 'accessibility', label: '♿ Access', icon: 'accessibility-outline' },
    { key: 'age', label: '👥 Age Guide', icon: 'people-outline' },
  ];

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [evtRes, revRes, goingRes] = await Promise.all([
          fetch(`${API_URL}/api/events/${id}`),
          fetch(`${API_URL}/api/reviews/${id}`),
          fetch(`${API_URL}/api/event/${id}/going`),
        ]);
        const evtData = await evtRes.json();
        const revData = await revRes.json();
        const goingData = await goingRes.json();
        setEvent(evtData);
        setReviews(Array.isArray(revData) ? revData : []);
        setGoingUsers(Array.isArray(goingData) ? goingData : []);
      } catch { }
      setLoading(false);
    })();
  }, [id]);

  const handleGoingPress = () => {
    if (isGoing(id!)) {
      Alert.alert('Remove attendance?', "Remove yourself from this event?", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          await removeGoing(id!);
          await fetch(`${API_URL}/api/user/going/${profile.userId}/${id}`, { method: 'DELETE' });
        }},
      ]);
    } else {
      setShowPrivacyModal(true);
    }
  };

  const confirmGoing = async (privacy: 'public' | 'private') => {
    await markGoing(id!, privacy);
    if (privacy === 'public') {
      await fetch(`${API_URL}/api/user/going`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.userId, username: profile.username, event_id: id, privacy }),
      });
    }
    setShowPrivacyModal(false);
  };

  const handleShare = async () => {
    if (!event) return;
    await Share.share({
      title: event.name,
      message: `Check out ${event.name} on ${formatDate(event.date)} at ${event.venue}! Find your vybe 🎯`,
    });
  };

  const submitReview = async () => {
    if (!reviewText.trim()) return;
    setSubmittingReview(true);
    await fetch(`${API_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: profile.userId, username: profile.username || 'Anonymous', event_id: id, rating: reviewRating, text: reviewText }),
    });
    const revRes = await fetch(`${API_URL}/api/reviews/${id}`);
    const revData = await revRes.json();
    setReviews(Array.isArray(revData) ? revData : []);
    setReviewText('');
    setReviewRating(5);
    setSubmittingReview(false);
    setShowReviewModal(false);
  };

  if (loading || !event) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={activeColors.primary} />
      </SafeAreaView>
    );
  }

  const userGoing = isGoing(id!);
  const goingPrivacy = getGoingPrivacy(id!);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeColors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: event.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          {/* Back + Share buttons */}
          <View style={styles.heroButtons}>
            <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={[styles.heroBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.heroRight}>
              <TouchableOpacity testID="share-btn" onPress={handleShare} style={[styles.heroBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Ionicons name="share-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="save-list-btn" onPress={() => setShowListModal(true)} style={[styles.heroBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Ionicons name="bookmark-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Badges */}
          <View style={styles.heroBadges}>
            {event.isTrending && <View style={[styles.heroBadge, { backgroundColor: '#FF4444' }]}><Text style={styles.heroBadgeText}>🔥 Trending</Text></View>}
            {event.isVerified && <View style={[styles.heroBadge, { backgroundColor: activeColors.primary }]}><Text style={styles.heroBadgeText}>✓ Verified</Text></View>}
            {event.isSoldOut && <View style={[styles.heroBadge, { backgroundColor: '#888' }]}><Text style={styles.heroBadgeText}>SOLD OUT</Text></View>}
          </View>
        </View>

        {/* Event Info */}
        <View style={[styles.infoSection, { backgroundColor: activeColors.surface }]}>
          <Text style={[styles.eventName, { color: activeColors.textMain }]}>{event.name}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: activeColors.textMain }]}>{formatDate(event.date, event.endDate)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: activeColors.textMain }]}>{event.time}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: activeColors.textMain }]}>{event.venue}, {event.address}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={16} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: activeColors.textMain }]}>{event.ageSuitability}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="ticket-outline" size={16} color={activeColors.primary} />
            <Text style={[styles.metaText, { color: event.price === 0 ? activeColors.success : activeColors.textMain, fontWeight: '800' }]}>{event.priceLabel}</Text>
            {event.ticketProvider && <Text style={[styles.providerText, { color: activeColors.textMuted }]}> via {event.ticketProvider}</Text>}
          </View>

          {event.averageRating > 0 && (
            <View style={styles.ratingRow}>
              {[1,2,3,4,5].map(s => (
                <Ionicons key={s} name={s <= Math.round(event.averageRating) ? 'star' : 'star-outline'} size={18} color="#FFB800" />
              ))}
              <Text style={[styles.ratingText, { color: activeColors.textMuted }]}> {event.averageRating.toFixed(1)} ({event.reviewCount} reviews)</Text>
            </View>
          )}

          <Text style={[styles.lastUpdated, { color: activeColors.textMuted }]}>
            Last updated: {event.lastUpdated ? new Date(event.lastUpdated).toLocaleDateString('en-GB') : 'Recently'}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: activeColors.textMuted }]}>{event.description}</Text>

          {/* Weather forecast — outdoor events only, if event date is within ~14 days */}
          {event.isOutdoor && (
            <WeatherBadge
              lat={event.lat}
              lng={event.lng}
              date={event.date}
              themeColors={{
                surface: activeColors.surface,
                surfaceHighlight: activeColors.surfaceHighlight,
                textMain: activeColors.textMain,
                textMuted: activeColors.textMuted,
                primary: activeColors.primary,
              }}
              radius={activeRadius.md}
            />
          )}

          {/* Warning banners */}
          {event.isSoldOut && (
            <View style={[styles.warningBanner, { backgroundColor: '#FF444422' }]}>
              <Ionicons name="warning" size={16} color="#FF4444" />
              <Text style={{ color: '#FF4444', fontWeight: '700', fontSize: 14 }}> This event is SOLD OUT</Text>
            </View>
          )}
          {event.isLimitedSpaces && !event.isSoldOut && (
            <View style={[styles.warningBanner, { backgroundColor: activeColors.secondary + '22' }]}>
              <Ionicons name="flash" size={16} color={activeColors.secondary} />
              <Text style={{ color: activeColors.textMain, fontWeight: '700', fontSize: 14 }}> Limited spaces remaining!</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={[styles.actionsRow, { backgroundColor: activeColors.surface, borderTopColor: activeColors.border }]}>
          <TouchableOpacity
            testID="going-btn"
            onPress={handleGoingPress}
            style={[styles.goingBtn, {
              backgroundColor: userGoing ? activeColors.success : activeColors.primary,
              borderRadius: activeRadius.full,
              flex: 1,
            }]}
          >
            <Ionicons name={userGoing ? 'checkmark-circle' : 'calendar'} size={18} color="#fff" />
            <Text style={styles.goingBtnText}>
              {userGoing ? `I'm Going ${goingPrivacy === 'private' ? '🔒' : '👀'}` : "I'm Going"}
            </Text>
          </TouchableOpacity>
          {event.ticketUrl && (
            <TouchableOpacity
              testID="book-tickets-btn"
              onPress={() => Linking.openURL(event.ticketUrl!)}
              style={[styles.bookBtn, { borderColor: activeColors.primary, borderRadius: activeRadius.full }]}
            >
              <Text style={[styles.bookBtnText, { color: activeColors.primary }]}>Book Tickets</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Who's Going */}
        {goingUsers.length > 0 && (
          <View style={[styles.section, { backgroundColor: activeColors.surface }]}>
            <Text style={[styles.sectionTitle, { color: activeColors.textMain }]}>Who's Going ({goingUsers.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {goingUsers.slice(0, 8).map((user, i) => (
                <View key={i} style={styles.goingUser}>
                  <View style={[styles.goingAvatar, { backgroundColor: activeColors.surfaceHighlight }]}>
                    <Text style={{ fontSize: 20 }}>🧑</Text>
                  </View>
                  <Text style={[styles.goingUsername, { color: activeColors.textMuted }]} numberOfLines={1}>@{user.username}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Detail Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: activeColors.surface }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {TABS.map(t => (
              <TouchableOpacity
                testID={`detail-tab-${t.key}`}
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tabPill, {
                  backgroundColor: tab === t.key ? activeColors.primary : activeColors.surfaceHighlight,
                  borderRadius: activeRadius.full,
                }]}
              >
                <Text style={[styles.tabPillText, { color: tab === t.key ? '#fff' : activeColors.textMuted }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TabContent event={event} tab={tab} colors={activeColors} />
        </View>

        {/* Reviews */}
        <View style={[styles.section, { backgroundColor: activeColors.surface }]}>
          <View style={styles.reviewsHeader}>
            <Text style={[styles.sectionTitle, { color: activeColors.textMain }]}>Reviews ({reviews.length})</Text>
            <TouchableOpacity
              testID="add-review-btn"
              onPress={() => setShowReviewModal(true)}
              style={[styles.addReviewBtn, { backgroundColor: activeColors.primary, borderRadius: activeRadius.full }]}
            >
              <Text style={styles.addReviewText}>+ Review</Text>
            </TouchableOpacity>
          </View>
          {reviews.slice(0, 5).map((review, i) => (
            <View key={i} style={[styles.reviewCard, { borderBottomColor: activeColors.border }]}>
              <View style={styles.reviewTop}>
                <Text style={[styles.reviewUser, { color: activeColors.textMain }]}>@{review.username}</Text>
                <View style={styles.reviewStars}>
                  {[1,2,3,4,5].map(s => (
                    <Ionicons key={s} name={s <= review.rating ? 'star' : 'star-outline'} size={14} color="#FFB800" />
                  ))}
                </View>
              </View>
              <Text style={[styles.reviewText, { color: activeColors.textMuted }]}>{review.text}</Text>
            </View>
          ))}
          {reviews.length === 0 && (
            <Text style={[styles.noInfo, { color: activeColors.textMuted }]}>No reviews yet. Be the first!</Text>
          )}
        </View>

        {/* Report Error */}
        <TouchableOpacity
          testID="report-error-btn"
          onPress={() => Alert.alert('Report an Error', 'Thank you! We\'ll review this event listing.')}
          style={styles.reportBtn}
        >
          <Ionicons name="flag-outline" size={14} color={activeColors.textMuted} />
          <Text style={[styles.reportBtnText, { color: activeColors.textMuted }]}>Report an error</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Privacy Modal */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPrivacyModal(false)}>
          <View style={[styles.sheet, { backgroundColor: activeColors.surface }]}>
            <View style={[styles.handle, { backgroundColor: activeColors.border }]} />
            <Text style={[styles.sheetTitle, { color: activeColors.textMain }]}>I'm Going 🎟️</Text>
            <Text style={[styles.sheetSub, { color: activeColors.textMuted }]}>Who can see your attendance?</Text>
            {[
              { privacy: 'public' as const, icon: '👀', label: 'Visible to Friends', desc: 'Your friends can see you\'re going' },
              { privacy: 'private' as const, icon: '🔒', label: 'Just Me (Private)', desc: 'Only you can see this' },
            ].map(opt => (
              <TouchableOpacity
                testID={`privacy-${opt.privacy}`}
                key={opt.privacy}
                onPress={() => confirmGoing(opt.privacy)}
                style={[styles.privacyOption, { backgroundColor: activeColors.surfaceHighlight, borderRadius: activeRadius.lg }]}
              >
                <Text style={styles.privacyIcon}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.privacyLabel, { color: activeColors.textMain }]}>{opt.label}</Text>
                  <Text style={[styles.privacyDesc, { color: activeColors.textMuted }]}>{opt.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={activeColors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Save to List Modal */}
      <Modal visible={showListModal} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowListModal(false)}>
          <View style={[styles.sheet, { backgroundColor: activeColors.surface }]}>
            <View style={[styles.handle, { backgroundColor: activeColors.border }]} />
            <Text style={[styles.sheetTitle, { color: activeColors.textMain }]}>Save to List</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {lists.map(list => {
                const inList = isInList(list.id, id!);
                return (
                  <TouchableOpacity
                    testID={`save-to-list-${list.id}`}
                    key={list.id}
                    onPress={async () => {
                      if (inList) await removeFromList(list.id, id!); else await addToList(list.id, id!);
                    }}
                    style={[styles.listOption, { borderBottomColor: activeColors.border }]}
                  >
                    <Text style={{ fontSize: 24 }}>{list.emoji}</Text>
                    <Text style={[styles.listOptionName, { color: activeColors.textMain, flex: 1 }]}>{list.name}</Text>
                    <Text style={[styles.listOptionCount, { color: activeColors.textMuted }]}>{list.eventIds.length}</Text>
                    {inList && <Ionicons name="checkmark-circle" size={22} color={activeColors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Review Modal */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowReviewModal(false)}>
          <View style={[styles.sheet, { backgroundColor: activeColors.surface }]}>
            <View style={[styles.handle, { backgroundColor: activeColors.border }]} />
            <Text style={[styles.sheetTitle, { color: activeColors.textMain }]}>Write a Review</Text>
            <View style={styles.starRow}>
              {[1,2,3,4,5].map(s => (
                <TouchableOpacity testID={`star-${s}`} key={s} onPress={() => setReviewRating(s)}>
                  <Ionicons name={s <= reviewRating ? 'star' : 'star-outline'} size={36} color="#FFB800" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              testID="review-text-input"
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Share your experience..."
              placeholderTextColor={activeColors.textMuted}
              multiline
              style={[styles.reviewInput, { backgroundColor: activeColors.surfaceHighlight, color: activeColors.textMain, borderRadius: activeRadius.md }]}
            />
            <TouchableOpacity
              testID="submit-review-btn"
              onPress={submitReview}
              disabled={submittingReview || !reviewText.trim()}
              style={[styles.submitBtn, { backgroundColor: reviewText.trim() ? activeColors.primary : activeColors.border, borderRadius: activeRadius.full }]}
            >
              {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Review</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  creditText: { fontSize: 11, marginTop: 12 },
  safe: { flex: 1 },
  heroContainer: { position: 'relative' },
  heroImage: { width: '100%', height: 260 },
  heroButtons: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  heroBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  heroRight: { flexDirection: 'row', gap: 8 },
  heroBadges: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', gap: 6 },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  infoSection: { padding: 20, gap: 8 },
  eventName: { fontSize: 24, fontWeight: '900', lineHeight: 30, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  metaText: { fontSize: 14, lineHeight: 20, flex: 1 },
  providerText: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { fontSize: 13 },
  lastUpdated: { fontSize: 11, marginTop: 4 },
  description: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginTop: 8 },
  actionsRow: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  goingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  goingBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bookBtn: { borderWidth: 2, paddingVertical: 14, paddingHorizontal: 18, justifyContent: 'center' },
  bookBtnText: { fontWeight: '700', fontSize: 14 },
  section: { padding: 20, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  goingUser: { alignItems: 'center', marginRight: 16, width: 60 },
  goingAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  goingUsername: { fontSize: 11, textAlign: 'center' },
  tabsContainer: { marginTop: 8, paddingTop: 16 },
  tabsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  tabPill: { paddingVertical: 8, paddingHorizontal: 14 },
  tabPillText: { fontSize: 13, fontWeight: '700' },
  tabContent: { paddingHorizontal: 16, paddingBottom: 16 },
  detailSection: { marginBottom: 16 },
  detailSectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  detailText: { fontSize: 14, flex: 1, lineHeight: 20 },
  noInfo: { fontSize: 14, textAlign: 'center', padding: 20 },
  accessRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  accessLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  accessBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  accessDetails: { fontSize: 13, lineHeight: 20, marginTop: 12 },
  ageCard: { padding: 16, marginBottom: 16, alignItems: 'center' },
  ageCardTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  ageCardValue: { fontSize: 22, fontWeight: '900' },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  addReviewBtn: { paddingVertical: 6, paddingHorizontal: 14 },
  addReviewText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  reviewCard: { paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewUser: { fontWeight: '700', fontSize: 14 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 14, lineHeight: 20 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 },
  reportBtnText: { fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sheetSub: { fontSize: 14, marginBottom: 20 },
  privacyOption: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, marginBottom: 12 },
  privacyIcon: { fontSize: 28 },
  privacyLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  privacyDesc: { fontSize: 13 },
  listOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, borderBottomWidth: 1 },
  listOptionName: { fontSize: 16, fontWeight: '600' },
  listOptionCount: { fontSize: 13 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  reviewInput: { padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
  submitBtn: { paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
