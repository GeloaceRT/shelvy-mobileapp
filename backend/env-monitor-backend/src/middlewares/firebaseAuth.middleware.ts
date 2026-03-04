import { Request, Response, NextFunction } from 'express';
import { firebaseAdmin } from '../config/firebase';

export async function verifyFirebaseToken(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing or invalid Authorization header (expected Bearer token).' });
    }
    const idToken = auth.split(' ')[1];
    try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
        // attach firebase user info to request
        (req as any).firebaseUser = decoded;
        return next();
    } catch (e) {
        console.warn('[firebaseAuth] verify failed', (e as any)?.message ?? e);
        return res.status(401).json({ message: 'Invalid Firebase ID token.' });
    }
}

export default verifyFirebaseToken;
