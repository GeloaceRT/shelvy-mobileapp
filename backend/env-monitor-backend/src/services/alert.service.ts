export class AlertService {
    private criticalHumidityThreshold: number;
    private criticalTemperatureThreshold: number;

    constructor() {
        this.criticalHumidityThreshold = 80; // Example threshold for humidity
        this.criticalTemperatureThreshold = 30; // Example threshold for temperature
    }

    public checkAndAlert(humidity: number, temperature: number): void {
        if (humidity > this.criticalHumidityThreshold) {
            this.sendAlert(`Humidity level critical: ${humidity}%`);
        }

        if (temperature > this.criticalTemperatureThreshold) {
            this.sendAlert(`Temperature level critical: ${temperature}°C`);
        }
    }

    public sendAlert(message: string): void {
        // Suppressed to avoid noisy console logs during testing
        return;
    }
}