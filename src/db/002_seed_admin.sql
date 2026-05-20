-- 002_seed_admin.sql
-- Password is 'yourpass', hashed using bcrypt (cost 10)
INSERT INTO admin_users ("adminId", username, "passwordHash", "lastLoginAt")
VALUES (
  'admin-001',
  'admin',
  '$2a$10$f38w.r2K8oJ2Y7q9K0E4X.2t.Bq0j8XkXbFz0S9hQ4x/7y.j2L0W',
  NULL
) ON CONFLICT ("adminId") DO NOTHING;
