# Local Setup

1. Copy `.env.example` to `.env` and fill variables.
2. Run database migrations:
   ```bash
   cat src/db/schema.sql | supabase db query
   cat src/db/002_seed_admin.sql | supabase db query
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Test cURL:
   ```bash
   curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin", "password":"yourpass"}'
   ```
