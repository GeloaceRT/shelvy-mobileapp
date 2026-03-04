import { Request, Response } from 'express';
import config from '../config';
import sensorService, { SensorData, SensorService } from '../services/sensor.service';
import { AlertService } from '../services/alert.service';

export class ReadingsController {
    constructor(private readonly service: SensorService = sensorService, private readonly alertService: AlertService = new AlertService()) {}

    // Dual-mode: if called without Express req/res, return raw data for unit tests.
    public getReadings = async (_req?: Request, res?: Response): Promise<any> => {
        try {
            const data = await this.service.readSensorData();
            if (!res) return data;
            return res.status(200).json(data);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error fetching readings';
            if (!res) throw error;
            return res.status(500).json({ message });
        }
    };

    public alertCriticalLevels = async (_req?: Request, res?: Response): Promise<any> => {
        try {
            const { humidity, temperature } = await this.service.readSensorData();
            // trigger alert notifications on thresholds (or always in test mode)
            const tempThreshold = config.alert.threshold.temperature;
            const humidityThreshold = config.alert.threshold.humidity;
            const force = config.alert.testMode;

            if (force || humidity > humidityThreshold) {
                this.alertService.sendAlert(`Humidity level critical: ${humidity}%`);
            }
            if (force || temperature > tempThreshold) {
                this.alertService.sendAlert(`Temperature level critical: ${temperature}°C`);
            }

            const alerts = this.evaluateAlerts({ humidity, temperature, capturedAt: new Date(), force });
            if (!res) return alerts;
            return res.status(200).json({ alerts });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error evaluating alerts';
            if (!res) throw error;
            return res.status(500).json({ message });
        }
    };

    private evaluateAlerts(data: SensorData & { force?: boolean }): string[] {
        const alerts: string[] = [];
        const tempThreshold = config.alert.threshold.temperature;
        const humidityThreshold = config.alert.threshold.humidity;

        if (data.force) {
            alerts.push('Humidity is critically high.');
            alerts.push('Temperature is critically high.');
            return alerts;
        }

        if (data.humidity < humidityThreshold * 0.5) {
            alerts.push('Humidity is critically low.');
        } else if (data.humidity > humidityThreshold) {
            alerts.push('Humidity is critically high.');
        }

        if (data.temperature < tempThreshold * 0.5) {
            alerts.push('Temperature is critically low.');
        } else if (data.temperature > tempThreshold) {
            alerts.push('Temperature is critically high.');
        }

        return alerts;
    }
}