# Product Requirements Document (PRD)
# SignBridge AI — Version 2.0 (Investor & Execution Edition)

> **Theme**: Digitally Enabled Inclusive Education: Expanding Access, Equity, and Opportunity for All  
> **Target Audience**: Investors, Grant Committees (AFRETEC/EdTech), Institutional Buyers, Executive Stakeholders, and Cross-Functional Engineering/Design Teams  
> **Status**: Living Document (Aligned with V1 Live Production Build)

---

## 1. Executive Summary & Pitch Overview

### 1.1 Product Vision
**SignBridge AI** is an AI-powered inclusive education platform designed to eliminate learning barriers for deaf, hard-of-hearing (DHH), and diverse learners in high-barrier educational environments. 

Rather than functioning as a standard speech transcription tool or a standalone translator, SignBridge AI introduces a **"Speech-to-Context" paradigm**: combining sub-second real-time speech transcription, live AI contextual reasoning, domain-specific terminology correction, visual concept cards, and dual-workspace collaboration into a unified classroom assistant.

```
[ Classroom Speech ] ──> [ Sub-300ms ASR Engine ] ──> [ Gemini AI Context Engine ] ──> [ Dual Workspace Sync ]
                                                                                                ├──> Lecturer Portal
                                                                                                └──> Student Accessibility UI
```

### 1.2 The Investment Pitch
* **The Gap**: Over **430 million people globally** (including 30+ million in Africa) experience disabling hearing loss. In developing regions, educational institutions face an acute shortage of qualified sign language interpreters—often exceeding **1 interpreter per 10,000 deaf students**.
* **The Failure of Existing Tools**: Traditional captioning tools (Zoom, Microsoft Teams, Otter.ai) provide raw, unpunctuated text streams that fail when encountering specialized academic jargon, offer zero real-time concept explanation, and provide no 2-way participation mechanism for DHH students.
* **The SignBridge Solution**: SignBridge AI solves both **access** (captions) and **comprehension** (real-time AI concept extraction, visual learning cues, and domain primers). By deploying lightweight browser-based dual workspaces backed by Supabase Realtime, AssemblyAI, and Google Gemini, SignBridge transforms passive speech into accessible, interactive learning.
* **Traction & V1 Status**: **Version 1.0 is fully operational in production**, featuring live AssemblyAI WebSocket transcription, real-time Gemini term extraction, custom domain vocabulary injection, and synchronized student-lecturer rooms (`SB-XXXX`).

---

## 2. Problem Statement & Target Personas

### 2.1 Problem Breakdown
1. **High Cognitive Load & Missing Context**: Deaf and hard-of-hearing students spending full concentration on raw caption reading miss essential contextual understanding, technical definitions, and lecture cadence.
2. **Academic Jargon Distortion**: Standard Speech-to-Text (STT) engines frequently mangle domain-specific terminology (e.g., mistranscribing "mitochondria", "differentiable", or "photolithography"), creating confusing transcripts.
3. **Interpreter Shortages & High Cost**: Hiring full-time sign language interpreters for every university lecture is financially unviable for 90%+ of African and emerging market educational institutions.
4. **Lack of Localized Sign Language Models**: Existing tools ignore localized sign languages, including **Nigerian Sign Language (NSL)** and regional variations.
5. **Connectivity Constraints**: Classrooms in low-resource settings require resilient web applications that operate reliably on variable bandwidth with low latency.

### 2.2 User Personas

| Persona | Role & Needs | Pain Points | SignBridge Solution |
| :--- | :--- | :--- | :--- |
| **Amina (Primary)** | Deaf Computer Science Student | Cannot follow fast-paced verbal lectures; struggles when technical terms are spoken without visual definitions. | Receives sub-second live captions, auto-highlighted technical terms with pop-up visual cards, smart bullet notes, and customizable font size/contrast. |
| **Dr. Okon (Secondary)** | University Lecturer | Wants inclusive lectures without pausing teaching flow or managing complex audio/video equipment. | Launches a session with 1 click, inputs course-specific vocabulary primers before class, and broadcasts live synced captions effortlessly. |
| **Prof. Mensah (Enterprise)** | Head of Institutional Accessibility | Needs compliance with disability policies, verifiable student comprehension gains, and cost-effective scaling across departments. | Scalable B2B SaaS platform requiring zero dedicated hardware; provides post-lecture summaries and review archives. |

---

## 3. Product Objectives & Core Value Proposition

