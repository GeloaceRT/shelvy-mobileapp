import bcrypt from 'bcryptjs';
import prisma from '../database/prisma';
import { firebaseAdmin, realtimeDb, isFirebaseInitialized } from '../config/firebase';
import firebaseService from './firebase.service';

async function verifyFirebasePassword(email: string, password: string): Promise<boolean> {
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) return false;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    // Prefer global fetch (Node 18+); otherwise try node-fetch
    let fetchFn: any = (globalThis as any).fetch;
    if (!fetchFn) {
        try {
            // require node-fetch v2 (CJS)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            fetchFn = require('node-fetch');
        } catch (err) {
            console.warn('[AuthService] fetch not available and node-fetch not installed');
            return false;
        }
    }

    try {
        const resp = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        });
        if (!resp) {
            console.warn('[AuthService] Firebase REST signIn returned no response');
            return false;
        }
        if (!resp.ok) {
            // attempt to parse error body for details
            try {
                const errBody = await resp.json();
                console.warn('[AuthService] Firebase REST signIn error', errBody);
            } catch (parseErr) {
                console.warn('[AuthService] Firebase REST signIn non-JSON error', await resp.text().catch(() => '<unreadable>'));
            }
            return false;
        }
        const data = await resp.json();
        return Boolean(data && data.idToken);
    } catch (e) {
        console.warn('[AuthService] Firebase REST signIn failed', (e as any)?.message ?? e);
        return false;
    }
}

type UserRecord = {
    id?: number;
    username?: string;
    password?: string;
};

type RegisterResult = UserRecord & { firebaseUid?: string; firebaseToken?: string };

const usePrisma = process.env.USE_PRISMA === 'true';

const mockUsers: UserRecord[] = [
    {
        id: 1,
        username: 'demo@example.com',
        password: bcrypt.hashSync('demo123', 10),
    },
];

let mockNextId = mockUsers.length + 1;

