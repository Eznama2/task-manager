# Task Manager — Node.js + Express + SQLite (1-week project)

A minimal, laptop-only task manager built with **Express + EJS** and **SQLite** using **better-sqlite3**.  
Focus: clean CRUD, persistent storage, dark UI and user-friendly validation.

## Quick Start

```bash
# 1) Install deps
npm install

# 2) Run in dev (auto-reload)
npm run dev

# 3) Open the app
# http://localhost:3000/tasks

task-manager/
├─ app.js
├─ package.json
├─ data/
│  └─ tasks.db           # created on first run
├─ public/
│  └─ style.css          # dark slate theme
└─ views/
   ├─ layout.ejs         # wraps all pages
   └─ index.ejs          # add/list + actions

