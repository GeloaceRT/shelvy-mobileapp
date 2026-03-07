import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTelemetry } from '../context/TelemetryContext';

const PI_FEED_URL = 'https://raspberrypi.tail6cdc1c.ts.net/';

export default function ReadingsScreen() {
  const { summary, history = [], devices = [], remoteDeviceId, dbError } = useTelemetry();
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);

  // parse timestamp-like values (ISO string or numeric ms) into milliseconds
  const parseToMs = (v) => {
    if (v == null) return 0;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.getTime();
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  function formatDbTime(entry) {
    if (!entry) return 'never';
    const toDate = (v) => {
      if (v == null) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const dateObj = entry.ts ? toDate(entry.ts) : entry.timestamp ? toDate(entry.timestamp) : entry.date ? toDate(entry.date) : null;
    if (!dateObj) return 'recently';
    const diffMs = Math.max(0, Date.now() - dateObj.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'moments ago';
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  // history is populated from DB by TelemetryContext; ensure consistent ordering (most recent first)
  const sortedHistory = [...(history || [])].sort((a, b) => {
    const ta = parseToMs(a?.timestamp ?? a?.ts ?? a?.date);
    const tb = parseToMs(b?.timestamp ?? b?.ts ?? b?.date);
    return tb - ta;
  });

  const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  const toDate = (v) => {
    if (v == null) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  const recentReadings = sortedHistory.slice(0, 3).map((r, idx) => {
    const d = toDate(r.timestamp ?? r.ts ?? r.date);
    return {
      id: r.id ?? idx,
      time: d ? d.toLocaleTimeString([], timeOpts) : 'Invalid Date',
      humidity: `${Number(r.humidity).toFixed(1)}%`,
      temperature: `${Number(r.temperature).toFixed(1)}°C`,
    };
  });

  // Build ping summary for the backend device only (map to local name)
  const targetDeviceName = devices?.[0]?.name ?? 'Casing 1';
  const lastEntry = sortedHistory[0] ?? null;
  const lastPingDate = lastEntry ? toDate(lastEntry.timestamp ?? lastEntry.ts ?? lastEntry.date) : null;
  const lastPingFormatted = lastPingDate ? lastPingDate.toLocaleTimeString([], timeOpts) : 'never';
  // Consider device online if device status is 'online' OR last ping within threshold
  const ONLINE_THRESHOLD_MS = Math.max(45000, 3 * 10000); // at least 45s or 3x auto-push interval
  const lastEntryMs = lastEntry ? parseToMs(lastEntry.timestamp ?? lastEntry.ts ?? lastEntry.date) : 0;
  const recentEnough = lastEntryMs && Date.now() - lastEntryMs < ONLINE_THRESHOLD_MS;
  const deviceStatus = devices?.[0]?.status ?? null;
  const isOnline = deviceStatus === 'online' || recentEnough;
  const pingSummary = [
    {
      id: remoteDeviceId ?? devices?.[0]?.id ?? 'casing-1',
      device: targetDeviceName,
      status: isOnline ? 'Online' : 'Offline',
      lastPing: lastEntry ? lastPingFormatted : 'never',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Feed</Text>
        <Text style={styles.subTitle}>Raspberry Pi Camera</Text>
        <View style={styles.videoCard}>
          {feedLoading && !feedError && (
            <ActivityIndicator
              style={styles.feedLoader}
              size="large"
              color="#E67E22"
            />
          )}
          {feedError ? (
            <Text style={styles.streamError}>
              Could not connect to the camera feed.{'\n'}Make sure your device is on the Tailscale network.
            </Text>
          ) : (
            <WebView
              style={styles.video}
              source={{ uri: PI_FEED_URL }}
              onLoadStart={() => { setFeedLoading(true); setFeedError(false); }}
              onLoadEnd={() => setFeedLoading(false)}
              onError={() => { setFeedLoading(false); setFeedError(true); }}
              onHttpError={() => { setFeedLoading(false); setFeedError(true); }}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Readings</Text>
        {recentReadings.map((reading) => (
          <TouchableOpacity key={reading.id} style={styles.readingRow}>
            <Text style={styles.readingTime}>{reading.time}</Text>
            <Text style={styles.readingData}>Humidity: {reading.humidity} | Temp: {reading.temperature}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ping Summary</Text>
        <Text style={styles.subTitle}>All Device Pings</Text>
        {/* Auto-push runs every 10s while this screen is mounted */}
        {dbError ? <Text style={styles.dbError}>{dbError}</Text> : null}
        {pingSummary.map((ping) => (
          <TouchableOpacity key={ping.id} style={styles.pingRow}>
            <MaterialCommunityIcons name="router-wireless" size={20} color="#E67E22" />
            <View style={styles.pingInfo}>
              <Text style={styles.pingDevice}>{ping.device}</Text>
              <Text style={styles.pingStatus}>{ping.status} - Last ping: {ping.lastPing}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A0522D',
    fontFamily: 'System',
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 16,
    color: '#A0522D',
    fontFamily: 'System',
    marginBottom: 8,
  },
  videoCard: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    height: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  video: {
    flex: 1,
    backgroundColor: '#111',
  },
  feedLoader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1,
  },
  streamError: {
    margin: 16,
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
  },
  readingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readingTime: {
    fontSize: 14,
    color: '#A0522D',
    fontFamily: 'System',
    fontWeight: 'bold',
  },
  readingData: {
    fontSize: 14,
    color: '#A0522D',
    fontFamily: 'System',
  },
  pingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pingInfo: {
    marginLeft: 12,
  },
  pingDevice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#A0522D',
    fontFamily: 'System',
  },
  pingStatus: {
    fontSize: 14,
    color: '#A0522D',
    fontFamily: 'System',
  },
  pushButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#3D2914',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
    marginTop: 8,
  },
  pushButtonPressed: { opacity: 0.85 },
  pushText: { color: '#FBD6A4', fontSize: 12, fontWeight: '600' },
  dbInfo: { fontSize: 12, color: '#6B4B2B', marginBottom: 8 },
  dbError: { fontSize: 12, color: '#B91C1C', marginBottom: 8 },
});
