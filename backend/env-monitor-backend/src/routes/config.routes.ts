import { Router, Request, Response } from 'express';

const router = Router();

const DEVICE_SECRET = process.env.DEVICE_SECRET;
const DEVICE_ID = process.env.DEVICE_ID ?? null;
const ALLOW_EXPOSE_DEVICE_SECRET = process.env.ALLOW_EXPOSE_DEVICE_SECRET === 'true' || process.env.NODE_ENV !== 'production';

router.get('/device-secret', (req: Request, res: Response) => {
  const requiresDeviceSecret = Boolean(DEVICE_SECRET);
  const payload: any = { deviceSecret: null, requiresDeviceSecret, deviceId: DEVICE_ID };
  if (requiresDeviceSecret && ALLOW_EXPOSE_DEVICE_SECRET) {
    payload.deviceSecret = DEVICE_SECRET;
  }
  return res.status(200).json(payload);
});

export default router;
