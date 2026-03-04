import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'No token provided!' });
    }

    jwt.verify(token, config.auth.jwtSecret, (err: unknown, decoded: any) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized!' });
        }
        (req as Request & { userId?: number }).userId = decoded.id;
        next();
    });
};