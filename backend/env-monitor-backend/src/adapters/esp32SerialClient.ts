import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { logError, logInfo } from '../utils/logger';

export type Esp32SerialReading = {
  temperature: number;
  humidity: number;
  capturedAt: Date;
};

export type Esp32SerialClientOptions = {
  path: string;
  baudRate: number;
};

type SerialEvents = {
  reading: (payload: Esp32SerialReading) => void;
  error: (error: Error) => void;
};

const newlineDelimiter = '\n';

export class Esp32SerialClient extends EventEmitter {
  private port?: SerialPort;
  private parser?: ReadlineParser;
  private latestReading?: Esp32SerialReading;
  private started = false;

  constructor(private readonly options: Esp32SerialClientOptions) {
    super();
  }

  public start(): void {
    if (this.started || !this.options.path) {
      return;
    }

    try {
      this.port = new SerialPort({ path: this.options.path, baudRate: this.options.baudRate });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: newlineDelimiter }));

      this.port.on('open', () => {
        this.started = true;
        logInfo(`ESP32 serial connection opened on ${this.options.path} @ ${this.options.baudRate}`);
      });

      this.port.on('close', () => {
        this.started = false;
        logInfo('ESP32 serial connection closed');
      });

      this.port.on('error', (error: Error) => {
        logError(`ESP32 serial error: ${error.message}`);
        this.emitSerialError(error);
      });

      this.parser.on('data', (line: string) => {
        this.handleIncomingLine(line);
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown serial connection error');
      logError(`Failed to start ESP32 serial client: ${err.message}`);
      this.emitSerialError(err);
    }
  }

  public stop(): void {
    if (!this.port) {
      return;
    }

    this.parser?.removeAllListeners();
    this.port.removeAllListeners();

    if (this.port.isOpen) {
      this.port.close((error) => {
        if (error) {
          logError(`Error while closing ESP32 serial connection: ${error.message}`);
        }
      });
    }

    this.started = false;
  }

  public async getLatestReading(timeoutMs: number): Promise<Esp32SerialReading | undefined> {
    if (this.latestReading) {
      return this.latestReading;
    }

    return new Promise((resolve) => {
      let settled = false;

      const handleReading = (reading: Esp32SerialReading) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.off('reading', handleReading as (...args: unknown[]) => void);
        resolve(reading);
      };

      const handleTimeout = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.off('reading', handleReading as (...args: unknown[]) => void);
        resolve(undefined);
      };

      const timer = setTimeout(handleTimeout, timeoutMs);

      this.once('reading', handleReading as (...args: unknown[]) => void);
    });
  }

  public onReading(listener: SerialEvents['reading']): void {
    this.on('reading', listener as (...args: unknown[]) => void);
  }

  private handleIncomingLine(rawLine: string): void {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }

    const { reading, handled } = this.tryParseReading(trimmed);
    if (!reading) {
      if (!handled) {
        logError(`Unable to parse ESP32 payload: ${trimmed}`);
      }
      return;
    }

    this.latestReading = reading;
    this.emit('reading', reading);
  }

  private tryParseReading(line: string): { reading?: Esp32SerialReading; handled: boolean } {
    const jsonReading = this.parseJsonReading(line);
    if (jsonReading) {
      return { reading: jsonReading, handled: true };
    }

    const textReading = this.parseTextReading(line);
    if (textReading) {
      return { reading: textReading, handled: true };
    }

    if (this.isNoiseLine(line)) {
      return { handled: true };
    }

    return { handled: false };
  }

  private parseJsonReading(line: string): Esp32SerialReading | undefined {
    try {
      const payload = JSON.parse(line) as Partial<Record<string, unknown>>;
      const temperature = this.toNumber(payload.temperature ?? payload.temp ?? payload.t);
      const humidity = this.toNumber(payload.humidity ?? payload.hum ?? payload.h);

      if (temperature === undefined || humidity === undefined) {
        return undefined;
      }

      const capturedAt = this.parseCapturedAt(payload.capturedAt ?? payload.timestamp);
      return {
        temperature,
        humidity,
        capturedAt,
      };
    } catch (error) {
      return undefined;
    }
  }

  private parseTextReading(line: string): Esp32SerialReading | undefined {
    // Support "Temp: 25.1" and "T=25.1C" style payloads
    const temperatureMatch = line.match(/(?:temp(?:erature)?\s*[:=]|t=)\s*(-?\d+(?:\.\d+)?)/i);
    const humidityMatch = line.match(/(?:humidity\s*[:=]|h=)\s*(\d+(?:\.\d+)?)/i);

    if (!temperatureMatch || !humidityMatch) {
      return undefined;
    }

    const temperature = Number(temperatureMatch[1]);
    const humidity = Number(humidityMatch[1]);

    if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
      return undefined;
    }

    return {
      temperature,
      humidity,
      capturedAt: new Date(),
    };
  }

  private isNoiseLine(line: string): boolean {
    // ignore chatter like voltage lines or firmware info messages
    return (
      /voltage/i.test(line) ||
      /reading sent/i.test(line) ||
      /state=\d/i.test(line) ||
      /post failed/i.test(line) ||
      /send failed/i.test(line)
    );
  }

  private parseCapturedAt(value: unknown): Date {
    if (typeof value === 'string') {
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }

    return new Date();
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private emitSerialError(error: Error): void {
    this.emit('error', error);
  }
}
