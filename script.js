// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/AKfycbwvppNMZrmUMqrbUE_qmWjVNCKF3G6tVFPdhYII8CFw8ZJZQT2II7cxtaewF7lUbAuO/exec"; // your deployed Apps Script URL

// ====== STATE ======
let TASKS = [];
let NOTES = [];
let SEARCH = "";

// ====== UI NAV ======
function showSection(id) {
  // switch sections
  document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  // close mobile menu if open
  document.getElementById("navMenu").classList.remove("show");

  // ALWAYS hide Quick Add modal when switching tabs
  const modalOverlay = document.getElementById("modalOverlay");
  if (modalOverlay && !modalOverlay.hidden) modalOverlay.hidden = true;
}
document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("navMenu").classList.toggle("show");
});

// ====== HELPERS ======
const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  // YYYY-MM-DD
  const pad = (n)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const parseDate = (v) => v ? new Date(v) : null;
const isOverdue = (due, status) => {
  if (!due || status === "Done") return false;
  const d = parseDate(due);
  if (!d) return false;
  const today = new Date();
  d.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return d < today;
};
const badgeClass = (t) => {
  if (t.status === "Done") return "done";
  if (isOverdue(t.dueDate, t.status)) return "overdue";
  return "pending";
};
const matchesSearch = (text) => {
  if (!SEARCH) return true;
  return (text || "").toString().toLowerCase().includes(SEARCH);
};
function escapeHtml(str) {
  return (str || "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ====== DATA LOADERS ======
async function loadTasks() {
  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "getTasks" }) });
    if (!res.ok) throw new Error("Failed to fetch tasks");
    const data = await res.json(); // array from code.gs
    TASKS = (Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
    TASKS = [];
    alert("Could not load tasks from server.");
  }
  renderAll();
}
async function loadNotes() {
  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "getNotes" }) });
    if (!res.ok) throw new Error("Failed to fetch notes");
    const data = await res.json(); // array from code.gs
    NOTES = (Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
    NOTES = [];
    alert("Could not load notes from server.");
  }
  renderAll();
}

// ====== RENDER ======
function renderAll() {
  renderSummary();
  renderProgress();
  renderTasksTables();
  renderNotesTables();
}

function renderSummary() {
  const total = TASKS.length;
  const completed = TASKS.filter(t => t.status === "Done").length;
  const pending = TASKS.filter(t => t.status !== "Done").length;
  const overdue = TASKS.filter(t => isOverdue(t.dueDate, t.status)).length;

  document.getElementById("cardTotal").textContent = total;
  document.getElementById("cardCompleted").textContent = completed;
  document.getElementById("cardPending").textContent = pending;
  document.getElementById("cardOverdue").textContent = overdue;
}

function renderProgress() {
  const total = TASKS.length;
  const completed = TASKS.filter(t => t.status === "Done").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  document.getElementById("progressPct").textContent = `${pct}%`;
  document.getElementById("progressBar").style.width = `${pct}%`;
}

function renderTasksTables() {
  const filtered = TASKS.filter(t => matchesSearch(`${t.task} ${t.status} ${fmtDate(t.dueDate)}`));
  const rowsHtml = filtered.map(t => `
    <tr>
      <td>${escapeHtml(t.task)}</td>
      <td>${fmtDate(t.dueDate) || "No date"}</td>
      <td><span class="badge ${badgeClass(t)}">${t.status}</span></td>
      <td class="actions-col">
        ${t.status !== "Done" ? `<button onclick="markDone('${t.id}')">✔</button>` : ""}
        <button class="danger" onclick="deleteTask('${t.id}')">🗑</button>
      </td>
    </tr>
  `).join("");

  document.getElementById("taskTableBody").innerHTML = rowsHtml;
  document.getElementById("taskTableBodyFull").innerHTML = rowsHtml;
}

function renderNotesTables() {
  const filtered = NOTES.filter(n => matchesSearch(`${n.title} ${n.content} ${fmtDate(n.date)}`));
  const rowsHtml = filtered.map(n => `
    <tr>
      <td>${escapeHtml(n.title)}</td>
      <td>${escapeHtml(n.content)}</td>
      <td>${fmtDate(n.date)}</td>
    </tr>
  `).join("");

  document.getElementById("noteTableBody").innerHTML = rowsHtml;
  document.getElementById("noteTableBodyFull").innerHTML = rowsHtml;
}

// ====== EVENTS ======
// Forms (Tasks page)
document.getElementById("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const task = document.getElementById("taskInput").value.trim();
  const dueDate = document.getElementById("dueDateInput").value;
  const email = document.getElementById("emailInput").value.trim();
  if (!task) return;

  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "addTask", task, dueDate, email }),
    });
  } catch (err) {
    console.error(err);
    alert("Failed to add task.");
  }

  e.target.reset();
  await loadTasks();
});

