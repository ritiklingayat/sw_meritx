import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { optionalAuthenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/configuration', PaymentController.getConfiguration);
router.post('/orders', optionalAuthenticate, PaymentController.createOrder);
router.post('/verify', optionalAuthenticate, PaymentController.verify);
router.post('/failure', PaymentController.failure);
router.post('/webhook', (req, res) => res.status(200).json({ received: true }));

export default router;
