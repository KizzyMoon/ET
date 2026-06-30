const storageKey = "event-team-hub-v1";

const sampleData = {
  team: [
    {
      id: crypto.randomUUID(),
      name: "Alex Morgan",
      group: "Founders",
      notes: "Main event lead.",
    },
    {
      id: crypto.randomUUID(),
      name: "Jordan Lee",
      group: "Builders",
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
let selectedMeetingId = "";

const views = {
  meetings: {
    title: "Meetings",
    hint: "Create and manage meeting dates, times, and agendas.",
    columns: ["Date", "Time", "Title", "Agenda", ""],
  },
  team: {
    title: "Event Team",
    hint: "Add, edit, remove, and group people who can be selected for attendance.",
    columns: ["Name", "Group", "Notes", ""],
  },
  attendance: {
    title: "Attendance",
    hint: "View attendance grouped by meeting, with each meeting's attendees together.",
    columns: ["Name", "Status", "Arrival", "Notes", ""],
  },
  summary: {
    title: "Attendance Summary",
    hint: "See each person's overall attendance record and repeated no-shows.",
    columns: ["Name", "In Attendance", "Unable", "Didn't Show Up", "Attendance Rate", "Status"],
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
    group: formatGroupName(form.get("group")),
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
  const meetingCard = event.target.closest("[data-open-meeting]");
  if (meetingCard) {
    selectedMeetingId = meetingCard.dataset.openMeeting;
    renderTable();
    return;
  }

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
  document.body.classList.toggle("summary-mode", view === "summary");
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
  renderGroupOptions();
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

function renderGroupOptions() {
  const groups = getGroups();
  document.getElementById("groupOptions").innerHTML = groups.map((group) => `<option value="${escapeHtml(group)}"></option>`).join("");
}

function renderTable() {
  const config = views[activeView];
  document.getElementById("tableTitle").textContent = config.title;
  document.getElementById("tableHint").textContent = config.hint;
  document.getElementById("tableHead").innerHTML =
    activeView === "summary" || activeView === "meetings" ? "" : `<tr>${config.columns.map((column) => `<th>${column}</th>`).join("")}</tr>`;

  const rows = getRows().filter((row) => JSON.stringify(row).toLowerCase().includes(searchTerm));
  const body = document.getElementById("tableBody");
  if (!rows.length) {
    body.innerHTML = document.getElementById("emptyState").innerHTML;
    return;
  }

  if (activeView === "meetings") {
    if (!selectedMeetingId || !state.meetings.some((meeting) => meeting.id === selectedMeetingId)) {
      selectedMeetingId = rows[0]?.id || "";
    }
    body.innerHTML = `<tr><td class="meeting-card-cell" colspan="5">${renderMeetingCards(rows)}</td></tr>`;
    return;
  }

  if (activeView === "team") {
    body.innerHTML = renderGroupedTeamRows(rows);
    return;
  }

  if (activeView === "attendance") {
    body.innerHTML = renderGroupedAttendanceRows(rows);
    return;
  }

  if (activeView === "summary") {
    body.innerHTML = `<tr><td class="summary-card-cell" colspan="6">${renderSummaryCards(rows)}</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row) => renderRow(row)).join("");
}

function getRows() {
  if (activeView === "meetings") {
    return [...state.meetings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }
  if (activeView === "team") {
    return [...state.team].sort((a, b) => {
      const groupCompare = getGroupKey(a).localeCompare(getGroupKey(b));
      return groupCompare || a.name.localeCompare(b.name);
    });
  }
  if (activeView === "summary") {
    return getAttendanceSummary();
  }
  if (activeView === "attendance") {
    return [...state.attendance].sort((a, b) => {
      const meetingCompare = getMeetingSortValue(a.meetingId).localeCompare(getMeetingSortValue(b.meetingId));
      const aName = findPerson(a.personId)?.name || a.name;
      const bName = findPerson(b.personId)?.name || b.name;
      return meetingCompare || aName.localeCompare(bName);
    });
  }
  return state[activeView];
}

function renderRow(row) {
  if (activeView === "meetings") {
    return `<tr>
      <td>${formatDate(row.date)}</td>
      <td>${formatTime(row.time)}</td>
      <td><strong>${escapeHtml(row.title)}</strong></td>
      <td>${escapeHtml(row.agenda)}</td>
      <td>${deleteButton("meetings", row.id)}</td>
    </tr>`;
  }

  if (activeView === "attendance") {
    const person = findPerson(row.personId);
    return `<tr>
      <td><strong>${escapeHtml(person?.name || row.name)}</strong></td>
      <td><span class="badge ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${formatTime(row.arrival)}</td>
      <td>${escapeHtml(row.notes)}</td>
      <td>${deleteButton("attendance", row.id)}</td>
    </tr>`;
  }

  if (activeView === "team") {
    return `<tr>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${escapeHtml(getPersonGroup(row))}</td>
      <td>${escapeHtml(row.notes)}</td>
      <td class="row-actions">${editButton(row.id)}${deleteButton("team", row.id)}</td>
    </tr>`;
  }

  if (activeView === "summary") {
    return `<tr>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${row.inAttendance}</td>
      <td>${row.unable}</td>
      <td>${row.noShow}</td>
      <td>${row.rate}%</td>
      <td><span class="badge ${statusClass(row.flag)}">${escapeHtml(row.flag)}</span></td>
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

function renderMeetingCards(meetings) {
  const selectedMeeting = findMeeting(selectedMeetingId) || meetings[0];
  return `<div class="meeting-browser">
    <div class="meeting-card-grid">${meetings.map(renderMeetingCard).join("")}</div>
    ${selectedMeeting ? renderMeetingDetail(selectedMeeting) : ""}
  </div>`;
}

function renderMeetingCard(meeting) {
  const attendance = state.attendance.filter((row) => row.meetingId === meeting.id);
  const notes = state.notes.filter((note) => note.meetingId === meeting.id);
  const isSelected = meeting.id === selectedMeetingId;
  const attended = attendance.filter((row) => row.status === "In Attendance").length;
  const rate = attendance.length ? Math.round((attended / attendance.length) * 100) : 0;
  return `<button class="meeting-card ${isSelected ? "selected" : ""}" data-open-meeting="${meeting.id}" type="button">
    <span>${formatDate(meeting.date)} ${formatTime(meeting.time)}</span>
    <strong>${escapeHtml(meeting.title)}</strong>
    <small>${attendance.length} attendance records · ${notes.length} notes · ${rate}% attended</small>
  </button>`;
}

function renderMeetingDetail(meeting) {
  const attendance = state.attendance.filter((row) => row.meetingId === meeting.id);
  const notes = state.notes.filter((note) => note.meetingId === meeting.id);
  const attended = attendance.filter((row) => row.status === "In Attendance").length;
  const unable = attendance.filter((row) => row.status === "Unable to Make It").length;
  const noShow = attendance.filter((row) => row.status === "Didn't Show Up").length;
  return `<section class="meeting-detail">
    <div class="meeting-detail-header">
      <div>
        <h3>${escapeHtml(meeting.title)}</h3>
        <p>${formatDate(meeting.date)} ${formatTime(meeting.time)}</p>
      </div>
      <div class="meeting-detail-stats">
        <span>${attended} attended</span>
        <span>${unable} unable</span>
        <span>${noShow} no-show</span>
      </div>
    </div>
    <div class="meeting-detail-grid">
      <section>
        <h4>Attendance</h4>
        ${attendance.length ? attendance.map(renderMeetingAttendanceItem).join("") : `<p class="muted">No attendance has been recorded for this meeting yet.</p>`}
      </section>
      <section>
        <h4>Notes</h4>
        ${notes.length ? notes.map(renderMeetingNoteItem).join("") : `<p class="muted">No notes have been saved for this meeting yet.</p>`}
      </section>
    </div>
  </section>`;
}

function renderMeetingAttendanceItem(row) {
  const person = findPerson(row.personId);
  return `<div class="detail-item">
    <strong>${escapeHtml(person?.name || row.name)}</strong>
    <span class="badge ${statusClass(row.status)}">${escapeHtml(row.status)}</span>
    ${row.arrival ? `<small>${formatTime(row.arrival)}</small>` : ""}
    ${row.notes ? `<p>${escapeHtml(row.notes)}</p>` : ""}
  </div>`;
}

function renderMeetingNoteItem(note) {
  return `<div class="detail-item">
    <strong>${escapeHtml(note.note)}</strong>
    ${note.action ? `<p>Action: ${escapeHtml(note.action)}</p>` : ""}
    ${note.owner ? `<small>Owner: ${escapeHtml(note.owner)}</small>` : ""}
    ${note.dueDate ? `<small>Due: ${formatDate(note.dueDate)}</small>` : ""}
  </div>`;
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
  form.elements.group.value = person.group || "";
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

function getMeetingSortValue(meetingId) {
  const meeting = findMeeting(meetingId);
  return `${meeting?.date || "9999-99-99"}${meeting?.time || "99:99"}${meeting?.title || ""}`;
}

function findPerson(id) {
  return state.team.find((person) => person.id === id);
}

function renderGroupedAttendanceRows(rows) {
  let currentMeetingId = "";
  const summaries = getMeetingAttendanceSummaries(rows);

  return rows
    .map((row) => {
      const meetingId = row.meetingId || "deleted";
      const header =
        meetingId !== currentMeetingId
          ? `<tr class="meeting-row"><td colspan="5">${renderMeetingSummary(summaries[meetingId])}</td></tr>`
          : "";
      currentMeetingId = meetingId;
      return `${header}${renderRow(row)}`;
    })
    .join("");
}

function getMeetingAttendanceSummaries(rows) {
  return rows.reduce((summaries, row) => {
    const meetingId = row.meetingId || "deleted";
    const meeting = findMeeting(row.meetingId);
    const summary = summaries[meetingId] || {
      title: meeting?.title || "Deleted meeting",
      date: meeting?.date || "",
      time: meeting?.time || "",
      total: 0,
      inAttendance: 0,
      unable: 0,
      noShow: 0,
    };

    summary.total += 1;
    if (row.status === "In Attendance") summary.inAttendance += 1;
    if (row.status === "Unable to Make It") summary.unable += 1;
    if (row.status === "Didn't Show Up") summary.noShow += 1;
    summaries[meetingId] = summary;
    return summaries;
  }, {});
}

function renderMeetingSummary(summary) {
  const rate = summary.total ? Math.round((summary.inAttendance / summary.total) * 100) : 0;
  const when = [formatDate(summary.date), formatTime(summary.time)].filter(Boolean).join(" ");
  return `<div class="meeting-summary">
    <strong>${escapeHtml(summary.title)}</strong>
    <span>${escapeHtml(when)}</span>
    <span>${summary.total} recorded</span>
    <span>${rate}% attended</span>
    <span>${summary.noShow} no-show</span>
  </div>`;
}

function renderGroupedTeamRows(rows) {
  let currentGroupKey = "";
  const counts = rows.reduce((totals, row) => {
    const group = getPersonGroup(row);
    totals[group] = (totals[group] || 0) + 1;
    return totals;
  }, {});

  return rows
    .map((row) => {
      const group = getPersonGroup(row);
      const groupKey = getGroupKey(row);
      const header =
        groupKey !== currentGroupKey
          ? `<tr class="group-row"><td colspan="4">${escapeHtml(group)} <span>${counts[group]}</span></td></tr>`
          : "";
      currentGroupKey = groupKey;
      return `${header}${renderRow(row)}`;
    })
    .join("");
}

function getPersonGroup(person) {
  return formatGroupName(person.group) || "Ungrouped";
}

function getGroupKey(person) {
  return getPersonGroup(person).toLowerCase();
}

function getGroups() {
  return [...new Set(state.team.map(getPersonGroup).filter((group) => group !== "Ungrouped"))].sort((a, b) => a.localeCompare(b));
}

function formatGroupName(value = "") {
  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAttendanceSummary() {
  const summary = new Map();

  state.team.forEach((person) => {
    summary.set(person.id, {
      name: person.name,
      total: 0,
      inAttendance: 0,
      unable: 0,
      noShow: 0,
    });
  });

  state.attendance.forEach((row) => {
    const key = row.personId || row.name;
    if (!summary.has(key)) {
      summary.set(key, {
        name: row.name || "Unknown",
        total: 0,
        inAttendance: 0,
        unable: 0,
        noShow: 0,
      });
    }

    const person = summary.get(key);
    person.total += 1;
    if (row.status === "In Attendance") person.inAttendance += 1;
    if (row.status === "Unable to Make It") person.unable += 1;
    if (row.status === "Didn't Show Up") person.noShow += 1;
  });

  return [...summary.values()]
    .map((person) => {
      const rate = person.total ? Math.round((person.inAttendance / person.total) * 100) : 0;
      let flag = "Good";
      if (person.noShow >= 2) flag = "Needs Follow-up";
      else if (person.noShow === 1) flag = "Watch";
      return { ...person, rate, flag };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderSummaryCards(rows) {
  return `<div class="summary-card-grid">${rows.map(renderSummaryCard).join("")}</div>`;
}

function renderSummaryCard(person) {
  return `<article class="summary-card">
    <div class="summary-card-header">
      <h3>${escapeHtml(person.name)}</h3>
      <span class="badge ${statusClass(person.flag)}">${escapeHtml(person.flag)}</span>
    </div>
    <div class="summary-rate">${person.rate}%</div>
    <p>Attendance Rate</p>
    <dl>
      <div><dt>In Attendance</dt><dd>${person.inAttendance}</dd></div>
      <div><dt>Unable</dt><dd>${person.unable}</dd></div>
      <div><dt>Didn't Show Up</dt><dd>${person.noShow}</dd></div>
    </dl>
  </article>`;
}

function buildTeamFromAttendance(attendance = []) {
  if (!Array.isArray(attendance)) return [];
  const names = [...new Set(attendance.map((row) => row.name).filter(Boolean))];
  return names.map((name) => ({
    id: crypto.randomUUID(),
    name,
    group: "",
    notes: "",
  }));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!value) return "";
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return escapeHtml(value);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteText.padStart(2, "0")} ${period}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

render();
