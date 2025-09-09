// app.js
const path = require("path");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- DB: open and ensure schema ----------
const dbPath = path.join(__dirname, "data", "tasks.db");
const db = new Database(dbPath);

// base table (older DBs may lack some columns; we add them below)
db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    due_date    TEXT,
    completed   INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// light "migration" for older DBs that might miss columns
const cols = db.prepare(`PRAGMA table_info(tasks)`).all();
const colNames = new Set(cols.map(c => c.name));

if (!colNames.has("completed")) {
  db.prepare(`ALTER TABLE tasks ADD COLUMN completed INTEGER DEFAULT 0`).run();
}
if (!colNames.has("due_date")) {
  db.prepare(`ALTER TABLE tasks ADD COLUMN due_date TEXT`).run();
}

// ---------- Express setup ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(expressLayouts);
app.set("layout", "layout"); // uses views/layout.ejs

app.use(express.urlencoded({ extended: true }));           // form posts
app.use(express.static(path.join(__dirname, "public")));   // /public -> static

// ---------- View helpers (available in EJS as globals) ----------
app.locals.prettyDate = function prettyDate(input) {
  if (!input) return "";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00` : String(input);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// ---------- Small validators ----------
function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ---------- Prepared statements ----------
const listTasks = db.prepare(`
  SELECT id, title, description, due_date, completed, created_at
  FROM tasks
  ORDER BY completed ASC, 
           CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END,
           due_date ASC, id DESC
`);

const getTask = db.prepare(`SELECT * FROM tasks WHERE id = ?`);

const insertTask = db.prepare(`
  INSERT INTO tasks (title, description, due_date) VALUES (?, ?, ?)
`);

const updateCompleted = db.prepare(`
  UPDATE tasks SET completed = ? WHERE id = ?
`);

const updateTask = db.prepare(`
  UPDATE tasks SET title = ?, description = ?, due_date = ? WHERE id = ?
`);

const deleteTask = db.prepare(`DELETE FROM tasks WHERE id = ?`);

// ---------- Routes ----------
app.get("/", (req, res) => res.redirect("/tasks"));

app.get("/tasks", (req, res) => {
  const tasks = listTasks.all();

  // success banner mapping
  const okMap = {
    created: "Task added.",
    completed: "Task marked complete.",
    reopened: "Task marked active.",
    deleted: "Task deleted.",
    updated: "Task updated."
  };
  const message = okMap[req.query.ok] || null;

  // errors/form are only used when we re-render after validation failure
  res.render("index", { tasks, message, errors: null, form: null });
});

app.post("/tasks", (req, res) => {
  const form = {
    title: (req.body.title || "").trim(),
    description: (req.body.description || "").trim(),
    due_date: (req.body.due_date || "").trim()
  };

  const errors = [];
  if (!form.title) errors.push("Title is required.");
  if (form.title.length > 200) errors.push("Title must be 200 characters or fewer.");
  if (form.description.length > 1000) errors.push("Description must be 1000 characters or fewer.");
  if (form.due_date && !isISODate(form.due_date)) errors.push("Please use the date picker (YYYY-MM-DD).");

  if (errors.length) {
    const tasks = listTasks.all();
    return res.status(400).render("index", {
      tasks,
      message: null,
      errors,
      form
    });
  }

  const due = form.due_date === "" ? null : form.due_date;
  insertTask.run(form.title, form.description, due);
  res.redirect("/tasks?ok=created"); // PRG
});

// mark complete
app.post("/tasks/:id/complete", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.redirect("/tasks");
  updateCompleted.run(1, id);
  res.redirect("/tasks?ok=completed");
});

// undo complete
app.post("/tasks/:id/uncomplete", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.redirect("/tasks");
  updateCompleted.run(0, id);
  res.redirect("/tasks?ok=reopened");
});

// optional edit route (if your UI has edit form)
app.post("/tasks/:id/edit", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.redirect("/tasks");

  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim();
  let due_date = (req.body.due_date || "").trim();

  const errors = [];
  if (!title) errors.push("Title is required.");
  if (title.length > 200) errors.push("Title must be 200 characters or fewer.");
  if (description.length > 1000) errors.push("Description must be 1000 characters or fewer.");
  if (due_date && !isISODate(due_date)) errors.push("Please use the date picker (YYYY-MM-DD).");

  if (errors.length) {
    // re-render main page with errors + current list + attempted form values
    const tasks = listTasks.all();
    return res.status(400).render("index", {
      tasks,
      message: null,
      errors,
      form: { title, description, due_date }
    });
  }

  if (due_date === "") due_date = null;
  updateTask.run(title, description, due_date, id);
  res.redirect("/tasks?ok=updated");
});

// delete
app.post("/tasks/:id/delete", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.redirect("/tasks");
  deleteTask.run(id);
  res.redirect("/tasks?ok=deleted");
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Internal Server Error");
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Task Manager running on http://localhost:${PORT}`);
});
