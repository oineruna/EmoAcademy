# EmoAcademy Specification

Last updated: 2026-07-01  
Repository: `EmoAcademy`  
Production URL: <https://emo-academy.vercel.app>

## 1. Purpose of this document

This document explains how EmoAcademy is built, operated, and extended. It covers the user interface, authentication, Supabase, Vercel, GitHub, data storage, and future database tables.

Technical terms are explained when they first appear. Implemented features and future work are separated so maintainers can clearly understand what already works and what still needs to be built.

## 2. Product overview

EmoAcademy is a learning platform for students and teachers.

- Students see a Quizlet-inspired home screen after login, including study sets, recent activity, resume cards, and an emotion monitor.
- Teachers can add materials, assign them to students, and review student progress and comments.
- Authentication is handled by Supabase Auth.
- Deployment is handled by Vercel.
- Source code is managed in GitHub.

The emotion monitor is a learning-support feature. It must not be used to judge grades, punish students, or determine ability.

## 3. Target users

### 3.1 Students

- Log in with email/password or Google.
- Resume study activities.
- View recent learning activity.
- Start the emotion monitor voluntarily.
- Switch between Japanese and English.

### 3.2 Teachers

- Add learning materials.
- Assign materials to students.
- Review student progress and comments.
- Switch between Japanese and English.

### 3.3 Administrators

There is no dedicated admin screen in the web app yet. Administrators currently use the Supabase dashboard to manage users, profiles, and roles.

## 4. Technical stack

| Area | Technology | Role |
|---|---|---|
| Frontend | Next.js 16 / React 19 | Pages, UI, and user interactions |
| Language | TypeScript | Adds type checking to JavaScript |
| Styling | CSS / Tailwind v4 PostCSS dependency | Layout, responsive design, and animations |
| Authentication | Supabase Auth | Sign up, login, Google login, and sessions |
| Database | Supabase Database / PostgreSQL | Profiles, roles, and future learning data |
| Server-side secure logic | Supabase Edge Functions | Secure operations such as account deletion |
| Hosting | Vercel | Publishes the web app |
| Code hosting | GitHub | Stores code history and connects to Vercel |

### Terms

- **Frontend**: The part of the app users see and interact with in the browser.
- **Next.js**: A framework for building React web apps with routing, builds, and deployment support.
- **React**: A JavaScript library for building UI from reusable components.
- **TypeScript**: JavaScript with type checking.
- **PostgreSQL**: The database engine used by Supabase.
- **Hosting**: Making a website available on the internet.
- **Deployment**: Publishing the latest code to a live environment.

## 5. Project structure

```text
EmoAcademy
├─ src
│  ├─ app
│  │  ├─ page.tsx                 Login and sign-up screen
│  │  ├─ dashboard/page.tsx        Post-login dashboard
│  │  ├─ auth/callback/page.tsx    Email/Google callback route
│  │  ├─ reset-password/page.tsx   Password reset page
│  │  ├─ terms/page.tsx            Terms of Use
│  │  ├─ privacy/page.tsx          Privacy Policy
│  │  ├─ layout.tsx                Fonts, metadata, favicon
│  │  └─ globals.css               Global styles
│  ├─ components
│  │  ├─ auth-screen.tsx           Authentication screen
│  │  ├─ learning-dashboard.tsx    Student/teacher dashboard
│  │  ├─ emotion-camera.tsx        Emotion monitor
│  │  └─ learning-session.tsx      Candidate learning-session component
│  └─ lib/supabase/client.ts       Supabase client setup
├─ supabase
│  ├─ migrations                   Database migration SQL
│  └─ functions/delete-account     Account deletion Edge Function
├─ public
│  ├─ emoacademy-mark.png          Logo and favicon
│  └─ classroom-desk.jpg           Login/card image
├─ docs
│  ├─ SPECIFICATION.md             Japanese specification
│  └─ SPECIFICATION.en.md          English specification
└─ next.config.ts                  Next.js configuration
```

## 6. Screen specifications

### 6.1 Login and sign-up screen

File: `src/components/auth-screen.tsx`

Main features:

- Login/sign-up tabs
- Email/password login
- Google login
- Role selection on sign-up only
  - Student
  - Teacher