export class AuthService {
    async registerUser(identifier: string, password: string, firstName?: string, lastName?: string): Promise<RegisterResult> {
        const normalizedIdentifier = identifier.trim().toLowerCase();
        const hashedPassword = await bcrypt.hash(password, 10);

        // If Firebase Admin SDK is available, prefer Firebase-first auth/storage
        if (isFirebaseInitialized) {
            const acct = await firebaseService.createFirebaseAccount(normalizedIdentifier, password).catch(() => ({}));
            const firebaseUid = (acct as any).uid;
            const firebaseToken = (acct as any).token;

            // write profile into Realtime DB when possible
            try {
                        if (firebaseUid) {
                            const createdAt = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
                            await firebaseService.writeUserProfile(firebaseUid, { email: normalizedIdentifier, firstName, lastName, createdAt, source: 'signup' });
                        }
            } catch (e) {
                        console.warn('[AuthService] RTDB profile write failed', (e as any)?.message ?? e);
            }

            return { firebaseUid, firebaseToken, username: normalizedIdentifier };
        }
        if (!usePrisma) {
            const existing = mockUsers.find((user) => (user.username || '').toLowerCase() === normalizedIdentifier);
            // If user already exists in server DB, attempt to ensure a Firebase account and return token
            if (existing) {
                const acct = await firebaseService.createFirebaseAccount(normalizedIdentifier, password).catch(() => ({}));
                const firebaseUid = (acct as any).uid;
                const firebaseToken = (acct as any).token;

                // ensure RTDB profile exists
                try {
                    if (firebaseUid) {
                        const createdAt = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
                        await firebaseService.writeUserProfile(firebaseUid, { email: normalizedIdentifier, firstName, lastName, createdAt, source: 'signup-existing' });
                    }
                } catch (e) {
                    console.warn('[AuthService] RTDB profile write failed', (e as any)?.message ?? e);
                }

                return { ...existing, firebaseUid, firebaseToken };
            }

            // create firebase auth user for new mock user
            let firebaseUid: string | undefined;
            let firebaseToken: string | undefined;
            try {
                const acct = await firebaseService.createFirebaseAccount(normalizedIdentifier, password).catch(() => ({}));
                firebaseUid = (acct as any).uid;
                firebaseToken = (acct as any).token;
                if (firebaseUid) {
                    try {
                                const createdAt = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
                                await firebaseService.writeUserProfile(firebaseUid, { email: normalizedIdentifier, firstName, lastName, createdAt, source: 'signup' });
                    } catch (e) {
                                console.warn('[AuthService] RTDB profile write failed', (e as any)?.message ?? e);
                    }
                }
            } catch (e) {
                console.warn('[AuthService] firebase createUser failed', (e as any)?.message ?? e);
            }

            const newUser: UserRecord = {
                id: mockNextId++,
                username: normalizedIdentifier,
                password: hashedPassword,
            };
            mockUsers.push(newUser);
            return { ...newUser, firebaseUid, firebaseToken };
        }

        // Prisma-backed flow: create Firebase user and Prisma user
        const existing = await prisma.user.findUnique({ where: { username: normalizedIdentifier } });
        if (existing) {
            const acct = await firebaseService.createFirebaseAccount(normalizedIdentifier, password).catch(() => ({}));
            const firebaseUid = (acct as any).uid;
            const firebaseToken = (acct as any).token;

            try {
                if (firebaseUid) {
                    const createdAt = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
                    await firebaseService.writeUserProfile(firebaseUid, { email: normalizedIdentifier, firstName, lastName, createdAt, serverId: existing.id, source: 'signup-existing' });
                }
            } catch (e) {
                        console.warn('[AuthService] RTDB profile write failed', (e as any)?.message ?? e);
            }

            return { id: existing.id, username: existing.username, password: existing.password, firebaseUid, firebaseToken };
        }

        // create server user first so we have serverId for RTDB
        const created = await prisma.user.create({
            data: {
                username: normalizedIdentifier,
                password: hashedPassword,
            },
        });

        let firebaseUid: string | undefined;
        let firebaseToken: string | undefined;
            try {
                const acct = await firebaseService.createFirebaseAccount(normalizedIdentifier, password).catch(() => ({}));
                firebaseUid = (acct as any).uid;
                firebaseToken = (acct as any).token;
                try {
                    if (firebaseUid) {
                        const createdAt = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
                        await firebaseService.writeUserProfile(firebaseUid, { email: normalizedIdentifier, firstName, lastName, createdAt, serverId: created.id, source: 'signup' });
                    }
                } catch (e) {
                            console.warn('[AuthService] RTDB profile write failed', (e as any)?.message ?? e);
                }
            } catch (e) {
                    console.warn('[AuthService] firebase createUser failed', (e as any)?.message ?? e);
            }

        return { id: created.id, username: created.username, password: created.password, firebaseUid, firebaseToken };
    }

    async validateUser(identifier: string, password: string): Promise<UserRecord | null> {
        const normalizedIdentifier = identifier.trim().toLowerCase();
        if (!usePrisma) {
            const user = mockUsers.find(
                (item) => (item.username || '').toLowerCase() === normalizedIdentifier,
            );
            if (!user) {
                // fallback: if a Firebase account exists and password verifies there, allow login
                const fbOk = await verifyFirebasePassword(normalizedIdentifier, password);
                if (fbOk) {
                    return { username: normalizedIdentifier } as UserRecord;
                }
                return null;
            }

            if (!user || !user.password) return null;
            const isMatch = await bcrypt.compare(password, user.password as string);
            return isMatch ? user : null;
        }

        const user = await prisma.user.findUnique({
            where: { username: normalizedIdentifier },
        });
        if (!user) {
            const fbOk = await verifyFirebasePassword(normalizedIdentifier, password);
            if (fbOk) {
                return { username: normalizedIdentifier } as UserRecord;
            }
            return null;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        return isMatch ? user : null;
    }
    // Compatibility methods used by older test fixtures / callers
    async loginUser(identifier: string, password: string): Promise<UserRecord | null> {
        return this.validateUser(identifier, password);
    }

    async logoutUser(): Promise<void> {
        // no-op for stateless token-based auth
        return;
    }

    // Server JWTs removed: authentication is handled via Firebase ID tokens
}

export default new AuthService();