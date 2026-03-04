import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
const authController = new AuthController();

// Signup (create new user)
router.post('/signup', authController.signupUser);

// Signin / login
router.post('/signin', authController.loginUser);

// Signout / logout
router.post('/signout', authController.logoutUser);

export default router;