- Password strength bar
- Show/hide password button
- “Keep me logged in” option
- Password recovery
- Confirmation email resend
- Consent checkbox for Terms, Privacy Policy, and learning data handling
- Japanese/English language switch

### 6.2 Student dashboard

File: `src/components/learning-dashboard.tsx`

The current student dashboard is Quizlet-inspired.

- Left sidebar
  - Home
  - Library
  - Study groups
  - Notifications
  - New folder
  - Flashcards
  - Expert solutions
- Center feed
  - Jump back in
  - Recents
  - Personalized learning
  - Create flashcards card
- Right side
  - Emotion monitor
  - Neutral / Valence / Arousal display

Current progress values and study materials are demo data. Persistent learning progress requires the future progress tables described below.

### 6.3 Teacher dashboard

File: `src/components/learning-dashboard.tsx`

Main features:

- Material creation form
- PDF or web-link material type
- Title, subject, duration, URL, and study instruction fields
- Assignment action by student ID
- Material list
- Student progress list
- Recent comments

The teacher screen is currently a UI demo. Materials entered in the UI are not yet persisted to Supabase.

### 6.4 Emotion monitor

File: `src/components/emotion-camera.tsx`

Main behavior:

- The camera starts only when the user presses the start button.
- Video is not sent to a server.
- The browser calculates a simple Valence/Arousal-like signal based on brightness changes.
- This is not a research-grade emotion-recognition model.
- It is a demo signal for UI validation.

### Terms

- **Valence**: A positive/negative emotional direction axis.
- **Arousal**: An activation level axis, from calm to highly active.
- **Local processing**: Processing performed inside the user’s browser without sending data to a server.

## 7. Authentication specification

### 7.1 Service

Authentication uses Supabase Auth.

Supabase Auth handles:

- User sign-up
- Login
- Google OAuth login
- Email confirmation
- Password reset
- Session management
- Secure password storage

The app cannot view raw passwords. Raw passwords are also not visible in the normal Supabase dashboard.

### 7.2 Login methods

| Method | Status | Notes |
|---|---:|---|
| Email/password | Implemented | Supabase Auth |
| Google login | Implemented | Requires Supabase Provider and Google Cloud setup |
| Microsoft login | Not implemented | Add a Supabase provider if needed |
| Apple login | Not implemented | Requires Apple Developer setup |

### 7.3 Sessions

A **session** is the information that keeps a user logged in safely.

EmoAcademy uses two browser storage modes.

| User choice | Storage | Behavior |
|---|---|---|
| Keep me logged in ON | localStorage | More likely to remain after closing the browser |
| Keep me logged in OFF | sessionStorage | More likely to disappear after closing the tab/browser |

The Supabase auth flow uses PKCE.

### Terms

- **OAuth**: A login system that allows users to sign in with external accounts such as Google.
- **PKCE**: A security mechanism that makes OAuth authorization code flows harder to abuse.
- **localStorage**: Browser storage that persists locally.
- **sessionStorage**: Browser storage scoped to a browser tab/session.

## 8. Supabase data specification

### 8.1 Existing tables

#### `auth.users`

This is the internal user table managed by Supabase Auth.

Main stored data:

- User ID
- Email address
- Login provider
- Created timestamp
- Last sign-in timestamp

Where to view it:

```text
Supabase Dashboard
→ Authentication
→ Users
```

#### `public.profiles`

This is the profile table created by EmoAcademy. It stores not only display names, but also the user’s app role.

The role is intentionally stored in `public.profiles` rather than only inside Supabase Auth metadata because it is easier and safer for the app to read, query, and use for screen routing and future permission checks. `auth.users` handles authentication. `public.profiles` stores EmoAcademy-specific user attributes.

Definition:

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid | Same ID as `auth.users.id` |
| `display_name` | text | Display name |
| `role` | text | App role. Currently `student` or `teacher` |
| `created_at` | timestamptz | Created timestamp |
| `updated_at` | timestamptz | Updated timestamp |

The app role is stored here. The dashboard reads `profiles.role` to decide whether to show the student dashboard or the teacher dashboard.

Where to view it:

```text
Supabase Dashboard
→ Table Editor
→ profiles
```

#### `public.learning_materials`

Stores teacher-created learning materials. Students can read published materials, and teachers can add or update materials.

