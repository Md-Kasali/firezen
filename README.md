<div align="center">

<img src="resources/icon.png" alt="Firezen Logo" width="96" height="96" />

# Firezen

**A powerful desktop GUI for managing Google Cloud Firestore — built with Electron, React, and TypeScript.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Md-Kasali/firezen?label=download&logo=github)](https://github.com/Md-Kasali/firezen/releases/latest)
[![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase Admin](https://img.shields.io/badge/Firebase%20Admin-13-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)

</div>

---

## Overview

Firezen is an open-source desktop application that gives developers a clean, fast, and intuitive interface for exploring and managing Firestore databases — without needing to touch the Firebase Console. It runs locally on your machine using the Firebase Admin SDK, giving you full access to your data with the speed and control of a native desktop app.

### Why Firezen?

- 🔒 **Fully local** — your service account credentials never leave your machine
- ⚡ **Fast** — native Electron app, no browser round-trips
- 🎨 **Beautiful UI** — glassmorphism design with light and dark themes
- 🤖 **AI-powered queries** — describe what you want in plain English
- 🗄️ **Multi-project** — manage multiple Firebase projects from one window

---

## Features

| Feature | Description |
|---|---|
| **Visual Query Builder** | Construct Firestore queries with row-based filters, no code required |
| **Advanced FQL Editor** | Write Firezen Query Language (FQL) directly with autocomplete and syntax validation |
| **AI Generate** | Describe your query in plain English — powered by OpenAI |
| **Data Grid** | Sortable, paginated table view with inline document editing |
| **JSON View** | Inspect raw document structure in a formatted JSON panel |
| **Schema Explorer** | Automatically sample field names and types from your collection |
| **Bulk Operations** | Select multiple documents and batch update a field or delete in one click |
| **Import / Export** | Import collections from JSON files; export your entire database to a single JSON snapshot |
| **Document Editor** | Create and edit documents with a structured field-by-field form |
| **Multi-Project Support** | Switch between Firebase projects using the sidebar dropdown |
| **Secure Credential Storage** | Service account keys stored encrypted via Electron's `safeStorage` API |
| **Light & Dark Mode** | Toggle appearance from the Settings panel |

---

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- A **Google Cloud service account JSON** with Firestore access ([how to create one](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments))

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Md-Kasali/firezen.git
cd firezen
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run in development mode

```bash
npm run dev
```

### 4. Connect your Firebase project

On first launch, drag and drop your **service account JSON** file into the drop zone, or click to browse. Firezen will securely store the credentials and connect automatically on future launches.

---

## Building

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Distributable files are output to the `dist/` directory.

---

## AI Query Generation

Firezen integrates with the OpenAI API to let you query Firestore in plain English.

1. Open **Settings → AI Configuration**
2. Paste your OpenAI API key (stored encrypted, never transmitted elsewhere)
3. Switch to the **AI Generate** tab in any collection view
4. Type a description like: *"Show active users with a score greater than 5, ordered by name"*

> **Note:** The AI Generate tab is disabled until an API key is configured.

---

## FQL — Firezen Query Language

FQL is a lightweight query syntax for Firestore, with full autocomplete in the editor.

```
status == "active" AND score > 4 ORDER BY score DESC LIMIT 50
```

**Syntax reference:**

| Clause | Example |
|---|---|
| Equality | `field == "value"` |
| Comparison | `age > 18`, `score <= 100` |
| Not equal | `status != "archived"` |
| Array contains | `tags HAS "react"` |
| Multiple conditions | `condition1 AND condition2` |
| Ordering | `ORDER BY createdAt DESC` |
| Limit | `LIMIT 100` |

---

## Project Structure

```
firezen/
├── src/
│   ├── main/                  # Electron main process (Firebase Admin, IPC handlers)
│   ├── preload/               # Context bridge / IPC exposure to renderer
│   └── renderer/
│       └── src/
│           ├── assets/        # Global CSS (design tokens, layout, components)
│           └── components/    # React components
│               ├── AuthScreen.tsx
│               ├── Dashboard.tsx
│               ├── DataGrid.tsx
│               ├── DocumentEditor.tsx
│               ├── BulkActionBar.tsx
│               ├── FqlEditor.tsx
│               ├── QueryBuilder.tsx
│               └── ThemeProvider.tsx
├── resources/
│   └── icon.png               # App icon
├── LICENSE
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Desktop shell** | [Electron 39](https://www.electronjs.org/) |
| **Build tool** | [electron-vite](https://electron-vite.org/) |
| **UI framework** | [React 19](https://react.dev/) + [TypeScript 5.9](https://www.typescriptlang.org/) |
| **Data fetching** | [Firebase Admin SDK 13](https://firebase.google.com/docs/admin/setup) |
| **Table** | [@tanstack/react-table 8](https://tanstack.com/table) |
| **Icons** | [lucide-react](https://lucide.dev/) |
| **AI** | [OpenAI Node SDK 6](https://github.com/openai/openai-node) |
| **Storage** | [electron-store](https://github.com/sindresorhus/electron-store) + Electron `safeStorage` |
| **Styling** | Vanilla CSS with CSS custom properties (no framework) |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to your fork: `git push origin feat/your-feature`
5. Open a Pull Request

Please keep commits small and focused, and use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## Security

Firezen stores credentials locally using Electron's built-in `safeStorage` API, which encrypts data using the OS keychain (Keychain on macOS, libsecret on Linux, DPAPI on Windows). Your service account keys and API keys are **never sent to any external server**.

If you discover a security vulnerability, please open a [GitHub issue](https://github.com/Md-Kasali/firezen/issues) or reach out directly.

---

## License

Copyright © 2026 Kasali-Aslaniya

Licensed under the [Apache License, Version 2.0](LICENSE).

---

<div align="center">
  Made with ❤️ for developers who love clean tools
</div>