### 3.1 Key Product Objectives
* **Sub-Second Caption Delivery**: Stream speech-to-text live captions to student devices with `<300ms` latency.
* **Contextual AI Learning**: Automatically detect technical jargon during lectures and display contextual definitions and visual learning cards in real time (`<2s` processing lag).
* **Domain Vocabulary Priming**: Enable lecturers to inject course-specific terms, definitions, and phonetic aliases before or during a live lecture to boost STT accuracy to `>95%`.
* **Frictionless Accessibility**: Allow students to join any live lecture instantly via a simple 6-character room code (`SB-XXXX`) without complex installations or mandatory hardware.
* **End-to-End Lesson Persistence**: Automatically generate post-lecture summaries, key takeaway bullet notes, and searchable lecture review archives.

---

## 4. Current Platform Realities (V1 Live Architecture)

The following capabilities are **fully built, deployed, and live in the V1 production codebase**:

```
                              ┌─────────────────────────────────────────────────┐
                              │               SignBridge AI Client              │
                              └───────────────┬─────────────────┬───────────────┘
                                              │                 │
                                    WebSocket │                 │ REST / Realtime
                                              ▼                 ▼
┌──────────────────────────┐      ┌───────────────────────┐  ┌──────────────────────────────┐
│  AssemblyAI Streaming    │      │  Supabase Edge        │  │     Supabase Cloud DB        │
│  Real-Time STT Engine    │◄────►│  Functions            │◄─┤  - Auth & User Profiles      │
│  (Custom Term Boosting)  │      │  - assemblyai-token   │  │  - Session Storage & RLS     │
└──────────────────────────┘      │  - gemini-extract     │  │  - Realtime Channels         │
                                  └───────────┬───────────┘  └──────────────────────────────┘
                                              │
                                              ▼
                                  ┌───────────────────────┐
                                  │   Google Gemini AI    │
                                  │   Context Engine      │
                                  └───────────────────────┘
```

### 4.1 System Capabilities Matrix

| Feature | Production Implementation | Tech Stack | Status |
| :--- | :--- | :--- | :--- |
| **Real-Time Live Captions** | AssemblyAI WebSocket audio streaming directly from browser mic with custom term boosting. | AssemblyAI API, Web Audio API | **[LIVE - V1]** |
| **Speech Auto-Correction** | Real-time AI sentence structure, punctuation, and terminology correction. | Google Gemini 1.5/ Flash, Deno Edge | **[LIVE - V1]** |
| **Visual Concept Cards** | Automatic background extraction of technical concepts with definitions and visual cards. | Google Gemini API, Supabase Realtime | **[LIVE - V1]** |
| **Lecturer Workspace** | Mic controls, live audio visualizer, inline vocabulary primer manager, instant room termination. | React 18, FontAwesome, Tailwind | **[LIVE - V1]** |
| **Student Workspace** | Sub-second real-time caption sync, searchable concept index, bookmarking, auto-scroll overrides. | React 18, Supabase Realtime | **[LIVE - V1]** |
| **Accessibility Engine** | Multi-step typography scaling (`sm`, `md`, `lg`, `xl`), light/dark contrast modes, high readability font options. | CSS Custom Properties, Tailwind | **[LIVE - V1]** |
| **Saved Lessons & Review** | Full post-session review portal with searchable transcripts, concept card breakdowns, and summary downloads. | Supabase PostgreSQL, React Router | **[LIVE - V1]** |
| **Custom Vocabulary Priming** | Lecturers define keywords, aliases, and definitions before lecturing to boost ASR precision. | Supabase DB, AssemblyAI Boosting | **[LIVE - V1]** |

---

## 5. Functional Requirements Breakdown

### 5.1 Real-Time Audio & Transcription Engine

* **FR-1.1**: The system **shall** stream microphone audio from the Lecturer Workspace to AssemblyAI's WebSocket STT API with chunking `<100ms`.
* **FR-1.2**: The system **shall** inject custom domain vocabulary terms defined by the lecturer into AssemblyAI's word-boost parameters upon WebSocket connection setup.
* **FR-1.3**: The system **shall** display interim (partial) transcripts instantly and broadcast final sentence blocks to connected students via Supabase Realtime within `<300ms`.

### 5.2 AI Context & Concept Extraction Engine

* **FR-2.1**: The system **shall** analyze incoming final transcript lines using Google Gemini AI via the `gemini-extract` edge function.
* **FR-2.2**: The system **shall** extract key technical terms, produce concise 1-sentence definitions, and generate extended details formatted as **Visual Concept Cards**.
* **FR-2.3**: The system **shall** auto-generate **Smart Bullet Notes** highlighting core lecture points as the presentation progresses.
* **FR-2.4**: Upon session termination, the system **shall** synthesize the entire lecture transcript into a comprehensive **Smart Lecture Summary** containing:
  - Executive Overview
  - Core Topics Covered
  - Key Technical Definitions
  - Actionable Takeaways & Next Steps

