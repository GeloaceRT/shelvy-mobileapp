import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import IndicatorCard from './IndicatorCard';
import ButtonPrimary from './ButtonPrimary';
import { useTelemetry } from '../context/TelemetryContext';

function formatRelativeTime(isoDate) {
  if (!isoDate) {
    return 'moments ago';
  }

  const diffMs = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'moments ago';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export default function DashboardScreen({ user }) {
  const { summary, devices = [], alerts = [], logs = [], status, setActiveDevice, refreshTelemetry } =
    useTelemetry();
  
  const activeDevice = devices.find((device) => device.id === summary?.deviceId) || devices[0] || null;
  const displayAlerts = alerts.slice(0, 4);
  const displayLogs = logs.slice(0, 3);
  const temperatureTrend = summary?.temperatureTrend ?? 0;
  const humidityTrend = summary?.humidityTrend ?? 0;
  const statusLabel = activeDevice ? 'Live' : 'Idle';

  

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.welcomeCard}>
        <Text style={styles.greeting}>Hello! 👋</Text>
        <Text style={styles.welcomeTitle}>Welcome back {user?.name ?? 'Baker'}</Text>
        <Text style={styles.welcomeSubtitle}>Keep every loaf perfectly proofed with Shelvy.</Text>
      </View>

      <View style={styles.selectorCard}>
        <View style={styles.selectorHeader}>
          <View>
            <Text style={styles.selectorLabel}>Active device</Text>
            <Text style={styles.selectorValue}>{activeDevice ? activeDevice.name : 'No device selected'}</Text>
            <Text style={styles.selectorLocation}>
              {activeDevice ? activeDevice.location : 'Select a device to view live telemetry.'}
            </Text>
          </View>
          <View style={styles.statusColumn}>
            <View style={styles.statusPill}>
              <View
                style={[styles.statusDot, status?.isLive ? styles.statusDotActive : styles.statusDotIdle]}
              />
              <Text style={styles.statusText}>{status?.isLive ? 'Live' : 'Offline'}</Text>
            </View>
            <Text style={styles.selectorTimestamp}>
              {status?.lastSyncedAt
                ? formatRelativeTime(status.lastSyncedAt)
                : formatRelativeTime(summary?.lastUpdated)}
            </Text>
          </View>
        </View>
        {status?.error ? <Text style={styles.errorBanner}>{status.error}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshButtonPressed]}
          onPress={refreshTelemetry}
          disabled={status?.isLoading}
        >
          <Text style={styles.refreshText}>{status?.isLoading ? 'Refreshing…' : 'Refresh Now'}</Text>
        </Pressable>
        <View style={styles.chipRow}>
          {devices.map((device) => {
            const isActive = device.id === summary?.deviceId;
            return (
              <Pressable
                key={device.id}
                style={({ pressed }) => [
                  styles.deviceChip,
                  isActive && styles.deviceChipActive,
                  pressed && styles.deviceChipPressed,
                ]}
                onPress={() => setActiveDevice(device.id)}
              >
                <Text style={[styles.deviceChipText, isActive && styles.deviceChipTextActive]}>{device.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.cardsRow}>
        <IndicatorCard
          type="humidity"
          value={summary ? summary.humidity : '--'}
          unit="%"
          icon="water"
          status={statusLabel}
          optimal="50-70%"
          timestamp={formatRelativeTime(summary?.lastUpdated)}
          trend={{
            value: Number.isFinite(humidityTrend) ? Math.abs(humidityTrend) : 0,
            unit: '%',
            direction: humidityTrend >= 0 ? 'up' : 'down',
            color: humidityTrend >= 0 ? '#16A34A' : '#DC2626',
          }}
        />
        <IndicatorCard
          type="temperature"
          value={summary ? summary.temperature : '--'}
          unit="°C"
          icon="thermometer"
          status={statusLabel}
          timestamp={formatRelativeTime(summary?.lastUpdated)}
          trend={{
            value: Number.isFinite(temperatureTrend) ? Math.abs(temperatureTrend) : 0,
            unit: '°C',
            direction: temperatureTrend >= 0 ? 'up' : 'down',
            color: temperatureTrend >= 0 ? '#F97316' : '#0EA5E9',
          }}
        />
      </View>

      {/* Removed Current device connected widget per request */}

      <View style={styles.logsSection}>
        <Text style={styles.cardTitle}>Recent readings</Text>
        {displayLogs.length === 0 && <Text style={styles.emptyState}>No recent readings yet.</Text>}
        {displayLogs.map((entry, idx) => {
          const ts = entry.timestamp ?? entry.date ?? entry.ts ?? null;
          const d = ts ? new Date(ts) : null;
          const timeStr = d && !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : formatRelativeTime(entry.timestamp);
          // try to extract temperature/humidity from event if present (e.g. 'Reading 27.1°C / 55.1%')
          const match = typeof entry.event === 'string' ? entry.event.match(/([0-9]+\.?[0-9]*)°C\s*\/\s*([0-9]+\.?[0-9]*)%/) : null;
          const temperature = match ? `${match[1]}°C` : '--';
          const humidity = match ? `${match[2]}%` : entry.deviceId ? `${entry.deviceId}` : '--';

          return (
            <View style={styles.readingRow} key={entry.id ?? `log-${idx}`}>
              <Text style={styles.readingTime}>{timeStr}</Text>
              <Text style={styles.readingData}>Humidity: {humidity} | Temp: {temperature}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.alertSection}>
        <View style={styles.alertHeader}>
          <Text style={styles.cardTitle}>Alerts</Text>
          <Text style={styles.alertSubtitle}>Recent notifications</Text>
        </View>
        {displayAlerts.length === 0 && (
          <Text style={styles.emptyState}>No alerts yet. All devices are performing well.</Text>
        )}
        {displayAlerts.map((alert) => {
          const isWarning = alert.severity === 'warning';
          return (
            <View style={styles.alertRow} key={alert.id}>
              <View style={[styles.alertIcon, isWarning ? styles.alertIconWarning : styles.alertIconSuccess]}>
                <Feather
                  name={isWarning ? 'alert-triangle' : 'check-circle'}
                  size={18}
                  color={isWarning ? '#B45309' : '#047857'}
                />
              </View>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <View style={styles.alertMetaRow}>
                  <Text style={styles.alertMeta}>{formatRelativeTime(alert.timestamp)}</Text>
                  <Text style={styles.alertMeta}>{alert.value}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  greeting: {
    fontSize: 16,
    color: '#A0522D',
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3D2914',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6B4B2B',
  },
  selectorCard: {
    backgroundColor: '#FFF8F1',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusColumn: {
    alignItems: 'flex-end',
  },
  selectorLabel: {
    color: '#A0522D',
    fontSize: 14,
  },
  selectorValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3D2914',
    marginTop: 2,
  },
  selectorLocation: {
    fontSize: 12,
    color: '#6B4B2B',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEEAD8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: '#A0522D',
  },
  statusDotActive: {
    backgroundColor: '#16A34A',
  },
  statusDotIdle: {
    backgroundColor: '#B91C1C',
  },
  statusText: {
    fontSize: 12,
    color: '#3D2914',
    fontWeight: '600',
  },
  selectorTimestamp: {
    fontSize: 12,
    color: '#A0522D',
  },
  errorBanner: {
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    fontSize: 12,
  },
  refreshButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#E67E22',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
  },
  refreshButtonPressed: {
    opacity: 0.8,
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pushButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#3D2914',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  pushButtonPressed: {
    opacity: 0.85,
  },
  pushText: {
    color: '#FBD6A4',
    fontSize: 12,
    fontWeight: '600',
  },
  dbInfo: {
    fontSize: 12,
    color: '#6B4B2B',
    marginBottom: 8,
  },
  dbError: {
    fontSize: 12,
    color: '#B91C1C',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  deviceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFE8D6',
    marginRight: 10,
    marginBottom: 10,
  },
  deviceChipActive: {
    backgroundColor: '#E67E22',
  },
  deviceChipPressed: {
    opacity: 0.85,
  },
  deviceChipText: {
    color: '#A0522D',
    fontWeight: '600',
    fontSize: 14,
  },
  deviceChipTextActive: {
    color: '#FFFFFF',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  deviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3D2914',
    marginBottom: 12,
  },
  deviceDetails: {
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B4B2B',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3D2914',
  },
  emptyState: {
    fontSize: 14,
    color: '#6B4B2B',
  },
  logsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logEvent: {
    fontSize: 14,
    color: '#3D2914',
    fontWeight: '600',
  },
  logMeta: {
    fontSize: 12,
    color: '#A0522D',
    marginTop: 2,
  },
  logTime: {
    fontSize: 12,
    color: '#A0522D',
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
    fontWeight: 'bold',
  },
  readingData: {
    fontSize: 14,
    color: '#A0522D',
  },
  alertSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  alertHeader: {
    marginBottom: 12,
  },
  alertSubtitle: {
    fontSize: 13,
    color: '#6B4B2B',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E5D8',
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertIconWarning: {
    backgroundColor: '#FEF3C7',
  },
  alertIconSuccess: {
    backgroundColor: '#CCFBF1',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    color: '#3D2914',
    fontWeight: '600',
    marginBottom: 4,
  },
  alertMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  alertMeta: {
    fontSize: 12,
    color: '#6B4B2B',
  },
});
