/**
 * Live weather forecast for outdoor events. Uses Open-Meteo (no API key).
 * Shows a compact badge with the WMO weather icon + high/low + summary
 * for the event's date.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  lat?: number;
  lng?: number;
  date: string; // ISO YYYY-MM-DD
  themeColors: {
    surface: string;
    surfaceHighlight: string;
    textMain: string;
    textMuted: string;
    primary: string;
  };
  radius: number;
}

// WMO weather interpretation codes → emoji + label
// https://open-meteo.com/en/docs#weathervariables
const WEATHER_CODES: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️', label: 'Clear sky' },
  1: { emoji: '🌤️', label: 'Mainly clear' },
  2: { emoji: '⛅', label: 'Partly cloudy' },
  3: { emoji: '☁️', label: 'Overcast' },
  45: { emoji: '🌫️', label: 'Fog' },
  48: { emoji: '🌫️', label: 'Rime fog' },
  51: { emoji: '🌦️', label: 'Light drizzle' },
  53: { emoji: '🌦️', label: 'Drizzle' },
  55: { emoji: '🌦️', label: 'Heavy drizzle' },
  61: { emoji: '🌧️', label: 'Light rain' },
  63: { emoji: '🌧️', label: 'Rain' },
  65: { emoji: '🌧️', label: 'Heavy rain' },
  71: { emoji: '🌨️', label: 'Light snow' },
  73: { emoji: '🌨️', label: 'Snow' },
  75: { emoji: '🌨️', label: 'Heavy snow' },
  77: { emoji: '🌨️', label: 'Snow grains' },
  80: { emoji: '🌦️', label: 'Rain showers' },
  81: { emoji: '🌧️', label: 'Heavy showers' },
  82: { emoji: '⛈️', label: 'Violent showers' },
  85: { emoji: '🌨️', label: 'Snow showers' },
  86: { emoji: '🌨️', label: 'Heavy snow showers' },
  95: { emoji: '⛈️', label: 'Thunderstorm' },
  96: { emoji: '⛈️', label: 'Storm with hail' },
  99: { emoji: '⛈️', label: 'Severe thunderstorm' },
};

interface Forecast {
  code: number;
  max: number;
  min: number;
  precip: number;
  windSpeed: number;
}

export default function WeatherBadge({ lat, lng, date, themeColors, radius }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!lat || !lng || !date) {
      setLoading(false);
      setError(true);
      return;
    }
    // Open-Meteo only supports forecasts for the next ~16 days.
    // If event is too far away just hide the badge gracefully.
    const eventDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 14 || diffDays < -1) {
      setLoading(false);
      setError(true);
      return;
    }
    const dateStr = eventDate.toISOString().slice(0, 10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;

    (async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        const daily = data?.daily;
        if (!daily?.weathercode?.length) throw new Error('no data');
        setForecast({
          code: daily.weathercode[0],
          max: daily.temperature_2m_max[0],
          min: daily.temperature_2m_min[0],
          precip: daily.precipitation_sum?.[0] ?? 0,
          windSpeed: daily.wind_speed_10m_max?.[0] ?? 0,
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [lat, lng, date]);

  if (loading) {
    return (
      <View style={[styles.box, { backgroundColor: themeColors.surfaceHighlight, borderRadius: radius }]}>
        <ActivityIndicator size="small" color={themeColors.primary} />
        <Text style={[styles.title, { color: themeColors.textMuted }]}>Loading weather…</Text>
      </View>
    );
  }

  if (error || !forecast) {
    return null;
  }

  const info = WEATHER_CODES[forecast.code] || { emoji: '🌡️', label: 'Forecast' };

  return (
    <View style={[styles.box, { backgroundColor: themeColors.surfaceHighlight, borderRadius: radius }]}>
      <Text style={styles.emoji}>{info.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: themeColors.textMain }]}>
          Weather forecast · {info.label}
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {Math.round(forecast.max)}° / {Math.round(forecast.min)}°C
          {forecast.precip > 0 ? `  ·  💧 ${forecast.precip.toFixed(1)}mm` : ''}
          {forecast.windSpeed > 25 ? `  ·  💨 ${Math.round(forecast.windSpeed)}km/h` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 12 },
  emoji: { fontSize: 32 },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
