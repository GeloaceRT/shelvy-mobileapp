import { ReadingsController } from '../src/controllers/readings.controller';
import { SensorService } from '../src/services/sensor.service';
import { AlertService } from '../src/services/alert.service';

jest.mock('../src/services/sensor.service');
jest.mock('../src/services/alert.service');

describe('ReadingsController', () => {
    let readingsController: ReadingsController;
    let sensorService: SensorService;
    let alertService: AlertService;

    beforeEach(() => {
        sensorService = new SensorService();
        alertService = new AlertService();
        readingsController = new ReadingsController(sensorService, alertService);
    });

    describe('getReadings', () => {
        it('should return humidity and temperature readings', async () => {
            const mockData = { humidity: 45, temperature: 22 };
            (sensorService.readSensorData as jest.Mock).mockResolvedValue(mockData);

            const result = await readingsController.getReadings();

            expect(result).toEqual(mockData);
            expect(sensorService.readSensorData).toHaveBeenCalled();
        });
    });

    describe('alertCriticalLevels', () => {
        it('should send an alert if humidity is above threshold', async () => {
            const mockData = { humidity: 85, temperature: 22 };
            (sensorService.readSensorData as jest.Mock).mockResolvedValue(mockData);
            (alertService.sendAlert as jest.Mock).mockResolvedValue(true);

            await readingsController.alertCriticalLevels();

            expect(alertService.sendAlert).toHaveBeenCalledWith('Humidity level critical: 85%');
        });

        it('should send an alert if temperature is above threshold', async () => {
            const mockData = { humidity: 45, temperature: 35 };
            (sensorService.readSensorData as jest.Mock).mockResolvedValue(mockData);
            (alertService.sendAlert as jest.Mock).mockResolvedValue(true);

            await readingsController.alertCriticalLevels();

            expect(alertService.sendAlert).toHaveBeenCalledWith('Temperature level critical: 35°C');
        });
    });
});