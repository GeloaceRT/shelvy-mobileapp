export type SensorReading = {
    temperature: number;
    humidity: number;
    capturedAt: Date;
};

// Placeholder sensor hooks to enable development without hardware access.
export const initializeSensor = () => {
    return true;
};

export const getHumidityTemperature = async (): Promise<SensorReading> => {
    const now = new Date();
    // Mostly normal readings; rare critical excursions (~5%)
    const roll = Math.random();

    // Base nominal ranges
    const baseHumidity = 55 + Math.random() * 13; // 55-68%
    const baseTemp = 26 + Math.random() * 4; // 26-30°C

    let humidity: number;
    if (roll < 0.025) {
        humidity = 82 + Math.random() * 8; // high critical 82-90%
    } else if (roll < 0.05) {
        humidity = 20 + Math.random() * 8; // low critical 20-28%
    } else {
        humidity = baseHumidity; // normal range
    }

    let temperature: number;
    if (roll < 0.025) {
        temperature = 33.5 + Math.random() * 2.5; // high critical 33.5-36°C
    } else if (roll < 0.05) {
        temperature = 15 + Math.random() * 3; // low critical 15-18°C
    } else {
        temperature = baseTemp; // normal range
    }

    return {
        humidity: Number(humidity.toFixed(2)),
        temperature: Number(temperature.toFixed(2)),
        capturedAt: now,
    };
};