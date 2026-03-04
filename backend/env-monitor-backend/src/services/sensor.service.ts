import config from '../config';
import { Esp32SerialClient, Esp32SerialReading } from '../adapters/esp32SerialClient';
import { getHumidityTemperature, SensorReading } from '../sensors/sht30';
import { logError } from '../utils/logger';

export type SensorData = {
    humidity: number;
    temperature: number;
    capturedAt: Date;
};

export class SensorService {
    private readonly serialClient?: Esp32SerialClient;
    private readonly serialTimeout: number;

    constructor(serialClient?: Esp32SerialClient) {
        this.serialTimeout = config.serial.readTimeoutMs;
        this.serialClient = serialClient || this.createSerialClient();
        this.serialClient?.on('error', (error: Error) => {
            logError(`ESP32 serial client error: ${error.message}`);
        });
        this.serialClient?.start();
    }

    async readSensorData(): Promise<SensorData> {
        const serialReading = await this.readFromSerial();
        if (serialReading) {
            return serialReading;
        }

        // If a serial port is configured, do not fall back to mock data—surface an error instead
        if (config.serial.port) {
            throw new Error(`No serial data received from ${config.serial.port} within ${this.serialTimeout}ms`);
        }

        const mockReading = await getHumidityTemperature();
        return this.processSensorData(mockReading);
    }

    processSensorData(data: SensorReading | Esp32SerialReading): SensorData {
        const { humidity, temperature } = data;
        const capturedAt = data.capturedAt instanceof Date ? data.capturedAt : new Date();

        if (!Number.isFinite(humidity) || !Number.isFinite(temperature)) {
            throw new Error('Invalid sensor values received');
        }

        const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
        // Clamp to plausible SHT30 ranges to avoid garbage readings from noisy ADC/serial input during testing
        const safeHumidity = clamp(humidity, 0, 100);
        const safeTemperature = clamp(temperature, -40, 125);

        return { humidity: safeHumidity, temperature: safeTemperature, capturedAt };
    }

    private createSerialClient(): Esp32SerialClient | undefined {
        if (!config.serial.port) {
            return undefined;
        }

        return new Esp32SerialClient({
            path: config.serial.port,
            baudRate: config.serial.baudRate,
        });
    }

    private async readFromSerial(): Promise<SensorData | undefined> {
        if (!this.serialClient) {
            return undefined;
        }

        try {
            const reading = await this.serialClient.getLatestReading(this.serialTimeout);
            if (!reading) {
                return undefined;
            }

            return this.processSensorData(reading);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown serial read error';
            logError(`Failed to read data from ESP32: ${message}`);
            return undefined;
        }
    }
}

const sensorService = new SensorService();

export default sensorService;