import { Router, Request, Response } from 'express';
import verifyFirebaseToken from '../middlewares/firebaseAuth.middleware';
import firebaseService from '../services/firebase.service';

const router = Router();

router.get('/me', verifyFirebaseToken, async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ message: 'Missing firebase user' });
  try {
    const profile = await firebaseService.getUserProfile(uid);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    return res.status(200).json({ profile });
  } catch (e) {
    console.error('[users.routes] /me error', (e as any)?.message ?? e);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

export default router;
