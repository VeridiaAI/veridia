## Build Plan: Screens 10–20 (checklist)

Use this as a master checklist. Check off as you implement. Keep UI mobile-first with Tailwind and reuse existing hooks where possible.

### Foundations
- [x] Extend bottom navigation to include: Home, Workouts, Progress, Learn, Profile
- [x] Add render cases in `App.tsx` for new screens
- [ ] Shared components: Tabs, Card, Modal, Table, Timer, Slider, ProgressBar
- [ ] Schema migrations (Supabase):
  - [x] `workout_sessions(id, user_id, workout_id, started_at, ended_at, total_time_sec, notes, rpe)`
  - [x] `set_logs(id, session_id, exercise_id, set_index, reps, weight_kg, completed)`
  - [ ] `coach_notes(id, user_id, created_at, title, content, mood, energy)`
  - [ ] (Later) `workout_templates`, `exercise_library` for Explore Library
- [x] Update `src/lib/database.types.ts` and regenerate types
- [ ] Hooks:
  - [x] `useSessions(userId)` for sessions and set logs
  - [ ] `useNotes(userId)` for coach notes
  - [ ] (Later) `useLibrary()` for templates
- [ ] RLS policies: ensure per-user access on new tables

### Screen 10: Home / Dashboard
- [x] Header with user name + greeting
- [x] "Today’s Focus" card: title, duration, focus (from `useWorkouts.getTodaysWorkout`)
- [x] CTA buttons: Start Today’s Workout, View Full Plan
- [x] At a Glance: Current Streak, Workouts This Week (reuse `useStats`)
- [x] Quick Actions: Log Weight, Log Mood & Energy, Create Workout

### Screen 11: Workouts (Today | Upcoming | Completed | Explore)
- [x] Tabs UI and state
- [x] Today: show today’s workout with quick start
- [x] Upcoming: list with [View], [Reschedule], [Delete]
- [x] Completed: list with summary and [View Log]
- [x] Explore Library: search, filters (static), list of templates, [Create Custom Workout]

### Screen 12: Workout Detail / Pre-Workout
- [x] Header: title
- [x] Meta: date, est. duration, target muscles
- [x] Exercises list: name, sets x reps, suggested weight
- [x] Notes field (local)
- [x] Actions: [Start Workout] → create session, [Modify], [Reschedule]

### Screen 13: Exercise View (During Workout)
- [x] Top bar: workout title + progress (e.g., 3/10)
- [x] Current exercise pane with cues
- [x] Inputs: reps, weight (optional)
- [x] Simple rest timer (start/stop)
- [x] Buttons: Log Set & Next, Skip Exercise
- [ ] Bottom progress bar
- [x] Persist set logs to `set_logs` when advancing

### Screen 14: Workout Summary & Log
- [x] Summary: total time, total volume
- [x] Exercises performed with actual sets x reps @ weight
- [x] RPE slider (1–10), session notes
- [x] Persist session to `workout_sessions`; mark workout `completed`; update streak
- [x] Buttons: Log Workout, Return to Dashboard

### Screen 15: Progress (tables-first)
- [x] Tabs: Overview | Strength | Cardio | Body Metrics | Well-being
- [x] Overview: Total Workouts, Avg. Duration, Current Streak
- [x] Strength: table of PRs and volume by exercise (from `set_logs`)
- [x] Cardio: simple table (placeholder until cardio schema)
- [x] Body Metrics: weight entries from `user_stats`
- [ ] Well-being: sleep/stress (reuse onboarding lifestyle + notes if any)
- [x] Export Data button (client-side JSON)

### Screen 16: Learn (Static Content)
- [x] Seed local JSON `src/content/learn.json`
- [x] Search + category filters
- [x] Featured content card + list items

### Screen 17: Content Detail
- [x] Title, author/date/source
- [x] Scrollable text or embedded video (local file/iframe)
- [x] Back button

### Screen 18: Coach Notes / Journal
- [x] List of entries by date; filters (search, date range)
- [x] Form: title, content, mood (1–5), energy (1–5)
- [x] CRUD operations using `coach_notes`

### Screen 19: Profile / Settings
- [x] Show email; Logout
- [ ] Edit personal details (subset of onboarding fields)
- [ ] Manage goals
- [x] Change password (Supabase Auth)
- [x] Privacy & Data; Data Export/Import; Help & Support links

### Screen 20: Data Export/Import
- [x] Export JSON: profiles, workouts, exercises, workout_sessions, set_logs, user_stats, coach_notes
- [x] Import JSON: validate and insert rows (idempotent checks for notes MVP)
- [x] Note: local-only feature

### Integration milestones
- [x] M1: Bottom nav + routes + Dashboard polish
- [x] M2: Workouts tabs + Workout Detail
- [x] M3: Exercise View + Summary, session persistence
- [ ] M3: Exercise View + Summary, session persistence
- [ ] M4: Progress tables + Export
- [ ] M5: Learn + Content Detail
- [ ] M6: Coach Notes CRUD
- [ ] M7: Profile + Data Import

### Testing milestones (checkpoints)
- [x] TM0 (after M1 base nav/stubs):
  - Load app → see Login/Signup when signed out
  - Sign up → onboarding runs once, completes → dashboard
  - Bottom nav buttons switch screens (Home, Workouts, Progress, Learn, Profile)

- [x] TM1 (after Screen 10 polish):
  - Dashboard shows greeting, Today’s Focus (if scheduled), At a Glance stats
  - Quick Actions (Log Weight/Mood) save entries and clear inputs

- [x] TM2 (after Screen 11 + 12):
  - Workouts: Tabs render (Today/Upcoming/Completed/Explore)
  - Upcoming supports View/Reschedule/Delete; Completed shows summaries
  - Explore shows library list and Create Custom Workout stub
  - Workout Detail shows meta, exercises, notes; Start/Modify/Reschedule buttons visible

- [x] TM3 (after Screen 13 + 14):
  - Exercise View steps through exercises/sets with rest timer
  - Logging sets advances progress; Skip works
  - Summary computes total time/volume; RPE + notes save; session persisted

- [x] TM4 (after Screen 15):
  - Progress tabs render; Overview numbers look sane
  - Strength table shows recent PRs/volume; Body Metrics table shows weights
  - Export JSON downloads a file

- [x] TM5 (after Screens 16–17):
  - Learn list renders with search/filters; selecting opens Content Detail; Back returns

- [x] TM6 (after Screen 18):
  - Coach Notes list renders; create/edit/delete note; filters work

- [ ] TM7 (after Screens 19–20):
  - Profile shows email; edit preferences form updates data
  - Change password works (Supabase)
  - Data Export downloads JSON; Import accepts file and restores items (idempotent)

Note: I will call out when we hit each testing milestone (TM0–TM7) so you can test and we can iterate on any issues.

### Notes
- Keep UI states optimistic; show spinners/toasts on save
- Add empty/loading states to all lists
- Defer charts; tables-first MVP
- Access control: verify RLS on new tables before deploy

### Do we need Lovable/Bolt?
- Optional. We can implement this directly in the current codebase (React + Tailwind) using the plan above. If you want high-fidelity mockups or rapid static scaffolding, you can use external tools; otherwise we can build iteratively here.