### 5.3 Lecturer Broadcast Portal

* **FR-3.1**: Lecturers **shall** be able to initiate a live session with a single click, automatically generating a unique 6-character room code (e.g., `SB-4921`).
* **FR-3.2**: Lecturers **shall** be able to manage domain-specific custom vocabulary (keyword, definition, phonetic aliases) prior to or during a live session.
* **FR-3.3**: Lecturers **shall** receive visual audio level metering and connection state indicators (Connected, Reconnecting, Disconnected).

### 5.4 Student Accessibility Workspace

* **FR-4.1**: Students **shall** join any active session by navigating to `/student/:code` or entering the 6-character code on the landing page without requiring account registration.
* **FR-4.2**: Students **shall** receive synchronized live captions, live AI concept cards, and smart bullet notes in real time.
* **FR-4.3**: Students **shall** be able to dynamically toggle typography sizes (`sm`: 14px, `md`: 16px, `lg`: 18px, `xl`: 22px) and switch between Dark Mode and High-Contrast Light Mode.
* **FR-4.4**: Students **shall** be able to toggle auto-scroll behavior on/off to review earlier transcript lines while new lines continue streaming in background buffers.
* **FR-4.5**: Students **shall** be able to bookmark specific transcript lines and search through generated visual concept cards.

---

## 6. Non-Functional Requirements (NFRs) & Performance Specifications

### 6.1 Performance & Latency Targets

| Metric | Target Specification | Measurement Method |
| :--- | :--- | :--- |
| **Speech-to-Text Latency** | `< 300 ms` from spoken word to caption render | WebSocket timestamp delta |
| **Realtime Channel Broadcast** | `< 100 ms` data distribution latency across subscribers | Supabase WebSocket benchmark |
| **Gemini Concept Extraction** | `< 2.0 s` per transcript chunk | Edge function execution log |
| **Initial Page Load Time** | `< 1.2 s` on 3G networks | Lighthouse Performance Audit |
| **Client Memory Footprint** | `< 120 MB` during 2-hour active streaming session | Chrome Developer Profiler |

### 6.2 Reliability & Offline Resilience
* **NFR-2.1**: In the event of transient network failure, the client application **shall** maintain local transcript history in Web Storage (`localStorage` / IndexedDB) and auto-reconnect WebSocket channels seamlessly.
* **NFR-2.2**: Cross-tab state synchronization **shall** be supported via `BroadcastChannel` (`sb_offline_sync`) to prevent data loss across multiple open tabs.

### 6.3 Accessibility & Security Compliance
* **NFR-3.1**: The user interface **must** adhere strictly to **WCAG 2.1 Level AA** standards, including high-contrast visual ratios (>4.5:1), keyboard focus indicators, and screen-reader accessible ARIA tags.
* **NFR-3.2**: All database transactions **must** be protected by Supabase Row-Level Security (RLS) policies, preventing unauthorized cross-session data access.
* **NFR-3.3**: API keys (AssemblyAI, Gemini) **must** never be exposed on the frontend; all token generation and model invocation **must** route through secure Supabase Deno Edge Functions.

---

## 7. Strategic Product Roadmap & Horizon Plan

```
[ Phase 1: LIVE V1 ] ──> [ Phase 2: Sign CV & NSL ] ──> [ Phase 3: Bi-Directional ] ──> [ Phase 4: Scaling ]
- STT Streaming         - Camera Gesture Recognition   - Speech-to-Sign Avatar       - LMS Integration (Canvas)
- Gemini Context Cards   - Nigerian Sign Language Corpus - Offline Edge Models (TFLite) - Institutional Analytics
- Dual Workspaces        - Camera-to-Text Translation   - Bi-Directional Speech Synthesis - Multi-country Deployment
```

### Phase 1: Live Core & Context Engine **[COMPLETED - V1 PRODUCTION]**
* AssemblyAI real-time speech transcription with custom keyword boosting.
* Google Gemini contextual concept extraction and smart summaries.
* Supabase Realtime synchronized Lecturer & Student Workspaces.
* Accessibility suite (font scaling, themes, auto-scroll, line bookmarking).
* Asynchronous Saved Lessons & Lecture Review portal.

### Phase 2: Sign Language Vision & Localized Corpus **[IN DEVELOPMENT - Q3/Q4 2026]**
* **Computer Vision Gesture Recognition**: Integrate MediaPipe / TensorFlow.js hand landmark tracking via student webcams.
* **Nigerian Sign Language (NSL) Dataset Integration**: Train and deploy custom pose-estimation models for NSL gesture recognition.
* **Sign-to-Text Classroom Participation**: Allow deaf students to respond in class by signing into their webcam, translating gestures into text for the lecturer's screen.

