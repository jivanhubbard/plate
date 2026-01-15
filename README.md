# Plate - Food Tracker App

A lightweight, privacy-focused web application for tracking food intake and macronutrients during intermittent fasting.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API to get your project URL and anon key
4. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
5. Fill in your Supabase credentials in `.env.local`

### 3. Set Up Database

1. Go to your Supabase project SQL Editor
2. Copy and paste the contents of `supabase/schema.sql`
3. Run the SQL script to create all tables and policies
4. (Optional) Run `supabase/seed.sql` to populate common foods

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
plate-app/
├── app/              # Next.js app directory
│   ├── auth/         # Authentication pages
│   ├── dashboard/    # Main dashboard
│   └── ...
├── lib/              # Utility functions
│   └── supabase.js   # Supabase client
├── supabase/         # Database files
│   └── schema.sql    # Database schema
└── ...
```

## Tech Stack

- **Frontend**: Next.js 16 (React)
- **Database**: Supabase (PostgreSQL)
- **Styling**: CSS Modules
- **Hosting**: Vercel (recommended)

## Development Phases

### Phase 1: MVP ✅
- ✅ User authentication (sign up/sign in)
- ✅ Basic food logging (add/delete entries)
- ✅ Daily dashboard with macro totals and progress bars
- ✅ Food search and selection
- ✅ Custom food creation
- ✅ Simple food database (seed data included)

### Phase 2: Enhancement
- Food search with autocomplete
- Pre-seeded USDA food database
- History view
- Edit/delete entries
- Favorites system

### Phase 3: Polish
- Weekly analytics/charts
- Data export
- PWA features
- Dark mode
- Meal templates
~~