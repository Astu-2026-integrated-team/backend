-- FuelGuard spec §3.3 — drivers (admin-managed; no Supabase Auth user)
CREATE TABLE IF NOT EXISTS public.drivers (
  "driverId" TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL UNIQUE,
  "phoneNumber" TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_license_number ON public.drivers ("licenseNumber");
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers (status);