Main columns:

| Column | Meaning |
|---|---|
| `id` | Material ID |
| `created_by` | Teacher user ID |
| `title` | Material title |
| `subject` | Subject |
| `material_type` | `PDF` / `LINK` / `CARD` |
| `duration_minutes` | Estimated duration |
| `external_url` | External URL |
| `instruction` | Study instruction |
| `is_published` | Whether students can see it |

#### `public.study_progress`

Stores per-student progress. Students can view their own progress, and teachers can review class activity.

Main columns:

| Column | Meaning |
|---|---|
| `user_id` | Student user ID |
| `material_id` | Target material ID |
| `status` | `not_started` / `in_progress` / `completed` |
| `percent` | Progress percentage |
| `last_activity_title` | Last opened activity |
| `last_studied_at` | Last study timestamp |

#### `public.study_groups` / `public.study_group_members`

Stores study groups and membership. At the current stage, students can create their own groups.

#### `public.qa_threads`

Stores student questions and teacher answers.

Main columns:

| Column | Meaning |
|---|---|
| `user_id` | Student who asked |
| `material_id` | Related material |
| `question` | Student question |
| `teacher_answer` | Teacher answer |
| `status` | `open` / `answered` / `closed` |

### 8.2 SQL for viewing users and roles

Run this in the Supabase SQL Editor to view emails and roles together.

```sql
select
  u.id,
  u.email,
  p.display_name,
  p.role,
  u.created_at,
  u.last_sign_in_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

### 8.3 RLS

`profiles` uses RLS.

**RLS (Row Level Security)** is a database feature that controls which rows a user can read or update.

Current policy:

- Users can read only their own profile.
- Users can update only their own profile.
- `role` must be either `student` or `teacher`.

### 8.4 Role management policy

EmoAcademy manages roles in `public.profiles.role`.

Current roles:

| Role | Meaning | Screen |
|---|---|---|
| `student` | Student user | Learning home, study sets, emotion monitor |
| `teacher` | Teacher user | Material creation, assignment, student progress |

Role creation flow:

1. The user chooses Student or Teacher on the sign-up form.
2. Supabase Auth creates the user.
3. The database trigger `handle_new_user()` creates a row in `public.profiles`.
4. If `raw_user_meta_data.role` is `student` or `teacher`, that value is saved to `profiles.role`.
5. After login, `dashboard/page.tsx` reads `profiles.role` and shows the correct dashboard.

For Google login, `auth/callback/page.tsx` applies the selected role to `profiles.role` after the OAuth redirect.

If admin roles are added later, update both the database check constraint and the app routing logic. Examples: `admin`, `school_admin`.

A **database trigger** is an automatic database action. In this app, it creates a profile row whenever a new Auth user is created.

## 9. Learning database design

Added SQL:

```text
supabase/migrations/202607010001_learning_core.sql
```

Run this SQL in the Supabase SQL Editor to enable storage for materials, progress, study groups, and Q&A threads.

### 9.1 Currently persisted data

| Data | Table | App usage |
|---|---|---|
| Materials | `learning_materials` | Teachers add materials; students view them |
| Study progress | `study_progress` | Jump back in and teacher progress review |
| Study groups | `study_groups` / `study_group_members` | Group creation and group list |
| Questions and teacher answers | `qa_threads` | Students ask questions; teachers answer |

### 9.2 Tables to split further later

#### `learning_sets`

Stores study sets.

| Column | Meaning |
|---|---|
| `id` | Study set ID |
| `owner_id` | Creator user ID |
| `title` | Title |
| `description` | Description |
| `visibility` | private / class / public |
| `created_at` | Created timestamp |

#### `learning_items`

Stores flashcards or questions.

| Column | Meaning |
|---|---|
| `id` | Item ID |
| `set_id` | Parent study set |
| `front` | Front side / question |
| `back` | Back side / answer |
| `order_index` | Display order |

#### `learning_progress`

Stores per-student progress.

| Column | Meaning |
|---|---|
| `id` | Progress ID |
| `user_id` | Student user ID |
| `set_id` | Study set ID |
| `completed_count` | Completed item count |
| `total_count` | Total item count |
| `last_studied_at` | Last study timestamp |
| `next_review_at` | Next review timestamp |

#### `classes`

Stores teacher-created classes.

| Column | Meaning |
|---|---|
| `id` | Class ID |
| `teacher_id` | Teacher user ID |
| `name` | Class name |
| `invite_code` | Invitation code |

#### `class_members`

Stores class membership.

| Column | Meaning |
|---|---|
| `class_id` | Class ID |
| `user_id` | User ID |
| `role` | Membership role, such as student or teacher |

#### `emotion_sessions`

Stores emotion monitor session summaries if saving is enabled in the future.

| Column | Meaning |
|---|---|
| `id` | Session ID |
| `user_id` | User ID |
| `started_at` | Start timestamp |
| `ended_at` | End timestamp |
| `summary` | Aggregated result |

Important: The current system does not save video. If this feature is added later, saving aggregated values instead of raw video is safer.

## 10. Vercel specification

### 10.1 Role of Vercel

Vercel hosts the EmoAcademy Next.js app.

When GitHub integration is enabled:

- Pushing to `main` creates a production deployment.
- Pushing to another branch creates a preview deployment.

### 10.2 Production URL

```text
https://emo-academy.vercel.app
```

### 10.3 Required environment variables

Set these in Vercel Project Settings → Environment Variables.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

### Terms

- **Environment variable**: A setting stored outside source code.
- **Publishable Key**: A public browser-safe Supabase key, used together with RLS.
- **Secret Key / Service Role Key**: A private key with admin-level power. Never expose it to the browser.

## 11. Required Supabase settings

### 11.1 URL Configuration

Configure this in:

```text
Authentication
→ URL Configuration
```

Example:

```text
Site URL:
https://emo-academy.vercel.app

