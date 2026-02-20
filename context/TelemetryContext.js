import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  fetchLatestReading,
  fetchReadingAlerts,
  pushReading,
  fetchDeviceSecret,
  fetchReadingsHistory,
  fetchLatestFromDb,
  DEFAULT_DEVICE_SECRET,
} from '../services/api';

const TelemetryContext = createContext(null);

const CASING_DEVICE_ID = 'esp32-01';
const HISTORY_LIMIT = 20;
const LOG_LIMIT = 20;
const POLL_INTERVAL_MS = 5000;
const AUTO_PUSH_INTERVAL_MS = 10000;
const STALE_READING_THRESHOLD_MS = 30_000;
const MIN_TEMP_C = -20;
const MAX_TEMP_C = 80;
const MIN_HUMIDITY = 0;
const MAX_HUMIDITY = 100;
const CRITICAL_SEVERITIES = ['warning', 'error'];
const NOTIFICATION_CHANNEL_ID = 'shelvy-critical-alerts';
const ENABLE_ALERT_NOTIFICATIONS = true;
const NOTIFICATION_COOLDOWN_MS = 2 * 60 * 1000;
const ALERT_HISTORY_LIMIT = 20;
const VIBRATION_PATTERN = [0, 300, 150, 300, 150, 400];

const isNotificationPermissionGranted = (permissionStatus) =>
  Boolean(
    permissionStatus &&
      (permissionStatus.granted ||
        permissionStatus.status === Notifications.AuthorizationStatus.GRANTED ||
        permissionStatus.status === Notifications.AuthorizationStatus.PROVISIONAL)
  );

let notificationHandlerRegistered = false;

if (!notificationHandlerRegistered) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerRegistered = true;
}

const createInitialState = () => {
  const now = new Date();
  const isoNow = now.toISOString();

  const devices = [
    {
      id: CASING_DEVICE_ID,
      name: 'Casing 1',
      location: 'Bakery Floor · Section A',
      temperature: 25.4,
      humidity: 62,
      status: 'online',
      isActive: true,
      lastUpdated: isoNow,
    },
  ];

  const summary = {
    temperature: devices[0].temperature,
    humidity: devices[0].humidity,
    temperatureTrend: 0.3,
    humidityTrend: -1.1,
    lastUpdated: devices[0].lastUpdated,
    deviceId: devices[0].id,
  };

  const alerts = [
    {
      id: 'alert-1',
      deviceId: devices[0].id,
      title: 'High temperature resolved',
      severity: 'success',
      timestamp: isoNow,
      value: 'Back in range',
    },
  ];

  const logs = [
    {
      id: 'log-1',
      timestamp: isoNow,
      deviceId: devices[0].id,
      event: 'Telemetry stream started',
      type: 'info',
    },
    {
      id: 'log-2',
      timestamp: isoNow,
      deviceId: devices[0].id,
      event: 'Ping 25.4°C / 62%',
      type: 'metric',
    },
  ];

  const history = [
    {
      id: 'reading-1',
      deviceId: devices[0].id,
      temperature: devices[0].temperature,
      humidity: devices[0].humidity,
      timestamp: isoNow,
    },
    {
      id: 'reading-2',
      deviceId: devices[0].id,
      temperature: 25.7,
      humidity: 61.5,
      timestamp: isoNow,
    },
    {
      id: 'reading-3',
      deviceId: devices[0].id,
      temperature: 26.1,
      humidity: 60.8,
      timestamp: isoNow,
    },
  ];

  return {
    summary,
    devices,
    alerts,
    logs,
    history,
    activeDeviceId: devices[0].id,
    lastUpdated: isoNow,
  };
};

const INITIAL_STATUS = {
  isLive: false,
  isLoading: false,
  error: null,
  lastSyncedAt: null,
};

