# 🧠 Personal OS — Next.js Personal Dashboard

A full-stack personal productivity dashboard built with **Next.js 14**, **Supabase**, and **TypeScript**.

---

## ✨ Features

| Module | What it does |
|---|---|
| 🏠 **Dashboard** | Overview with quick stats and today's events |
| ⬛ **Kanban** | Drag-and-drop task board (Weekly & Daily), tags, priorities, due dates |
| 🔲 **Habit Tracker** | Monthly grid, streaks, one-click toggle |
| 📓 **Study Notes** | Full editor with categories, pinning, markdown toolbar |
| 🥗 **Nutrition** | Log meals via **Open Food Facts API** (free), manual entry, macro goals |
| 💪 **Workout** | Weekly planner with **API Ninjas exercise search**, completion tracking |
| 📅 **Calendar** | Full month grid, event types (event/reminder/workout/goal) |
| 📊 **Analytics** | 30-day charts — calories, protein, habits, workout frequency, task distribution |
| 🌗 **Theme** | Dark / Light toggle |
| 🔐 **Auth** | Supabase Auth — login, signup, per-user data isolation |

---

## 🛠️ Tech Stack

- **Next.js 14** (App Router, Server Components)
- **Supabase** (Postgres DB + Row Level Security + Auth)
- **Zustand** (UI state)
- **@dnd-kit** (Kanban drag and drop)
- **Recharts** (Analytics charts)
- **Framer Motion** (Animations)
- **Tailwind CSS** (Styling)
- **Open Food Facts API** (Free, no key needed)
- **API Ninjas** (Exercise database — free tier)

---

## 🚀 Setup

### 1. Clone & install

```bash
# Unzip the project, then:
cd personal-os
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to **SQL Editor** → paste the entire contents of `supabase-schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional — for exercise search
# Get a free key at https://api-ninjas.com (50k calls/month free)
NEXT_PUBLIC_API_NINJAS_KEY=your_key_here
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📦 Build for production

```bash
npm run build
npm start
```

### Deploy to Vercel (recommended)

```bash
npm install -g vercel
vercel
```

Add your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## 🗄️ Database Schema

The schema creates these tables (all protected by Row Level Security):

| Table | Purpose |
|---|---|
| `profiles` | User profiles (auto-created on signup) |
| `tasks` | Kanban tasks |
| `habits` | Habit definitions |
| `habit_logs` | Daily habit completions |
| `notes` | Study notes |
| `nutrition_goals` | Per-user macro targets |
| `food_logs` | Daily food entries |
| `workout_plans` | Weekly exercise plan |
| `workout_logs` | Daily workout completions |
| `events` | Calendar events |

---

## 🔑 Free APIs Used

### Open Food Facts
- **URL**: `https://world.openfoodfacts.org`
- **Cost**: Free, no registration needed
- Used in: Fitness → Nutrition → food search

### API Ninjas Exercise DB
- **URL**: `https://api-ninjas.com`
- **Cost**: Free tier (50,000 calls/month)
- **Setup**: Register at api-ninjas.com → get API key → add to `.env.local`
- Used in: Fitness → Workout → exercise search

---

## 📁 Project Structure

```
src/
├── app/
│   ├── auth/             → Login / Signup page
│   ├── dashboard/
│   │   ├── layout.tsx    → Sidebar + TopBar wrapper
│   │   ├── page.tsx      → Overview dashboard
│   │   ├── kanban/       → Kanban board
│   │   ├── habits/       → Habit tracker
│   │   ├── notes/        → Study notes
│   │   ├── fitness/      → Nutrition + Workout
│   │   ├── calendar/     → Calendar
│   │   └── analytics/    → Charts & insights
│   └── globals.css       → Design tokens + global styles
├── components/
│   ├── layout/           → Sidebar, TopBar
│   ├── ui/               → Button, Input, Modal, Card, etc.
│   ├── kanban/           → KanbanBoard
│   ├── habits/           → HabitTracker
│   ├── notes/            → NotesClient
│   ├── fitness/          → FitnessClient
│   ├── calendar/         → CalendarClient
│   └── analytics/        → AnalyticsClient
├── lib/
│   ├── supabase/         → client.ts, server.ts, middleware.ts
│   ├── api/              → food.ts, exercises.ts
│   └── utils.ts          → helpers, constants
├── store/
│   └── ui.ts             → Zustand store (theme, sidebar)
└── types/
    └── index.ts          → All TypeScript types
```

---

## 🎨 Design System

The app uses CSS custom properties for theming:

```css
--bg, --surface, --surface2, --surface3  /* Backgrounds */
--border                                  /* Borders */
--text, --text-muted, --text-dim          /* Typography */
--accent                                  /* Lime green */
--accent2                                 /* Purple */
--accent3                                 /* Red */
--accent4                                 /* Cyan */
--accent5                                 /* Amber */
```

Fonts: **Syne** (display) + **DM Mono** (body) + **Fraunces** (serif accents)
