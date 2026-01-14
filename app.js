(function () {
  const LS_KEY = "acw_tools_v1";
  const LS_NOTES = "acw_notes_v1";

  const $ = (id) => document.getElementById(id);

  const toolList = $("toolList");
  const emptyState = $("emptyState");

  const dlg = $("dlgAddTool");
  const btnAddTool = $("btnAddTool");
  const btnReset = $("btnReset");
  const btnSaveNotes = $("btnSaveNotes");
  const notesStatus = $("notesStatus");

  const toolName = $("toolName");
  const toolDesc = $("toolDesc");
  const toolLink = $("toolLink");
  const btnCancel = $("btnCancel");

  const workshopNotes = $("workshopNotes");

  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch { return fallback; }
  }

  function loadTools() {
    return safeParse(localStorage.getItem(LS_KEY) || "[]", []);
  }

  function saveTools(tools) {
    localStorage.setItem(LS_KEY, JSON.stringify(tools));
  }

  function render() {
    const tools = loadTools();
    toolList.innerHTML = "";

    emptyState.style.display = tools.length ? "none" : "block";

    tools.forEach((t, idx) => {
      const el = document.createElement("div");
      el.className = "tool";

      const title = escapeHtml(t.name || "Untitled");
      const desc = escapeHtml(t.desc || "");
      const link = (t.link || "").trim();

      el.innerHTML = `
        <div class="tool-main">
          <p class="tool-title">${title}</p>
          <p class="tool-desc">${desc}</p>
          ${link ? `<p class="tool-desc"><a class="link" href="${escapeAttr(link)}" target="_blank" rel="noopener">Open link</a></p>` : ""}
        </div>

        <div class="tool-actions">
          <button class="icon-btn" data-act="edit" data-idx="${idx}" type="button" title="Edit">✎</button>
          <button class="icon-btn" data-act="del" data-idx="${idx}" type="button" title="Delete">🗑</button>
        </div>
      `;

      toolList.appendChild(el);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function escapeAttr(str) {
    // minimal for href
    return String(str).replace(/"/g, "&quot;");
  }

  function openDialog() {
    toolName.value = "";
    toolDesc.value = "";
    toolLink.value = "";
    if (typeof dlg.showModal === "function") dlg.showModal();
    else alert("Dialog not supported on this browser. Please use Chrome.");
    toolName.focus();
  }

  function closeDialog() {
    if (dlg.open) dlg.close();
  }

  function addTool(name, desc, link) {
    const tools = loadTools();
    tools.push({
      id: cryptoId(),
      name: (name || "").trim() || "New Tool",
      desc: (desc || "").trim(),
      link: (link || "").trim(),
      createdAt: Date.now()
    });
    saveTools(tools);
    render();
  }

  function updateTool(idx, patch) {
    const tools = loadTools();
    if (!tools[idx]) return;
    tools[idx] = { ...tools[idx], ...patch };
    saveTools(tools);
    render();
  }

  function deleteTool(idx) {
    const tools = loadTools();
    tools.splice(idx, 1);
    saveTools(tools);
    render();
  }

  function cryptoId() {
    // simple id
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  // Events
  btnAddTool.addEventListener("click", openDialog);
  btnCancel.addEventListener("click", closeDialog);

  dlg.addEventListener("submit", (e) => {
    e.preventDefault();
    addTool(toolName.value, toolDesc.value, toolLink.value);
    closeDialog();
  });

  toolList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const idx = Number(btn.dataset.idx);

    if (act === "del") {
      const ok = confirm("Delete this tool?");
      if (ok) deleteTool(idx);
      return;
    }

    if (act === "edit") {
      const tools = loadTools();
      const t = tools[idx];
      if (!t) return;

      const name = prompt("Tool Name:", t.name || "");
      if (name === null) return;

      const desc = prompt("One-line Purpose:", t.desc || "");
      if (desc === null) return;

      const link = prompt("Optional Link (keep empty if none):", t.link || "");
      if (link === null) return;

      updateTool(idx, { name: name.trim(), desc: desc.trim(), link: link.trim() });
    }
  });

  // Notes
  function loadNotes() {
    workshopNotes.value = localStorage.getItem(LS_NOTES) || "";
  }
  function saveNotes() {
    localStorage.setItem(LS_NOTES, workshopNotes.value || "");
    notesStatus.textContent = "Saved.";
    setTimeout(() => (notesStatus.textContent = ""), 1200);
  }

  btnSaveNotes.addEventListener("click", saveNotes);

  // Reset
  btnReset.addEventListener("click", () => {
    const ok = confirm("Reset local tools + notes on this device?");
    if (!ok) return;
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_NOTES);
    loadNotes();
    render();
  });

  // Init
  loadNotes();
  render();
})();
