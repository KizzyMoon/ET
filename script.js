const storageKey = "event-team-hub-v1";

const sampleData = {
  team: [
    {
      id: crypto.randomUUID(),
      name: "Alex Morgan",
      notes: "Main event lead.",
    },
    {
      id: crypto.randomUUID(),
      name: "Jordan Lee",
      notes: "Venue and vendor follow-up.",
    },
  ],
  meetings: [
    {
      id: crypto.randomUUID(),
      title: "July event planning",
      date: "2026-07-02",
      time: "18:00",
      agenda: "Confirm event timeline, supplies, and team assignments.",
    },
    {
      id: crypto.randomUUID(),
      title: "Vendor check-in",
      date: "2026-07-09",
      time: "18:00",
      agenda: "Review vendor confirmations and outstanding questions.",
    },
  ],
  attendance: [],
  notes: [],
};

let state = loadState();
let activeView = "meetings";
let searchTerm = "";

const views = {
  meetings: {
    title: "Meetings",
    hint: "Create and manage meeting dates, times, and agendas.",
    columns: ["Date", "Time", "Title", "Agenda", ""],
  },
  team: {
    title: "Event Team",
    hint: "Add, edit, and remove people who can be selected for attendance.",
    columns: ["Name", "Notes", ""],
  },
  attendance: {
    title: "Attendance",
    hint: "Track who attended each meeting and whether any follow-up is needed.",
    columns: ["Meeting", "Name", "Status", "Arrival", "Notes", ""],
  },
  notes: {
    title: "Notes",
    hint: "Keep meeting notes, decisions, action items, owners, and due dates together.",
    columns: ["Meeting", "Note", "Action", "Owner", "Due", ""],
  },
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setView(tab.dataset.view));
});

document.getElementById("searchInput").addEventListener("input", (event) => {
  searchTerm = event.target.value.toLowerCase();
  renderTable();
});

document.getElementById("meetingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.meetings.push({
    id: crypto.randomUUID(),
    title: form.get("title").trim(),
    date: form.get("date"),
    time: form.get("time"),
    agenda: form.get("agenda").trim(),
  });
  event.currentTarget.reset();
  saveAndRender();
});

document.getElementById("attendanceForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const person = findPerson(form.get("personId"));
  state.attendance.push({
    id: crypto.randomUUID(),
    meetingId: form.get("meetingId"),
    personId: form.get("personId"),
    name: person?.name || "",
    status: form.get("status"),
    arrival: form.get("arrival"),
    notes: form.get("notes").trim(),
  });
  event.currentTarget.reset();
  saveAndRender();
});

document.getElementById("noteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.notes.push({
    id: crypto.randomUUID(),
    meetingId: form.get("meetingId"),
    note: form.get("note").trim(),
    action: form.get("action").trim(),
    owner: form.get("owner").trim(),
    dueDate: form.get("dueDate"),
    status: form.get("action").trim() ? "Open" : "Done",
  });
  event.currentTarget.reset();
  saveAndRender();
});

document.getElementById("teamForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const person = {
    id: form.get("id") || crypto.randomUUID(),
    name: form.get("name").trim(),
    notes: form.get("notes").trim(),
  };
  const existingIndex = state.team.findIndex((member) => member.id === person.id);
  if (existingIndex >= 0) {
    state.team[existingIndex] = person;
    state.attendance = state.attendance.map((row) => {
      return row.personId === person.id ? { ...row, name: person.name } : row;
    });
  } else {
    state.team.push(person);
  }
  resetTeamForm();
  saveAndRender();
});

document.getElementById("cancelTeamEdit").addEventListener("click", resetTeamForm);

document.getElementById("exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `event-team-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("importData").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const imported = JSON.parse(await file.text());
  state = {
    team: Array.isArray(imported.team) ? imported.team : buildTeamFromAttendance(imported.attendance),
    meetings: Array.isArray(imported.meetings) ? imported.meetings : [],
    attendance: Array.isArray(imported.attendance) ? imported.attendance : [],
    notes: Array.isArray(imported.notes) ? imported.notes : [],
  };
  saveAndRender();
  event.target.value = "";
});

document.getElementById("tableBody").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    editPerson(editButton.dataset.id);
    return;
  }

  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const { collection, id } = button.dataset;
  state[collection] = state[collection].filter((item) => item.id !== id);
  if (collection === "meetings") {
    state.attendance = state.attendance.filter((item) => item.meetingId !== id);
    state.notes = state.notes.filter((item) => item.meetingId !== id);
  }
  if (collection === "team") {
    state.attendance = state.attendance.map((item) => {
      return item.personId === id ? { ...item, personId: "", name: `${item.name} (removed)` } : item;
    });
  }
  saveAndRender();
});

function loadState() {
  const saved = localStorage.getItem(storageKey);
  const loaded = saved ? JSON.parse(saved) : sampleData;
  return {
    team: Array.isArray(loaded.team) ? loaded.team : buildTeamFromAttendance(loaded.attendance),
    meetings: Array.isArray(loaded.meetings) ? loaded.meetings : [],
    attendance: Array.isArray(loaded.attendance) ? loaded.attendance : [],
    notes: Array.isArray(loaded.notes) ? loaded.notes : [],
  };
}

function saveAndRender() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  render();
}

function setView(view) {
  activeView = view;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".entry-form").forEach((form) => form.classList.toggle("hidden", form.dataset.form !== view));
  document.getElementById("searchInput").value = "";
  searchTerm = "";
  render();
}

