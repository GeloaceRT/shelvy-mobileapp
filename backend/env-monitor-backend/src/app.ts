import express, { NextFunction } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import { AuthController } from './controllers/auth.controller';
import readingsRoutes from './routes/readings.routes';
import configRoutes from './routes/config.routes';
import devicesRoutes from './routes/devices.routes';
import './config/firebase';
import config from './config';
import { logInfo } from './utils/logger';
import usersRoutes from './routes/users.routes';
import firebaseService from './services/firebase.service';

const app = express();
const { host, port } = config;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// JSON parse error handler: returns a clear 400 when incoming JSON is invalid
app.use((err: any, _req: any, res: any, next: NextFunction) => {
    if (err && err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    next(err);
});

app.use('/api/auth', authRoutes);
// Compatibility routes used by some test fixtures
const authController = new AuthController();
app.post('/login', authController.loginUser);
app.post('/logout', authController.logoutUser);
app.use('/api/users', usersRoutes);
// Mount readings router so it can receive a deviceId param at the root.
// Example: POST /api/readings/:deviceId  -> handled by readingsRoutes with mergeParams
app.use('/api/readings/:deviceId', readingsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/devices', devicesRoutes);

app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Bootstrap a default control node for single-device prototype setups
const defaultDeviceId = process.env.DEVICE_ID || 'prototype';
(async () => {
    try {
        await firebaseService.ensureDeviceControl(defaultDeviceId);
        logInfo(`Ensured control node exists for device '${defaultDeviceId}'`);
        // Also create a root-level relay flag for single-device prototype use cases
        await firebaseService.ensureRootRelayFlag('relay');
        logInfo('Ensured root-level relay flag exists at /relay');
    } catch (e) {
        console.warn('[app] ensureDeviceControl failed', (e as any)?.message ?? e);
    }
})();

// If this file is run directly, start the server. When imported by tests, don't auto-listen.
if (require.main === module) {
    app.listen(port, host, () => {
        logInfo(`Server is running at http://${host}:${port}`);
    });
}

export default app;