### Phase 3: Bi-Directional Translation & Offline Edge AI **[PLANNED - Q1/Q2 2027]**
* **Speech-to-Sign Animated Avatar**: Render real-time 3D animated sign language avatars translating spoken lectures into sign language.
* **Offline Edge Processing Engine**: Compile STT and concept extraction models to TensorFlow Lite / ONNX Runtime for zero-internet classroom operation.
* **AI Interactive Study Tutor**: Embedded conversational AI tutor trained on lecture transcripts to answer student follow-up questions post-class.

### Phase 4: Institutional Scaling & LMS Ecosystem **[PLANNED - Q3/Q4 2027]**
* **LMS Integrations**: Plug-and-play integrations with Canvas, Moodle, Blackboard, and Google Classroom.
* **Institutional Accessibility Compliance Dashboard**: Analytics suite for university administration to track accessibility coverage, student engagement, and learning gains.
* **Multi-Language Regional Expansion**: Expand localized sign language datasets across West, East, and South Africa (KSL, SASL, ASL).

---

## 8. Competitive Advantage & Market Defensibility

| Dimension | Generic Captioning (Zoom / Teams / Otter) | Traditional Interpreters | **SignBridge AI** |
| :--- | :--- | :--- | :--- |
| **Cognitive Support** | Passive transcription only | Direct sign translation | **Live captions + Real-time AI concept explanation + Visual learning cues** |
| **Technical Jargon Accuracy** | Low (Frequent phonetic errors) | High (If interpreter is qualified) | **High (>95%) via Custom Vocabulary Priming & Gemini Context Engine** |
| **Cost & Scalability** | Low cost, low value | Extremely expensive ($50-100/hr), severe shortage | **Scalable software pricing ($0 marginal cost per classroom)** |
| **Student Participation** | 1-way passive text | 2-way manual translation | **2-way multi-modal (Sign-to-Text + Speech-to-Sign roadmap)** |
| **Localization** | Generic Western models | Region-specific | **Dedicated focus on Nigerian Sign Language (NSL) & African EdTech** |
| **Post-Lecture Utility** | Unformatted wall of text | None | **Structured smart summaries, interactive concept archives & notes** |

---

## 9. Key Success Metrics & Investor KPIs

### 9.1 Product & User Engagement KPIs
* **Daily Active Users (DAU) & Session Completion Rate**: Percentage of started lectures that run through to normal termination (>90% target).
* **Concept Card Engagement Rate**: Frequency of student interaction with generated concept cards during live lectures.
* **Post-Lecture Review Usage**: Percentage of students accessing the Saved Lessons review portal within 48 hours of a lecture (>60% target).

### 9.2 Technical & AI Precision KPIs
* **Speech Recognition Word Error Rate (WER)**: Standard WER `<8%` on general speech, `<5%` when domain vocabulary primers are configured.
* **AI Extraction Precision**: `>90%` relevance score on generated concept definitions as rated by domain educators.
* **End-to-End Latency**: Maintaining `<300ms` caption streaming and `<2s` concept extraction under load.

### 9.3 Social Impact & Commercial Growth KPIs
* **Comprehension Lift Score**: Measured improvement in test scores and lecture comprehension for DHH students using SignBridge vs. standard captions (`>25%` target improvement).
* **Institutional Pilot Adoption**: Number of university departments and inclusive education centers onboarded.
* **Interpreter Cost Savings**: Total documented dollar savings for partner institutions deploying SignBridge alongside or in place of full-time interpreters.

---

## 10. Technical Stack Summary

* **Frontend Framework**: React 18, TypeScript, Vite, Tailwind CSS, FontAwesome Icons.
* **State & Routing**: React Router v6, React Context API (`SignBridgeContext`), Web Storage APIs.
* **Backend Infrastructure**: Supabase Cloud (PostgreSQL DB, Row-Level Security, Supabase Auth).
* **Real-Time Communication**: Supabase Realtime WebSocket Channels, Web Audio API, BroadcastChannel API.
* **Serverless Functions**: Deno Edge Functions (`assemblyai-token`, `gemini-extract`).
* **AI Speech Engine**: AssemblyAI Real-Time WebSocket Streaming API with Word Boost.
* **AI Context Engine**: Google Gemini 1.5 Flash / Pro via Google Generative AI SDK.
* **Future Computer Vision Stack**: MediaPipe Hands, TensorFlow Lite, ONNX Runtime Web.

---

*Document Author: SignBridge AI Senior Product & Engineering Team*  
*For questions, investment inquiries, or partnership proposals, contact the product lead.*