export function TelemetryProvider({ token, children }) {
  const [state, setState] = useState(() => createInitialState());
  const [dbError, setDbError] = useState('');
  const stateRef = useRef(null);
  const remoteDeviceIdRef = useRef(null);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const alertHistoryRef = useRef(new Map());
  const notificationsReadyRef = useRef(false);
  const isMountedRef = useRef(true);
  const activeTokenRef = useRef(token ?? null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // keep a ref to latest state so long-running intervals/readers use current values
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    activeTokenRef.current = token ?? null;
  }, [token]);

  useEffect(() => {
    let isActive = true;

    const configureNotifications = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
            name: 'Shelvy critical alerts',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: VIBRATION_PATTERN,
            sound: 'default',
          });
        }

        const settings = await Notifications.getPermissionsAsync();
        let granted = isNotificationPermissionGranted(settings);

        if (!granted) {
          const request = await Notifications.requestPermissionsAsync();
          granted = isNotificationPermissionGranted(request);
        }

        if (!isActive) {
          return;
        }

        notificationsReadyRef.current = Boolean(granted);
      } catch (error) {
        console.warn('[Telemetry] notification setup failed', error);
      }
    };

    configureNotifications();

    return () => {
      isActive = false;
    };
  }, []);

  const registerCriticalAlerts = useCallback((criticalAlerts) => {
    if (!criticalAlerts?.length) {
      return [];
    }

    const now = Date.now();
    const triggered = [];

    criticalAlerts.forEach((alert) => {
      const key = `${alert.title}|${alert.value}`;
      const lastTriggeredAt = alertHistoryRef.current.get(key) ?? 0;
      if (now - lastTriggeredAt >= NOTIFICATION_COOLDOWN_MS) {
        alertHistoryRef.current.set(key, now);
        triggered.push(alert);
      }
    });

    if (alertHistoryRef.current.size > ALERT_HISTORY_LIMIT) {
      const sortedEntries = [...alertHistoryRef.current.entries()].sort((a, b) => a[1] - b[1]);
      while (sortedEntries.length > ALERT_HISTORY_LIMIT) {
        const [staleKey] = sortedEntries.shift() ?? [];
        if (staleKey) {
          alertHistoryRef.current.delete(staleKey);
        }
      }
    }

    return triggered;
  }, []);

  const deliverCriticalNotifications = useCallback(async (alertsToNotify) => {
    if (!ENABLE_ALERT_NOTIFICATIONS) return; // suppress popups/vibration during testing
    if (!alertsToNotify?.length) {
      return;
    }

    try {
      Vibration.vibrate(VIBRATION_PATTERN);

      const messageBody = alertsToNotify.map((alert) => `• ${alert.title}`).join('\n');

      if (!notificationsReadyRef.current) {
        Alert.alert('Shelvy Alert', messageBody);
        return;
      }

      await Promise.all(
        alertsToNotify.map((alert) =>
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Shelvy Alert',
              body: alert.title,
              sound: 'default',
              data: {
                severity: alert.severity,
                value: alert.value,
                deviceId: alert.deviceId,
              },
            },
            trigger: null,
          })
        )
      );
    } catch (error) {
      console.warn('[Telemetry] failed to schedule critical alert notification', error);
    }
  }, []);

  const refreshTelemetry = useCallback(async () => {
    if (!token || !isMountedRef.current) {
      return;
    }

    setStatus((prev) => ({ ...prev, isLoading: true }));

    try {
      const reading = await fetchLatestReading(token);
      if (!reading) {
        throw new Error('No sensor data available.');
      }

      const temperature = Number(reading.temperature ?? NaN);
      const humidity = Number(reading.humidity ?? NaN);
      if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
        throw new Error('Received invalid sensor values.');
      }

      if (
        temperature < MIN_TEMP_C ||
        temperature > MAX_TEMP_C ||
        humidity < MIN_HUMIDITY ||
        humidity > MAX_HUMIDITY
      ) {
        throw new Error(
          `Sensor reading out of expected range. Temp ${temperature.toFixed(1)}°C, RH ${humidity.toFixed(1)}%.`
        );
      }

      const capturedAt = reading.capturedAt ? new Date(reading.capturedAt) : new Date();
      const isoCapturedAt = capturedAt.toISOString();

      const ageMs = Date.now() - capturedAt.getTime();
      if (ageMs > STALE_READING_THRESHOLD_MS) {
        const seconds = Math.round(ageMs / 1000);
        throw new Error(`Sensor data is stale. Last update ${seconds}s ago.`);
      }

      let alertsPayload;
      try {
        alertsPayload = await fetchReadingAlerts(token);
      } catch (alertsError) {
        console.warn('[Telemetry] failed to fetch alerts', alertsError);
      }

      if (!isMountedRef.current || activeTokenRef.current !== token) {
        return;
      }

      const alerts = Array.isArray(alertsPayload?.alerts)
        ? alertsPayload.alerts.map((item, index) => {
            // Normalize both legacy string messages and new alert objects from backend
            if (item && typeof item === 'object') {
              const title = item.title ?? item.message ?? String(item);
              const sev = item.severity ?? (/high|critical|low/i.test(String(title)) ? 'warning' : 'info');
              const tsVal = item.timestamp ?? item.ts;
              const tsIso = tsVal ? new Date(Number(tsVal)).toISOString() : isoCapturedAt;
              const val = item.value ?? `${humidity.toFixed(1)}% · ${temperature.toFixed(1)}°C`;
              return {
                id: item.id ?? `alert-${tsVal ?? Date.now()}-${index}`,
                deviceId: item.deviceId ?? CASING_DEVICE_ID,
                title,
                severity: sev,
                timestamp: tsIso,
                value: String(val),
              };
            }

            const title = String(item);
            return {
              id: `alert-${Date.now()}-${index}`,
              deviceId: CASING_DEVICE_ID,
              title,
              severity: /high|critical|low/i.test(title) ? 'warning' : 'info',
              timestamp: isoCapturedAt,
              value: `${humidity.toFixed(1)}% · ${temperature.toFixed(1)}°C`,
            };
          })
        : null;

      const triggeredCriticalAlerts = registerCriticalAlerts(
        alerts?.filter((alert) => CRITICAL_SEVERITIES.includes(alert.severity)) ?? []
      );

      if (triggeredCriticalAlerts.length) {
        await deliverCriticalNotifications(triggeredCriticalAlerts);
      }

      const alertLogEntries = triggeredCriticalAlerts.map((alert, index) => ({
        id: `log-alert-${Date.now()}-${index}`,
        timestamp: isoCapturedAt,
        deviceId: alert.deviceId,
        event: alert.title,
        type: 'alert',
      }));

      setState((prev) => {
        const activeDeviceId = prev.activeDeviceId ?? CASING_DEVICE_ID;
        const isCasingActive = activeDeviceId === CASING_DEVICE_ID;

        const previousTemp =
          typeof prev.summary.temperature === 'number' ? prev.summary.temperature : temperature;
        const previousHumidity =
          typeof prev.summary.humidity === 'number' ? prev.summary.humidity : humidity;

        const baseDevice =
          prev.devices.find((device) => device.id === CASING_DEVICE_ID) ?? {
            id: CASING_DEVICE_ID,
            name: 'Casing 1',
            location: 'Bakery Floor · Section A',
            status: 'online',
            isActive: true,
            lastUpdated: isoCapturedAt,
          };

        const updatedCasing = {
          ...baseDevice,
          temperature,
          humidity,
          status: 'online',
          isActive: isCasingActive,
          lastUpdated: isoCapturedAt,
        };

        const otherDevices = prev.devices
          .filter((device) => device.id !== CASING_DEVICE_ID)
          .map((device) => ({
            ...device,
            isActive: device.id === activeDeviceId,
          }));

        const historyEntry = {
          id: `reading-${Date.now()}`,
          deviceId: CASING_DEVICE_ID,
          temperature,
          humidity,
          timestamp: isoCapturedAt,
        };

        const logEntry = {
          id: `log-${Date.now()}`,
          timestamp: isoCapturedAt,
          deviceId: CASING_DEVICE_ID,
          event: `Reading ${temperature.toFixed(1)}°C / ${humidity.toFixed(1)}%`,
          type: 'metric',
        };

        const summary = isCasingActive
          ? {
              temperature,
              humidity,
              temperatureTrend: Number((temperature - previousTemp).toFixed(2)),
              humidityTrend: Number((humidity - previousHumidity).toFixed(2)),
              lastUpdated: isoCapturedAt,
              deviceId: CASING_DEVICE_ID,
            }
          : prev.summary;

        return {
          ...prev,
          summary,
          devices: [updatedCasing, ...otherDevices],
          history: [historyEntry, ...prev.history].slice(0, HISTORY_LIMIT),
          logs: [...alertLogEntries, logEntry, ...prev.logs].slice(0, LOG_LIMIT),
          alerts: alerts ?? prev.alerts,
          activeDeviceId,
          lastUpdated: isoCapturedAt,
        };
      });

      if (!isMountedRef.current || activeTokenRef.current !== token) {
        return;
      }

      setStatus((prev) => ({
        ...prev,
        isLive: true,
        isLoading: false,
        error: null,
        lastSyncedAt: isoCapturedAt,
      }));
    } catch (error) {
      if (!isMountedRef.current || activeTokenRef.current !== token) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to fetch readings.';
      console.warn('[Telemetry] refresh failed', error);
      setStatus((prev) => ({
        ...prev,
        isLive: false,
        isLoading: false,
        error: message,
      }));
    }
  }, [token, deliverCriticalNotifications, registerCriticalAlerts]);

  useEffect(() => {
    if (!token) {
      setState(createInitialState());
      setStatus(INITIAL_STATUS);
      return;
    }

    let isCancelled = false;
    let timerId;

    const tick = async () => {
      await refreshTelemetry();
      if (!isCancelled) {
        timerId = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    tick();

    return () => {
      isCancelled = true;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [token, refreshTelemetry]);

  // Auto-push to backend RTDB and sync history from DB (app-wide)
  useEffect(() => {
    if (!token || !isMountedRef.current) return;

    let timer = null;
    let deviceSecret = DEFAULT_DEVICE_SECRET;
    let deviceId = null;

    const initAndStart = async () => {
      try {
        const cfg = await fetchDeviceSecret();
        deviceSecret = cfg?.deviceSecret ?? DEFAULT_DEVICE_SECRET;
        deviceId = cfg?.deviceId ?? CASING_DEVICE_ID;
        remoteDeviceIdRef.current = deviceId;
      } catch (e) {
        // ignore, use defaults
        deviceId = CASING_DEVICE_ID;
      }

      // initial history fetch
      try {
        const histRes = await fetchReadingsHistory(token, 3);
        const readings = histRes?.readings ?? [];
        if (readings.length) {
          const mapped = readings
            .slice()
            .reverse()
            .map((r) => ({
              id: r.key ?? `reading-${r.ts ?? Date.now()}`,
              deviceId: r.deviceId ?? deviceId,
              temperature: Number(r.temperature),
              humidity: Number(r.humidity),
              timestamp: r.ts ? new Date(Number(r.ts)).toISOString() : r.date ?? new Date().toISOString(),
            }));
          setState((prev) => ({ ...prev, history: mapped }));
          setDbError('');
        }
      } catch (e) {
        setDbError(e instanceof Error ? e.message : 'Failed to load DB history');
      }

      // start auto-push interval
      timer = setInterval(async () => {
        if (!isMountedRef.current) return;
        try {
          const s = stateRef.current?.summary ?? {};
          if (!s || typeof s.temperature !== 'number' || typeof s.humidity !== 'number') return;
          const payload = { ts: Date.now(), temperature: Number(s.temperature), humidity: Number(s.humidity) };
          await pushReading(deviceId ?? CASING_DEVICE_ID, payload, deviceSecret);
          // refresh history after push
          try {
            const histRes = await fetchReadingsHistory(token, 3);
            const readings = histRes?.readings ?? [];
            const mapped = readings
              .slice()
              .reverse()
              .map((r) => ({
                id: r.key ?? `reading-${r.ts ?? Date.now()}`,
                deviceId: r.deviceId ?? deviceId,
                temperature: Number(r.temperature),
                humidity: Number(r.humidity),
                timestamp: r.ts ? new Date(Number(r.ts)).toISOString() : r.date ?? new Date().toISOString(),
              }));
            setState((prev) => ({ ...prev, history: mapped }));
            setDbError('');
          } catch (e) {
            setDbError(e instanceof Error ? e.message : 'Failed to refresh DB history');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('403') || /device secret/i.test(msg) || /invalid device secret/i.test(msg)) {
            setDbError('Invalid device secret for RTDB pushes.');
          } else {
            setDbError(msg || 'Auto-push failed');
          }
        }
      }, AUTO_PUSH_INTERVAL_MS);
    };

    initAndStart();

    return () => {
      if (timer) clearInterval(timer);
    };
    // depend on token and state.summary changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setActiveDevice = useCallback((deviceId) => {
    setState((prev) => {
      if (!deviceId || !prev.devices.some((device) => device.id === deviceId)) {
        return prev;
      }

      if (prev.activeDeviceId === deviceId) {
        return prev;
      }

      const devices = prev.devices.map((device) => ({
        ...device,
        isActive: device.id === deviceId,
      }));

      const active = devices.find((device) => device.id === deviceId);
      if (!active) {
        return prev;
      }

      return {
        ...prev,
        devices,
        activeDeviceId: deviceId,
        summary: {
          ...prev.summary,
          temperature: active.temperature,
          humidity: active.humidity,
          temperatureTrend: 0,
          humidityTrend: 0,
          lastUpdated: active.lastUpdated,
          deviceId,
        },
      };
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      ...state,
      status,
      dbError,
      remoteDeviceId: remoteDeviceIdRef.current,
      setActiveDevice,
      refreshTelemetry,
    }),
    [state, status, refreshTelemetry, setActiveDevice]
  );

  return <TelemetryContext.Provider value={contextValue}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);

  if (!context) {
    throw new Error('useTelemetry must be used within TelemetryProvider');
  }

  return context;
}
