# PomoDuo — Collaborative Pomodoro Focus & Accountability

[![React Native](https://img.shields.io/badge/React%20Native-0.85-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-56-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime%20%26%20Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **PomoDuo** is a cross-platform mobile productivity application built with **React Native (Expo SDK 56)** and **Supabase**. It transforms the classic Pomodoro Technique into a collaborative multiplayer experience—enabling friends and study partners to sync focus intervals, chat in real-time, maintain accountability streaks, and compete on focus leaderboards.

---

## 📱 Live Demo & Download

Recruiters, hiring managers, and testers can download the standalone Android APK directly:

[![Download Android APK](https://img.shields.io/badge/Download-Android%20APK%20(v1.0.0)-34A853?style=for-the-badge&logo=android&logoColor=white)](https://github.com/Rener19/PomoDuo-FR-this-time/releases)

> 💡 *Download the `.apk` from the latest GitHub Release and install directly on any Android device (no development environment or Expo Go needed).*

---

## ✨ Key Features

### 👥 Real-Time Duo Focus Rooms
* **Synchronized Timers:** Pair up with study partners or colleagues. When the room host starts, pauses, or switches between Focus and Break intervals, all connected participants are instantly synchronized with millisecond precision.
* **Presence & Dynamic Host Migration:** If the room host disconnects, the session automatically nominates the next active participant as host without interrupting ongoing focus cycles.
* **Ephemeral In-Session Chat:** Built-in lightweight room messaging during sessions. Messages automatically purge upon session termination to respect user privacy and optimize database footprints.

### ⏱️ Solo Pomodoro Engine & Background Service
* **Native Foreground Service:** Implemented persistent notification and background worker support to prevent Android OS battery killers from interrupting running focus timers.
* **Customizable Intervals:** Smooth scroll-wheel interval selectors for Pomodoro focus periods, short breaks, and long breaks.
* **State Recovery:** Automatic session restoration and timestamp synchronization upon app restart.

### 🏆 Social & Gamification
* **Friend System & Direct Room Invites:** Search users by username, send friend requests, and dispatch instant push/realtime invites to join focus sessions.
* **Realtime Leaderboards:** Track cumulative focus hours, active streaks, and compare productivity metrics globally or against your friend circle.
* **User Profiles:** Personalized statistics, avatar customization, and historical focus logs.

### 🎨 Fluid UI & Micro-Interactions
* **Reanimated 4 Engine:** Hardware-accelerated SVG timer rings powered by `react-native-reanimated` with declarative shared value interpolations.
* **Adaptive Theme Transitions:** 400ms color interpolations between Vermilion Red (`#D9381E` Focus Mode) and Deep Ocean Blue (`#1B4965` Break Mode).

---

## 🛠️ Architecture & Tech Stack

```
├── Mobile Client (React Native + Expo SDK 56)
│   ├── UI Layer: Expo Router, React Native Reanimated 4, React Native SVG
│   ├── State Management: Zustand (duoStore, timerStore, authStore, settingsStore)
│   ├── Native Layer: Android Foreground Services, Background Timers, Native Notifications
│   └── Networking: Supabase Client SDK, Google Sign-In Native SDK
│
└── Backend Infrastructure (Supabase)
    ├── PostgreSQL with Row Level Security (RLS)
    ├── Supabase Realtime (WebSockets: Presence, Broadcast & Postgres Changes)
    ├── Supabase Auth (Native Google OAuth + Email OTP)
    └── Database Functions (Atomic RPCs for streak increments & focus time logging)
```

| Domain | Technology / Library |
|---|---|
| **Framework** | [React Native 0.85](https://reactnative.dev/) via [Expo SDK 56](https://expo.dev/) (New Architecture ready) |
| **Routing** | [Expo Router v4](https://docs.expo.dev/router/introduction/) (File-based navigation) |
| **State Management** | [Zustand 5](https://github.com/pmndrs/zustand) |
| **Backend & Realtime** | [Supabase](https://supabase.com/) (PostgreSQL, Realtime Presence/Broadcast Channels, Storage) |
| **Authentication** | [Google Sign-In](https://github.com/react-native-google-signin/google-signin) & Supabase Auth |
| **Animations** | [React Native Reanimated 4](https://docs.swmansion.com/react-native-reanimated/) |
| **Graphics** | [React Native SVG](https://github.com/software-mansion/react-native-svg) |
| **Typography** | Plus Jakarta Sans & Literata (`@expo-google-fonts`) |

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
