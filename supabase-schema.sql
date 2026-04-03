-- ============================================================
-- PERSONAL OS — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable RLS on all tables
-- All tables use auth.uid() for row-level security

-- ── PROFILES ────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can manage own profile"
  on public.profiles for all using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── KANBAN TASKS ─────────────────────────────────────────────
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  text text not null,
  column_id text not null default 'backlog', -- backlog | todo | inprogress | done
  view_type text not null default 'weekly',  -- weekly | daily
  tag text default 'misc',
  priority text default 'mid',              -- high | mid | low
  due_date date,
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.tasks enable row level security;
create policy "Users manage own tasks"
  on public.tasks for all using (auth.uid() = user_id);
create index tasks_user_view on public.tasks(user_id, view_type, column_id);

-- ── HABITS ───────────────────────────────────────────────────
create table public.habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  emoji text default '●',
  color text default '#c8fa5f',
  position integer default 0,
  created_at timestamptz default now()
);
alter table public.habits enable row level security;
create policy "Users manage own habits"
  on public.habits for all using (auth.uid() = user_id);

create table public.habit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  habit_id uuid references public.habits on delete cascade not null,
  date date not null,
  done boolean default true,
  unique(habit_id, date)
);
alter table public.habit_logs enable row level security;
create policy "Users manage own habit logs"
  on public.habit_logs for all using (auth.uid() = user_id);
create index habit_logs_lookup on public.habit_logs(habit_id, date);

-- ── NOTES ────────────────────────────────────────────────────
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text default '',
  content text default '',
  category text default 'study',
  tags text[] default '{}',
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.notes enable row level security;
create policy "Users manage own notes"
  on public.notes for all using (auth.uid() = user_id);

-- ── NUTRITION ────────────────────────────────────────────────
create table public.nutrition_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  calories integer default 2000,
  protein integer default 150,
  carbs integer default 250,
  fat integer default 65,
  updated_at timestamptz default now()
);
alter table public.nutrition_goals enable row level security;
create policy "Users manage own nutrition goals"
  on public.nutrition_goals for all using (auth.uid() = user_id);

create table public.food_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  meal text not null,  -- Breakfast | Lunch | Dinner | Snacks
  food_name text not null,
  calories integer default 0,
  protein numeric(6,1) default 0,
  carbs numeric(6,1) default 0,
  fat numeric(6,1) default 0,
  serving_size text,
  created_at timestamptz default now()
);
alter table public.food_logs enable row level security;
create policy "Users manage own food logs"
  on public.food_logs for all using (auth.uid() = user_id);
create index food_logs_date on public.food_logs(user_id, date);

-- ── WORKOUTS ─────────────────────────────────────────────────
create table public.workout_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  day_of_week text not null,  -- Mon | Tue | Wed | Thu | Fri | Sat | Sun
  exercise_name text not null,
  sets_reps text,
  muscle_group text,
  position integer default 0,
  created_at timestamptz default now()
);
alter table public.workout_plans enable row level security;
create policy "Users manage own workout plans"
  on public.workout_plans for all using (auth.uid() = user_id);

create table public.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  plan_id uuid references public.workout_plans on delete cascade,
  date date not null default current_date,
  completed boolean default false,
  notes text,
  created_at timestamptz default now(),
  unique(plan_id, date)
);
alter table public.workout_logs enable row level security;
create policy "Users manage own workout logs"
  on public.workout_logs for all using (auth.uid() = user_id);

-- ── CALENDAR EVENTS ──────────────────────────────────────────
create table public.events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  date date not null,
  time time,
  end_time time,
  type text default 'event',  -- event | reminder | workout | goal
  color text default '#c8fa5f',
  created_at timestamptz default now()
);
alter table public.events enable row level security;
create policy "Users manage own events"
  on public.events for all using (auth.uid() = user_id);
create index events_date on public.events(user_id, date);
