import request from 'supertest';
import app from '../src/app';
import authService from '../src/services/auth.service';

jest.mock('../src/services/auth.service');

describe('AuthController', () => {
    const mockedService = authService as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /login', () => {
        it('should return 200 and user data on successful login', async () => {
            const userData = { username: 'testuser', password: 'password' };
            const mockResponse = { id: 1, username: 'testuser', token: 'fake-token' };

            (mockedService.loginUser as jest.Mock).mockResolvedValue(mockResponse);

            const response = await request(app).post('/login').send(userData);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockResponse);
        });

        it('should return 401 on failed login', async () => {
            const userData = { username: 'testuser', password: 'wrongpassword' };

            (mockedService.loginUser as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

            const response = await request(app).post('/login').send(userData);

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid credentials');
        });
    });

    describe('POST /logout', () => {
        it('should return 200 on successful logout', async () => {
            (mockedService.logoutUser as jest.Mock).mockResolvedValue(undefined);

            const response = await request(app).post('/logout');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Logged out successfully');
        });
    });
});