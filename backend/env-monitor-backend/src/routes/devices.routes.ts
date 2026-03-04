import { Router, Request, Response } from 'express';
import firebaseService from '../services/firebase.service';
import verifyFirebaseToken from '../middlewares/firebaseAuth.middleware';

const router = Router();

// Read control node for a device (public read is fine for debugging)
router.get('/:deviceId/control', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  try {
    const control = await firebaseService.getDeviceControl(deviceId);
    return res.status(200).json({ control });
  } catch (e) {
    console.error('[devices.routes] GET control failed', (e as any)?.message ?? e);
    return res.status(500).json({ message: 'Failed to fetch device control' });
  }
});

// Set relay flag for a device
// Protected by Firebase ID token (caller should be authenticated mobile/backend)
router.post('/:deviceId/relay', verifyFirebaseToken, async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { relay } = req.body as { relay?: boolean };
  if (typeof relay !== 'boolean') return res.status(400).json({ message: 'Missing or invalid relay boolean in body.' });
  try {
    await firebaseService.setDeviceControl(deviceId, { relay });
    return res.status(200).json({ deviceId, relay });
  } catch (e) {
    console.error('[devices.routes] POST relay failed', (e as any)?.message ?? e);
    return res.status(500).json({ message: 'Failed to set relay flag' });
  }
});

// Initialize control node for a device (creates default control flags)
// This is intentionally unauthenticated to allow quick device provisioning in test/dev environments.
router.post('/:deviceId/init', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  try {
    const control = await firebaseService.ensureDeviceControl(deviceId);
    return res.status(200).json({ deviceId, control });
  } catch (e) {
    console.error('[devices.routes] POST init failed', (e as any)?.message ?? e);
    return res.status(500).json({ message: 'Failed to initialize device control' });
  }
});

export default router;
