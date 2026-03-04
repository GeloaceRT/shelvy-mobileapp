import { Request, Response } from 'express';
import authService from '../services/auth.service';
import { firebaseAdmin } from '../config/firebase';

export class AuthController {
    constructor(private readonly service = authService) {}

    public signupUser = async (req: Request, res: Response) => {
        try {
            const { email, username, password, firstName, lastName } = req.body;
            const identifier = (email ?? username ?? '').trim();

            if (!identifier || !password) {
                return res.status(400).json({ message: 'Email/username and password are required.' });
            }

            const user = await this.service.registerUser(identifier, password, firstName, lastName);
            // return firebase custom token for client sign-in and server user info
            return res.status(201).json({ user: { id: user.id, username: user.username }, firebaseToken: user.firebaseToken });
        } catch (error) {
            console.error('[AuthController] signup error', error);
            return res.status(500).json({ message: 'Unable to process signup.', error });
        }
    };

    public loginUser = async (req: Request, res: Response) => {
        try {
            const { email, username, password } = req.body;
            const identifier = (email ?? username ?? '').trim();
            console.log('[AuthController] login attempt', identifier);

            if (!identifier || !password) {
                return res
                    .status(400)
                    .json({ message: 'Email/username and password are required.' });
            }

            // prefer service.loginUser if present (compat tests), otherwise fallback to validateUser
            let user: any;
            try {
                user = typeof (this.service as any).loginUser === 'function'
                    ? await (this.service as any).loginUser(identifier, password)
                    : await this.service.validateUser(identifier, password);
            } catch (e) {
                console.error('[AuthController] login error', e);
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            if (!user) {
                console.log('[AuthController] invalid credentials', identifier);
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // If the auth service returned a ready-made response (e.g., includes a token), forward it
            if ((user as any).token) {
                console.log('[AuthController] login success', identifier);
                return res.status(200).json(user);
            }

            // try to create a firebase custom token for the user (if firebase account exists)
            let firebaseToken: string | undefined;
            try {
                const fUser = await firebaseAdmin.auth().getUserByEmail(identifier);
                firebaseToken = await firebaseAdmin.auth().createCustomToken(fUser.uid);
            } catch (e) {
                // no firebase account or other error — ignore
                console.warn('[AuthController] firebase token creation skipped', (e as any)?.message ?? e);
            }

            console.log('[AuthController] login success', identifier);
            return res.status(200).json({ firebaseToken, user: { id: user.id, username: user.username } });
        } catch (error) {
            console.error('[AuthController] login error', error);
            return res.status(500).json({ message: 'Unable to process login.', error });
        }
    };

    public logoutUser = async (_req: Request, res: Response) => {
        try {
            return res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            return res.status(500).json({ message: 'Unable to process logout.', error });
        }
    };
}