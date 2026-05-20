import { requireUser } from './require-user';
import { requireRole } from './require-role';

/** Admin JWT only — use after login on all company management routes. */
export const requireAdmin = [requireUser, requireRole('admin')] as const;
