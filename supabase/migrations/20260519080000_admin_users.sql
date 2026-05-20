CREATE TABLE IF NOT EXISTS public.admin_users (
  "adminId" TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "lastLoginAt" TIMESTAMPTZ NULL
);
