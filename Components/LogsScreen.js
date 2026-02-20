import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTelemetry } from '../context/TelemetryContext';
import { fetchReadingsRange, fetchAlertsRange } from '../services/api';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatTime(ts) {
  if (!ts) return 'Unknown';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

export default function LogsScreen() {
  const { history = [], alerts = [], logs = [], devices = [], remoteDeviceId } = useTelemetry();
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [fromDate, setFromDate] = useState(() => startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [toDate, setToDate] = useState(() => endOfDay(new Date()));
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remoteReadings, setRemoteReadings] = useState([]);
  const [remoteAlerts, setRemoteAlerts] = useState([]);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | reading | alert
  const [appliedRange, setAppliedRange] = useState({ fromMs: null, toMs: null });
  const resetRangeDefaults = useCallback(() => {
    setFromDate(startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    setToDate(endOfDay(new Date()));
  }, []);

  const deviceOptions = useMemo(() => {
    const known = new Map();
    known.set(null, 'All devices');

    devices.forEach((d) => {
      if (d?.id) known.set(d.id, d.name ?? d.id);
    });

    if (remoteDeviceId && !known.has(remoteDeviceId)) {
      known.set(remoteDeviceId, remoteDeviceId);
    }

    remoteReadings.forEach((r) => {
      const rid = r.deviceId ?? r.device ?? null;
      if (rid && !known.has(rid)) known.set(rid, rid);
    });

    return Array.from(known.entries()).map(([id, name]) => ({ id, name }));
  }, [devices, remoteDeviceId, remoteReadings]);

  // fetch from backend with date range so 7d works even for older entries
  const loadRemote = useCallback(async () => {
    setLoading(true);
    setError('');
    const from = startOfDay(fromDate);
    const to = endOfDay(toDate);
    setAppliedRange({ fromMs: from.getTime(), toMs: to.getTime() });
    setRemoteReadings([]);
    setRemoteAlerts([]);

    try {
      const targetDevices = selectedDeviceId
        ? [selectedDeviceId]
        : (devices?.map((d) => d.id).filter(Boolean) ?? []).concat(remoteDeviceId ? [remoteDeviceId] : []).filter(
            (v, i, arr) => arr.indexOf(v) === i
          );

      const results = [];
      const alertsResults = [];
      for (const dev of targetDevices.length ? targetDevices : ['esp32-01']) {
        try {
          const res = await fetchReadingsRange({ deviceId: dev, from, to, limit: 1000 });
          const readings = res?.readings ?? [];
          results.push(
            ...readings.map((r) => ({
              ...r,
              deviceId: r.deviceId ?? dev,
            }))
          );

          // fetch alerts for this device in range
          const alertsRes = await fetchAlertsRange({ deviceId: dev, from, to, limit: 500 });
          const alertsData = alertsRes?.alerts ?? [];
          alertsResults.push(
            ...alertsData.map((a) => ({
              ...a,
              deviceId: a.deviceId ?? dev,
            }))
          );
        } catch (innerErr) {
          // continue other devices, but surface the last error
          setError(innerErr instanceof Error ? innerErr.message : 'Failed to fetch logs');
        }
      }

      setRemoteReadings(results);
      setRemoteAlerts(alertsResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, devices, remoteDeviceId, fromDate, toDate]);

  const clearFilters = useCallback(() => {
    setSelectedDeviceId(null);
    setTypeFilter('all');
    resetRangeDefaults();
    setAppliedRange({ fromMs: null, toMs: null });
    setRemoteReadings([]);
    setError('');
  }, [resetRangeDefaults]);

  const filteredItems = useMemo(() => {
    // Do not show anything until user applies filters
    if (!appliedRange.fromMs && !appliedRange.toMs && remoteReadings.length === 0) {
      return [];
    }

    const parseMs = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    };

    const inRange = (ts) => {
      const ms = parseMs(ts);
      if (ms === null) return false;
      if (appliedRange.fromMs && ms < appliedRange.fromMs) return false;
      if (appliedRange.toMs && ms > appliedRange.toMs) return false;
      return true;
    };

    const readings = history.map((h, idx) => ({
      id: h.id ?? `reading-${idx}`,
      type: 'reading',
      deviceId: h.deviceId,
      timestamp: h.timestamp ?? h.ts ?? h.date,
      temperature: h.temperature,
      humidity: h.humidity,
      title: `Reading ${Number(h.temperature).toFixed(1)}°C / ${Number(h.humidity).toFixed(1)}%`,
      subtitle: h.deviceId,
    }));

    const alertItems = alerts.map((a, idx) => ({
      id: a.id ?? `alert-${idx}`,
      type: 'alert',
      deviceId: a.deviceId,
      timestamp: a.timestamp,
      title: a.title,
      subtitle: a.value,
    }));

    const remoteAlertItems = remoteAlerts.map((a, idx) => ({
      id: a.id ?? a.key ?? `remote-alert-${idx}`,
      type: 'alert',
      deviceId: a.deviceId,
      timestamp: a.timestamp ?? a.ts ?? a.date,
      title: a.title,
      subtitle: a.value,
      severity: a.severity,
    }));

    const remoteItems = remoteReadings.map((h, idx) => ({
      id: h.id ?? h.key ?? `remote-${idx}`,
      type: 'reading',
      deviceId: h.deviceId,
      timestamp: h.timestamp ?? h.ts ?? h.date,
      temperature: h.temperature,
      humidity: h.humidity,
      title: `Reading ${Number(h.temperature).toFixed(1)}°C / ${Number(h.humidity).toFixed(1)}%`,
      subtitle: h.deviceId,
    }));

    const combined = [...remoteItems, ...remoteAlertItems, ...readings, ...alertItems].filter((item) => {
      if (selectedDeviceId && item.deviceId !== selectedDeviceId) return false;
      if (!inRange(item.timestamp)) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      return true;
    });

    return combined.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
  }, [alerts, history, remoteReadings, selectedDeviceId, typeFilter, appliedRange]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.filtersCard}>
        <Text style={styles.filterLabel}>Device</Text>
        <View style={styles.deviceRow}>
          {deviceOptions.map((d) => {
            const isActive = d.id === selectedDeviceId;
            return (
              <TouchableOpacity
                key={d.id ?? 'all'}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSelectedDeviceId(d.id)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{d.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.filterLabel}>Date range</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.dateText}>From: {fromDate.toDateString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
            <Text style={styles.dateText}>To: {toDate.toDateString()}</Text>
          </TouchableOpacity>
        </View>
        {showFromPicker && (
          <DateTimePicker
            value={fromDate}
            mode="date"
            display="default"
            onChange={(e, v) => {
              setShowFromPicker(false);
              if (v) setFromDate(startOfDay(v));
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={toDate}
            mode="date"
            display="default"
            onChange={(e, v) => {
              setShowToPicker(false);
              if (v) setToDate(endOfDay(v));
            }}
          />
        )}

        <Text style={styles.filterLabel}>Type</Text>
        <View style={styles.deviceRow}>
          {['all', 'reading', 'alert'].map((t) => {
            const isActive = t === typeFilter;
            const label = t === 'all' ? 'All' : t === 'reading' ? 'Readings' : 'Alerts';
            return (
              <TouchableOpacity key={t} style={[styles.chip, isActive && styles.chipActive]} onPress={() => setTypeFilter(t)}>
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.searchBtn} onPress={loadRemote}>
          <Text style={styles.searchText}>Apply Filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
          <Text style={styles.clearText}>Clear Filters</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {loading ? <ActivityIndicator /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {filteredItems.length === 0 && !loading ? (
          <Text style={styles.empty}>No entries match your filters.</Text>
        ) : (
          filteredItems.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <MaterialCommunityIcons
                    name={item.type === 'alert' ? 'alert' : 'chart-line'}
                    size={16}
                    color={item.type === 'alert' ? '#B91C1C' : '#E67E22'}
                  />
                  <Text style={styles.cardType}>{item.type === 'alert' ? 'Alert' : 'Reading'}</Text>
                </View>
                <Text style={styles.cardTime}>{formatTime(item.timestamp)}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              <Text style={styles.cardDate}>{formatDate(item.timestamp)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12 },
  filtersCard: {
    backgroundColor: '#FFF8F1',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  filterLabel: { color: '#A0522D', fontWeight: '600', marginTop: 6, marginBottom: 6 },
  deviceRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFE8D6',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#E67E22' },
  chipText: { color: '#A0522D', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  list: {},
  empty: { color: '#6B4B2B', fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  cardType: { color: '#3D2914', fontWeight: '600', marginLeft: 6, fontSize: 13 },
  cardTime: { color: '#6B4B2B', fontSize: 12 },
  cardTitle: { color: '#3D2914', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  cardSubtitle: { color: '#A0522D', fontSize: 13 },
  cardDate: { color: '#6B4B2B', fontSize: 12, marginTop: 2 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dateBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginRight: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  dateText: { color: '#3D2914', fontWeight: '600' },
  searchBtn: {
    backgroundColor: '#E67E22',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  searchText: { color: '#FFFFFF', fontWeight: '700' },
  clearBtn: {
    borderColor: '#E67E22',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#FFF8F1',
  },
  clearText: { color: '#E67E22', fontWeight: '700' },
  error: { color: '#B91C1C', marginVertical: 6 },
});
