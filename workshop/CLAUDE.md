# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static multi-page workshop site for "Claude Code 워크샵". No build step, no package manager — plain HTML/CSS/JS served by a lightweight Node.js dev server.

## Dev Server

```bash
node server.js        # starts at http://localhost:3000
```

`server.js` serves static files from `__dirname` and exposes one write endpoint (`POST /__save`) that lets the browser save the current page HTML back to disk. No external npm dependencies.

## Page Structure

Each HTML page (`index.html`, `01-setup.html` … `05-vibe-coding.html`, `handout.html`) follows this layout:

- `<link rel="stylesheet" href="./style.css">` — shared styles
- `<script src="./edit.js" defer></script>` — inline editing system
- `.site-header > .nav-inner` — sticky top nav (edit.js injects buttons here)
- `.page-hero` or `.hero-section` — page hero area (persisted by edit.js)
- `.main-content` — page body (persisted by edit.js)

## Inline Editing System (`edit.js`)

`edit.js` runs on every page and adds:
- **Edit / Save buttons** injected into `.nav-inner`
- **localStorage persistence** — saves `.main-content` and `.hero-section / .page-hero` innerHTML, keyed by `workshop-edit:<pathname>`
- **File save** (`💾 파일 저장` button or `Cmd+S`) — only active when served from localhost; POSTs full `document.documentElement.outerHTML` to `/__save`
- **Reset** — clears localStorage and reloads

Editable elements are scoped to `.main-content` and hero sections; nav/buttons are excluded.

## Styling

`style.css` defines all CSS custom properties in `:root` (colors, radius, shadow, max-width). Use these variables when adding new styles rather than hardcoding values:

| Variable | Use |
|---|---|
| `--accent` / `--accent-light` | Brand orange tones |
| `--text` / `--text-2` | Primary / secondary text |
| `--surface` / `--surface-2` | Card backgrounds |
| `--border` | Border color |
| `--radius` | Standard border-radius (8px) |
| `--max-w` | Content max-width (760px) |
