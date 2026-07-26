# signbridge. 🌉

An accessibility-first, real-time classroom lecture transcription and visual vocabulary cue gateway. Designed to bridge the communication gap for deaf and hard-of-hearing students by delivering low-latency speech captioning and context-aware visual concept cards directly to their screens.

---

## 🌟 Key Features

### 🎙️ Live Audio Gateway
*   **Web Speech API Integration**: Leverages low-latency native browser Speech Recognition to transcribe spoken lectures.
*   **Reactive Visualizer**: A beautiful real-time audio waveform visualizer indicating mic activity levels.
*   **Hybrid Capture Log**: Easily switch between microphone capturing and manual message entries.

### 👥 Interactive Student Dashboard
*   **Accessibility Controls**: Customizable, high-contrast font sizes (up to 3XL) for maximum readability.
*   **Smooth Scroll Management**: Intelligently locks auto-scrolling during scroll-up reviews, with a fast-scroll resume shortcut.
*   **Slide-over Concept Drawer**: Slides in from the right overlaying definitions without breaking focus.
*   **Dynamic Bezier Toasts**: Premium slide-in cards notify students instantly of newly triggered visual cues.

### 📚 Visual Concept Cue Triggers
*   **Contextual Matching**: Automatically matches live spoken vocabulary terms (e.g. *RAG*, *photosynthesis*) and displays helpful popups.
*   **Lecturer Dictionary Management**: Add baseline custom vocabulary in Settings or dynamically inject them during live sessions (supporting keywords, acronym aliases, and student definitions).

### ⚡ Hybrid Multi-Tab Real-time Sync
*   **Online Mode**: Integrates with Supabase Realtime for database-driven multi-client synchronization.
*   **Offline Simulator Mode**: Integrates with HTML5 `BroadcastChannel` (`sb_offline_sync`) for zero-database tab-to-tab real-time testing.

---

## 🛠️ Architecture & Tech Stack

*   **Frontend**: React (TypeScript), Vite, TailwindCSS (v4 Utility Preset)
*   **Icons**: Lucide React
*   **Backend & Real-time**: Supabase (PostgreSQL Database, Realtime Subscriptions)
*   **Routing**: React Router DOM (v7)
*   **Deployment**: Cloudflare Pages Ready

---

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js (v18+ recommended)
*   A Supabase Project (free tier works perfectly)

### 2. Database Schema Setup
Execute the SQL DDL statements in [supabase_schema.sql](file:///Users/mac/Documents/Signbridge/supabase_schema.sql) within your Supabase SQL Editor. This will provision:
*   `profiles`: User profiles linked to Auth.
*   `sessions`: Active and archived lecture records.
*   `transcripts`: Logged speech sentences.
*   `concept_cards`: Discovered vocabulary triggers.
*   `baseline_vocab`: Default settings-page vocabulary configurations.

### 3. Environment Variables Configuration
Create a `.env` file in the root directory (based on `.env.example`):

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Running Locally
Install the dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## ☁️ Cloudflare Pages SPA Deployment

Signbridge uses client-side routing. To host this app on Cloudflare Pages without encountering `404 Not Found` page-refresh errors, the project includes a configured [public/_redirects](file:///Users/mac/Documents/Signbridge/public/_redirects) file.

### Cloudflare Dashboard Configuration:
1.  **Framework Preset**: `Vite` (or `None`)
2.  **Build Command**: `npm run build`
3.  **Build Output Directory**: `dist`
4.  **Root Directory**: `/`
