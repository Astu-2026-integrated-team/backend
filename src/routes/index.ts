import { Router } from 'express';
import { authRouter } from './auth';
import { driversRouter } from './drivers';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/drivers', driversRouter);