Redirect URLs:
https://emo-academy.vercel.app/auth/callback
https://emo-academy.vercel.app/reset-password
```

### 11.2 Google Provider

Configure this in:

```text
Authentication
→ Sign In / Providers
→ Google
```

Required values:

- Client ID from Google Cloud Console
- Client Secret from Google Cloud Console
- Supabase callback URL registered in Google Cloud

### 11.3 Confirm Email

Without a custom domain or Custom SMTP, confirmation emails may be unreliable. During testing, it is acceptable to turn Confirm Email off.

For production, Confirm Email should be enabled and a mail provider such as Resend should be configured through Custom SMTP.

### Terms

- **SMTP**: A protocol used to send email.
- **Resend**: A developer-friendly email delivery service that can be used with Supabase.
- **Custom domain**: A domain owned by the project, such as `emo-academy.com`.

## 12. Local development

### 12.1 Start the app

```powershell
cd "D:\OneDrive - Kyushu Institute Of Technolgy\EmoAcademy"
npm install
npm run dev
```

### 12.2 Local environment variables

Create `.env.local`.

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

Do not commit `.env.local` to GitHub.

### 12.3 Verification commands

```powershell
npm run lint
npm run typecheck
npm run build
```

### 12.4 Static export

`next.config.ts` contains:

```ts
output: "export"
```

This exports the Next.js app as static HTML. The current app works with this approach because it connects to Supabase from the browser.

If server-side Next.js features, API routes, or SSR are added later, this setting may need to be changed.

### Terms

- **Static HTML**: Prebuilt HTML/CSS/JS served without generating pages on every request.
- **SSR**: Server-Side Rendering, where HTML is generated on the server at request time.
- **API Route**: A server-side endpoint inside a Next.js app.

## 13. GitHub workflow

### 13.1 Basic flow

```powershell
git status
git add .
git commit -m "Update EmoAcademy"
git push origin main
```

If Vercel is connected to GitHub, pushing to `main` automatically triggers a production deployment.

### 13.2 Safety notes

- Do not push `.env.local`.
- Do not push `node_modules`.
- Never push the Supabase Service Role Key.
- Avoid adding large unused source folders or unrelated reference files.

## 14. UI and design specification

### 14.1 Design direction

- Quizlet-inspired rounded card layout.
- Fixed left menu.
- Center learning feed.
- Right-side emotion monitor.
- Login screen uses a pale blue dotted liquid-glass style.
- Dashboard uses a bright, friendly blue visual style close to the login screen.

### 14.2 Fonts

Current font policy:

- English: Poppins
- Japanese: Noto Sans JP

Implementation:

```ts
import { Noto_Sans_JP, Poppins } from "next/font/google";
```

Quizlet may use Hurme-style commercial fonts. EmoAcademy uses free, practical alternatives: Poppins and Noto Sans JP.

### 14.3 Animations

Used animations:

- Small hover lift on buttons
- Slight press scale on buttons
- Short feedback for selected states
- Natural card micro-interactions
- LIVE indicator for the emotion monitor

Avoid:

- Large slide-in animation on page load
- Constant motion that distracts from learning
- Decorative loops without meaning

## 15. Security and privacy

### 15.1 Passwords

Passwords are managed by Supabase Auth. Raw passwords are not visible in the app, GitHub, Vercel, or the normal Supabase dashboard.

### 15.2 Service Role Key

The Service Role Key is a secret admin key. It must never be exposed to the browser.

Account deletion is handled by a Supabase Edge Function so the Service Role Key is used only in a server-side environment.

### 15.3 Camera

- Camera starts only when the user requests it.
- Video is not sent to the server.
- The current implementation is a demo signal.
- If saving is added later, save only summary/statistical values, not raw video.
- The user must always be able to stop the monitor.

## 16. Account deletion

File:

```text
supabase/functions/delete-account/index.ts
```

Flow:

1. User clicks Delete account in the dashboard.
2. The browser calls the Supabase Edge Function.
3. The Edge Function verifies the logged-in user.
4. The function uses the Service Role Key to delete the Supabase Auth user.
5. Because `profiles.id` references `auth.users.id`, the profile is deleted as well.

### Terms

- **Edge Function**: A small server-side function hosted by Supabase.
- **Cascade Delete**: A database behavior where related child records are deleted when the parent record is deleted.

## 17. Current limitations

Not yet implemented:

- Persistent study set storage
- Persistent flashcard storage
- Saving PDFs to Supabase Storage
- Class creation
- Invitation codes
- Teacher view for detailed individual student progress
- Emotion monitor result persistence
- Production-ready spaced repetition

### Terms

- **Persistent storage**: Data that remains after closing the page or switching devices.
- **Supabase Storage**: Supabase file storage for PDFs, images, and other files.
- **Spaced repetition**: Reviewing material at increasing intervals to improve long-term retention.

## 18. Recommended implementation order

1. Run `202607010001_learning_core.sql` in the Supabase SQL Editor.
2. Log in as a student and test Jump back in, question submission, and group creation.
3. Log in as a teacher and test material creation, question answering, and progress review.
4. Add `learning_sets` and `learning_items` so flashcards are separated from materials.
5. Add teacher `classes` and `class_members`, including invitation codes.
6. Store material PDFs in Supabase Storage.
7. Configure Custom SMTP with Resend or another provider for production email confirmation.
8. Add consent and deletion controls before saving emotion monitor summaries.

## 19. Maintainer checklist

### 19.1 View users

```text
Supabase Dashboard
→ Authentication
→ Users
```

Check:

- Email address
- User ID
- Created timestamp
- Last sign-in
- Login provider

### 19.2 View roles

```text
Supabase Dashboard
→ Table Editor
→ profiles
```

Check:

- `display_name`
- `role`
- `id`

### 19.3 View Vercel deployment status

```text
Vercel Dashboard
→ emo-academy
→ Deployments
```

Check:

- Build success/failure
- Production URL
- Preview URL
- Error logs

### 19.4 View environment variables

```text
Vercel Dashboard
→ emo-academy
→ Settings
→ Environment Variables
```

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 20. Completion criteria

MVP completion:

- Email/password sign-up works.
- Google login works.
- Student/teacher role is stored in `profiles`.
- Users see the correct dashboard based on role.
- Student screen has a Quizlet-inspired left menu, center feed, and emotion monitor.
- Teacher screen has material creation and student progress UI.
- `https://emo-academy.vercel.app` is available on Vercel.
- Users and roles can be confirmed in Supabase.

Production completion:

- Study sets, cards, progress, classes, and material files are stored in Supabase.
- Teachers can view class-level progress.
- Students can view their progress across devices.
- Email confirmation works reliably.
- Terms of Use and Privacy Policy are finalized.
- Emotion monitor storage, deletion, and consent behavior are clearly defined.
