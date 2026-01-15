# Environment Variables Setup

Create a `.env.local` file in the root directory with the following:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Getting Your Supabase Credentials

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project (or create a new one)
3. Navigate to **Settings** > **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Setup

1. In your Supabase project, go to **SQL Editor**
2. Open the file `supabase/schema.sql` from this project
3. Copy the entire SQL script
4. Paste it into the SQL Editor
5. Click **Run** to execute

This will create all necessary tables, indexes, and security policies.

