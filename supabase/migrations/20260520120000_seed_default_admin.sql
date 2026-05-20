-- Default admin for POST /api/auth/login (FuelGuard spec §5.1).
-- Change the password hash before production; regenerate with:
--   node -e "require('bcryptjs').hash('your-password', 10).then(console.log)"
INSERT INTO public.admin_users ("adminId", username, "passwordHash")
VALUES (
  'admin-001',
  'admin',
  '$2b$10$P3/9NSUa1TUPvnPgDtBF6OJJAtetv4x89E78j22eLX8XIQx.yCtCa'
)
ON CONFLICT (username) DO UPDATE
SET "passwordHash" = EXCLUDED."passwordHash";
