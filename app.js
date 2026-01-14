/* Angel Collab Workshop - Tool Cards + Tool Detail (autosave) */

const LS_KEY = "angel_workshop_tools_v2";
const $ = (id) => document.getElementById(id);

const viewList = $("viewList");
const viewDetail = $("viewDetail");

const cardList = $("cardList");
const emptyState = $("emptyState");

const btnAdd = $("btnAdd");
const btnAddFromEmpty = $("btnAddFromEmpty");
const toolModal = $("toolModal");

const inpId = $("inpId");
const inpName = $("inpName");
const inpPurpose = $("inpPurpose");
const inpLink = $("inpLink");
const modalTitle = $("modalTitle");

const btnBack = $("btnBack");
const btnDelete = $("btnDelete");
const btnEdit = $("btnEdit");
const btnCopyPrompt = $("btnCopyPrompt");

const detailTitle = $("detailTitle");
const detailPurpose = $("detailPurpose");
const detailNote = $("detailNote");
const detailUpdated = $("detailUpdated");
const mantraBox = $("mantraBox");

const toastEl = $("toast");

// Install prompt
const btnInstall = $("btnInstall");
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});
btnInstall?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.hidden = true;
});

function nowISO() {
  return new Date().toISOString();
}
function formatTime(iso) {
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}
function toast(msg="已完成") {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(()=> toastEl.classList.remove("show"), 1200);
}

function loadTools() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveTools(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function makePromptForTool(t) {
  // Keep it minimal & brand-toned
  return `你是「天使笑長」的協作夥伴。
品牌語感：把心站穩、活得自在；不說教、溫柔而篤定；要有畫面感；要可落地。

【工具名稱】${t.name}
【一句用途】${t.purpose || "（可補一句）"}

我希望你幫我：
1) 再給我 3 個「同氣質」的一句用途（短、安靜）
2) 給我 1 個「不破壞狀態」的 60 秒小動作（可選做）
3) 給我 1 個「可選輸入」提示句（不要求寫）
輸出：短段落 + 條列。`;
}

function isInspirationKeeper(t) {
  const name = (t?.name || "").toLowerCase();
  return name.includes("inspiration keeper") || (t?.name || "").includes("靈感守門人");
}

function renderList() {
  const list = loadTools();

  cardList.innerHTML = "";
  if (!list.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const t of list) {
    const div = document.createElement("div");
    div.className = "card";
    div.dataset.id = t.id;

    const title = document.createElement("div");
    title.className = "cardTitle";
    title.textContent = t.name;

    const purpose = document.createElement("div");
    purpose.className = "cardPurpose";
    purpose.textContent = t.purpose || "（尚未填一句用途）";

    div.appendChild(title);
    div.appendChild(purpose);

    if (t.link) {
      const link = document.createElement("div");
      link.className = "cardLink";
      link.textContent = t.link;
      div.appendChild(link);
    }

    div.addEventListener("click", () => openDetail(t.id));
    cardList.appendChild(div);
  }
}

let currentToolId = null;
let noteSaveTimer = null;

function openDetail(id) {
  const list = loadTools();
  const t = list.find(x => x.id === id);
  if (!t) return;

  currentToolId = id;

  detailTitle.textContent = t.name;
  detailPurpose.textContent = t.purpose || "（尚未填一句用途）";
  detailNote.value = t.note || "";
  detailUpdated.textContent = `更新：${formatTime(t.updatedAt || t.createdAt || nowISO())}`;

  mantraBox.hidden = !isInspirationKeeper(t);

  viewList.hidden = true;
  viewDetail.hidden = false;

  // focus without forcing
  setTimeout(() => detailNote.focus({ preventScroll: true }), 0);
}

function closeDetail() {
  currentToolId = null;
  viewDetail.hidden = true;
  viewList.hidden = false;
}

function openModalForCreate() {
  inpId.value = "";
  inpName.value = "";
  inpPurpose.value = "";
  inpLink.value = "";
  modalTitle.textContent = "新增工具";
  toolModal.showModal();
}
function openModalForEdit(id) {
  const list = loadTools();
  const t = list.find(x => x.id === id);
  if (!t) return;

  inpId.value = t.id;
  inpName.value = t.name || "";
  inpPurpose.value = t.purpose || "";
  inpLink.value = t.link || "";
  modalTitle.textContent = "編輯工具卡片";
  toolModal.showModal();
}

function upsertToolFromModal() {
  const id = inpId.value.trim();
  const name = inpName.value.trim();
  const purpose = inpPurpose.value.trim();
  const link = inpLink.value.trim();

  if (!name) return;

  const list = loadTools();

  if (!id) {
    // create
    const t = {
      id: uid(),
      name,
      purpose,
      link,
      note: "",
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    list.unshift(t);
  } else {
    // update
    const t = list.find(x => x.id === id);
    if (t) {
      t.name = name;
      t.purpose = purpose;
      t.link = link;
      t.updatedAt = nowISO();
    }
  }

  saveTools(list);
  renderList();
  toast("已儲存");
}

function deleteCurrentTool() {
  if (!currentToolId) return;
  const ok = confirm("確定刪除這個工具？（本機）");
  if (!ok) return;

  const list = loadTools().filter(x => x.id !== currentToolId);
  saveTools(list);
  toast("已刪除");
  closeDetail();
  renderList();
}

function scheduleAutosaveNote() {
  if (!currentToolId) return;
  if (noteSaveTimer) clearTimeout(noteSaveTimer);

  noteSaveTimer = setTimeout(() => {
    const list = loadTools();
    const t = list.find(x => x.id === currentToolId);
    if (!t) return;

    t.note = detailNote.value;
    t.updatedAt = nowISO();
    saveTools(list);

    detailUpdated.textContent = `更新：${formatTime(t.updatedAt)}`;
    // silent save (no noisy toast)
  }, 250);
}

// Events
btnAdd.addEventListener("click", openModalForCreate);
btnAddFromEmpty?.addEventListener("click", openModalForCreate);

$("toolForm").addEventListener("submit", (e) => {
  // dialog submit
  // only save when user pressed OK button
  const submitter = e.submitter;
  if (submitter && submitter.id === "btnSaveTool") {
    e.preventDefault();
    upsertToolFromModal();
    toolModal.close();
  }
});

btnBack.addEventListener("click", () => {
  closeDetail();
  renderList();
});

btnDelete.addEventListener("click", deleteCurrentTool);

btnEdit.addEventListener("click", () => {
  if (!currentToolId) return;
  openModalForEdit(currentToolId);
});

btnCopyPrompt.addEventListener("click", async () => {
  if (!currentToolId) return;
  const list = loadTools();
  const t = list.find(x => x.id === currentToolId);
  if (!t) return;

  const prompt = makePromptForTool(t);
  await copyText(prompt);
  toast("已複製咒語");
});

detailNote.addEventListener("input", scheduleAutosaveNote);

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// Seed: if user has already created Inspiration Keeper, do nothing.
// If no tools, we can optionally create a preset? (keep quiet: OFF by default)
function boot() {
  renderList();

  // register SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

boot();