function render() {
  renderMetrics();
  renderMeetingOptions();
  renderPersonOptions();
  renderTable();
}

function renderMetrics() {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = state.meetings.filter((meeting) => meeting.date >= today).length;
  const presentCount = state.attendance.filter((row) => row.status === "In Attendance").length;
  const totalAttendance = state.attendance.length;
  const openActions = state.notes.filter((note) => note.action && note.status !== "Done").length;

  document.getElementById("upcomingCount").textContent = upcoming;
  document.getElementById("attendanceCount").textContent = totalAttendance;
  document.getElementById("openActionCount").textContent = openActions;
  document.getElementById("presentRate").textContent = totalAttendance ? `${Math.round((presentCount / totalAttendance) * 100)}%` : "0%";
  document.getElementById("teamCount").textContent = state.team.length;
}

function renderMeetingOptions() {
  document.querySelectorAll('select[name="meetingId"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = state.meetings
      .map((meeting) => `<option value="${meeting.id}">${escapeHtml(meeting.title)} - ${formatDate(meeting.date)}</option>`)
      .join("");
    select.value = current && state.meetings.some((meeting) => meeting.id === current) ? current : state.meetings[0]?.id || "";
  });
}

function renderPersonOptions() {
  document.querySelectorAll('select[name="personId"]').forEach((select) => {
    const current = select.value;
    if (!state.team.length) {
      select.innerHTML = `<option value="">Add a team member first</option>`;
      return;
    }
    select.innerHTML = state.team
      .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
      .join("");
    select.value = current && state.team.some((person) => person.id === current) ? current : state.team[0]?.id || "";
  });
}

function renderTable() {
  const config = views[activeView];
  document.getElementById("tableTitle").textContent = config.title;
  document.getElementById("tableHint").textContent = config.hint;
  document.getElementById("tableHead").innerHTML = `<tr>${config.columns.map((column) => `<th>${column}</th>`).join("")}</tr>`;

  const rows = getRows().filter((row) => JSON.stringify(row).toLowerCase().includes(searchTerm));
  const body = document.getElementById("tableBody");
  if (!rows.length) {
    body.innerHTML = document.getElementById("emptyState").innerHTML;
    return;
  }

  body.innerHTML = rows.map((row) => renderRow(row)).join("");
}

function getRows() {
  if (activeView === "meetings") {
    return [...state.meetings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }
  if (activeView === "team") {
    return [...state.team].sort((a, b) => a.name.localeCompare(b.name));
  }
  return state[activeView];
}

function renderRow(row) {
  if (activeView === "meetings") {
    return `<tr>
      <td>${formatDate(row.date)}</td>
      <td>${escapeHtml(row.time)}</td>
      <td><strong>${escapeHtml(row.title)}</strong></td>
      <td>${escapeHtml(row.agenda)}</td>
      <td>${deleteButton("meetings", row.id)}</td>
    </tr>`;
  }

  if (activeView === "attendance") {
    const meeting = findMeeting(row.meetingId);
    const person = findPerson(row.personId);
    return `<tr>
      <td>${escapeHtml(meeting?.title || "Deleted meeting")}</td>
      <td><strong>${escapeHtml(person?.name || row.name)}</strong></td>
      <td><span class="badge ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.arrival)}</td>
      <td>${escapeHtml(row.notes)}</td>
      <td>${deleteButton("attendance", row.id)}</td>
    </tr>`;
  }

  if (activeView === "team") {
    return `<tr>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${escapeHtml(row.notes)}</td>
      <td class="row-actions">${editButton(row.id)}${deleteButton("team", row.id)}</td>
    </tr>`;
  }

  const meeting = findMeeting(row.meetingId);
  return `<tr>
    <td>${escapeHtml(meeting?.title || "Deleted meeting")}</td>
    <td>${escapeHtml(row.note)}</td>
    <td>${escapeHtml(row.action)}</td>
    <td>${escapeHtml(row.owner)}</td>
    <td>${formatDate(row.dueDate)}</td>
    <td>${deleteButton("notes", row.id)}</td>
  </tr>`;
}

function deleteButton(collection, id) {
  return `<button class="delete-row" data-delete data-collection="${collection}" data-id="${id}" title="Delete row" aria-label="Delete row">x</button>`;
}

function editButton(id) {
  return `<button class="edit-row" data-edit data-id="${id}" title="Edit person" aria-label="Edit person">Edit</button>`;
}

function editPerson(id) {
  const person = findPerson(id);
  if (!person) return;
  setView("team");
  const form = document.getElementById("teamForm");
  form.elements.id.value = person.id;
  form.elements.name.value = person.name;
  form.elements.notes.value = person.notes;
  document.getElementById("teamSubmit").textContent = "Save Changes";
  document.getElementById("cancelTeamEdit").classList.remove("hidden");
}

function resetTeamForm() {
  const form = document.getElementById("teamForm");
  form.reset();
  form.elements.id.value = "";
  document.getElementById("teamSubmit").textContent = "Add Person";
  document.getElementById("cancelTeamEdit").classList.add("hidden");
}

function statusClass(status) {
  return String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function findMeeting(id) {
  return state.meetings.find((meeting) => meeting.id === id);
}

function findPerson(id) {
  return state.team.find((person) => person.id === id);
}

function buildTeamFromAttendance(attendance = []) {
  if (!Array.isArray(attendance)) return [];
  const names = [...new Set(attendance.map((row) => row.name).filter(Boolean))];
  return names.map((name) => ({
    id: crypto.randomUUID(),
    name,
    notes: "",
  }));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

render();