// Forms (Notes page)
document.getElementById("noteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("noteTitle").value.trim();
  const content = document.getElementById("noteContent").value.trim();
  if (!title || !content) return;

  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "addNote", title, content }),
    });
  } catch (err) {
    console.error(err);
    alert("Failed to add note.");
  }

  e.target.reset();
  await loadNotes();
});

// Quick Add Modal
const modalOverlay = document.getElementById("modalOverlay");
document.getElementById("quickAddBtn").addEventListener("click", () => {
  modalOverlay.hidden = false;
  document.getElementById("qaTask").focus();
});
document.getElementById("modalClose").addEventListener("click", () => {
  modalOverlay.hidden = true;
});
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.hidden = true;
});
document.getElementById("quickAddForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const task = document.getElementById("qaTask").value.trim();
  const dueDate = document.getElementById("qaDue").value;
  const email = document.getElementById("qaEmail").value.trim();
  if (!task) return;

  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "addTask", task, dueDate, email }),
    });
  } catch (err) {
    console.error(err);
    alert("Failed to add task.");
  }

  e.target.reset();
  modalOverlay.hidden = true;
  await loadTasks();
});

// Global search
document.getElementById("globalSearch").addEventListener("input", (e) => {
  SEARCH = e.target.value.toLowerCase();
  renderAll();
});

// Actions: mark done / delete
async function markDone(id) {
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateTaskStatus", id, status: "Done" }),
    });
  } catch (err) {
    console.error(err);
    alert("Failed to update task.");
  }
  await loadTasks();
}
async function deleteTask(id) {
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "deleteTask", id }),
    });
  } catch (err) {
    console.error(err);
    alert("Failed to delete task.");
  }
  await loadTasks();
}

// Export CSV
document.getElementById("exportTasksBtn").addEventListener("click", () => {
  const rows = [
    ["Task","Due Date","Status"],
    ...TASKS.map(t => [t.task, fmtDate(t.dueDate) || "", t.status])
  ];
  downloadCSV(rows, `tasks_${timestamp()}.csv`);
});
document.getElementById("exportNotesBtn").addEventListener("click", () => {
  const rows = [
    ["Title","Content","Date"],
    ...NOTES.map(n => [n.title, n.content, fmtDate(n.date)])
  ];
  downloadCSV(rows, `notes_${timestamp()}.csv`);
});

function downloadCSV(rows, filename){
  const csv = rows.map(r => r.map(cell => {
    const s = (cell ?? "").toString().replaceAll('"','""');
    return `"${s}"`;
  }).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function timestamp(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

// ====== INIT ======
(async function init(){
  await Promise.all([loadTasks(), loadNotes()]);
})();




document.addEventListener("DOMContentLoaded", () => {
    const quickAddBtn = document.getElementById("quickAddTask");
    const exportTasksBtn = document.getElementById("exportTasksCsv");
    const exportNotesBtn = document.getElementById("exportNotesCsv");
    const addTaskModal = document.getElementById("addTaskModal");
    const closeTaskModal = document.getElementById("closeTaskModal");
    const addTaskForm = document.getElementById("addTaskForm");

    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    let notes = JSON.parse(localStorage.getItem("notes")) || [];

    /** ---------- Quick Add Task ---------- **/
    quickAddBtn?.addEventListener("click", () => {
        addTaskModal.style.display = "block";
    });

    closeTaskModal?.addEventListener("click", () => {
        addTaskModal.style.display = "none";
    });

    /** ---------- Add Task Form Submit ---------- **/
    addTaskForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const taskName = document.getElementById("taskName").value.trim();
        const dueDate = document.getElementById("dueDate").value;
        const status = document.getElementById("status").value;

        if (!taskName) return alert("Please enter a task name");

        const newTask = { id: Date.now(), name: taskName, due: dueDate, status: status };
        tasks.push(newTask);
        localStorage.setItem("tasks", JSON.stringify(tasks));

        addTaskForm.reset();
        addTaskModal.style.display = "none";
        alert("Task added successfully!");
    });

    /** ---------- Export CSV Functions ---------- **/
    function exportCSV(data, filename) {
        if (!data.length) {
            alert("No data to export");
            return;
        }

        const csvContent =
            Object.keys(data[0]).join(",") + "\n" +
            data.map(row => Object.values(row).map(v => `"${v}"`).join(",")).join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    exportTasksBtn?.addEventListener("click", () => {
        exportCSV(tasks, "tasks.csv");
    });

    exportNotesBtn?.addEventListener("click", () => {
        exportCSV(notes, "notes.csv");
    });
});
