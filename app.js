/* Angel Collab Workshop — skeleton v1 (data safety + readable editor + full frame) */

const LS_KEYS = {
  tools: "acw_tools_v1",
  themes: "acw_themes_v1",
  vault: "acw_vault_v1",
  ui: "acw_ui_v1",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uid(prefix="id"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch(e){
    console.warn("loadJSON failed:", key, e);
    return fallback;
  }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeTags(input){
  const s = (input || "").trim();
  if(!s) return [];
  // allow: "#a #b" or "a b"
  return s
    .replace(/#/g, " ")
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => `#${t.replace(/^#/, "")}`);
}
function tagsToText(tags){
  return (tags || []).join(" ");
}

function nowISO(){
  return new Date().toISOString();
}

function downloadJSON(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyText(text){
  if(!text) text = "";
  if(navigator.clipboard?.writeText){
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  }
  return legacyCopy(text);
}
function legacyCopy(text){
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{ document.execCommand("copy"); }catch(e){}
  ta.remove();
  return Promise.resolve();
}

/* ---------- State ---------- */

let state = {
  tools: loadJSON(LS_KEYS.tools, []),
  themes: loadJSON(LS_KEYS.themes, []),
  vault: loadJSON(LS_KEYS.vault, []),
  ui: loadJSON(LS_KEYS.ui, { activeTab: "tools" }),
};

/* ---------- Tabs ---------- */

function setActiveTab(tab){
  state.ui.activeTab = tab;
  saveJSON(LS_KEYS.ui, state.ui);

  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".panel").forEach(p => p.classList.remove("active"));

  const panelId = `#panel-${tab}`;
  const panel = $(panelId);
  if(panel) panel.classList.add("active");

  // render on switch for safety
  renderAll();
}

$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
});

/* ---------- Render ---------- */

function renderAll(){
  renderTools();
  renderThemes();
  renderVault();
}

function toolMatches(t, q){
  if(!q) return true;
  const hay = [
    t.name, t.one, t.content,
    (t.tags||[]).join(" "),
    t.status
  ].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

function renderTools(){
  const list = $("#toolsList");
  const empty = $("#toolsEmpty");
  const q = ($("#toolsSearch").value || "").trim();

  const filtered = state.tools.filter(t => toolMatches(t, q));
  $("#toolsCount").textContent = String(filtered.length);

  list.innerHTML = "";
  if(filtered.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  filtered
    .sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""))
    .forEach(t => {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="meta">
          <strong>${escapeHTML(t.name || "（未命名工具）")}</strong>
          <div class="one">${escapeHTML(t.one || "")}</div>
          <div class="tags">
            <span>${escapeHTML((t.status==="ready") ? "可用" : "草稿")}</span>
            <span> · </span>
            <span>${escapeHTML(tagsToText(t.tags||[]))}</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost" data-act="edit">編輯</button>
          <button class="btn ghost" data-act="copy">複製卡片內容</button>
          <button class="btn ghost" data-act="duplicate">複製成新工具</button>
          <button class="btn danger" data-act="delete">刪除</button>
        </div>
      `;
      el.querySelector('[data-act="edit"]').addEventListener("click", ()=> openToolModal(t.id));
      el.querySelector('[data-act="copy"]').addEventListener("click", ()=> copyToolCard(t));
      el.querySelector('[data-act="duplicate"]').addEventListener("click", ()=> duplicateTool(t.id));
      el.querySelector('[data-act="delete"]').addEventListener("click", ()=> deleteTool(t.id));
      list.appendChild(el);
    });
}

function themeMatches(th, q){
  if(!q) return true;
  const hay = [
    th.title, th.desc,
    (th.tags||[]).join(" "),
    (th.toolIds||[]).join(" "),
  ].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

function renderThemes(){
  const list = $("#themesList");
  const empty = $("#themesEmpty");
  const q = ($("#themesSearch").value || "").trim();

  const filtered = state.themes.filter(th => themeMatches(th, q));
  $("#themesCount").textContent = String(filtered.length);

  list.innerHTML = "";
  if(filtered.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  filtered
    .sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""))
    .forEach(th => {
      const toolNames = (th.toolIds||[])
        .map(id => state.tools.find(t=>t.id===id)?.name || "（已刪除工具）");

      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="meta">
          <strong>${escapeHTML(th.title || "（未命名主題）")}</strong>
          <div class="one">${escapeHTML(th.desc || "")}</div>
          <div class="tags">
            <span>${escapeHTML(tagsToText(th.tags||[]))}</span>
          </div>
          <div class="one small">${escapeHTML(toolNames.join(" → "))}</div>
        </div>
        <div class="actions">
          <button class="btn ghost" data-act="edit">編輯</button>
          <button class="btn ghost" data-act="copy">複製組合內容</button>
          <button class="btn danger" data-act="delete">刪除</button>
        </div>
      `;
      el.querySelector('[data-act="edit"]').addEventListener("click", ()=> openThemeModal(th.id));
      el.querySelector('[data-act="copy"]').addEventListener("click", ()=> copyThemeCard(th));
      el.querySelector('[data-act="delete"]').addEventListener("click", ()=> deleteTheme(th.id));
      list.appendChild(el);
    });
}

function renderVault(){
  const list = $("#vaultList");
  const empty = $("#vaultEmpty");

  $("#vaultCount").textContent = String(state.vault.length);

  list.innerHTML = "";
  if(state.vault.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  state.vault
    .slice()
    .sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""))
    .forEach(v => {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="meta">
          <strong>${escapeHTML(v.title || "（未命名連結）")}</strong>
          <div class="one small">${escapeHTML(v.url || "")}</div>
          <div class="tags small">${escapeHTML(v.note || "")}</div>
        </div>
        <div class="actions">
          <a class="btn ghost" href="${escapeAttr(v.url||"#")}" target="_blank" rel="noreferrer">開啟</a>
          <button class="btn ghost" data-act="edit">編輯</button>
          <button class="btn danger" data-act="delete">刪除</button>
        </div>
      `;
      el.querySelector('[data-act="edit"]').addEventListener("click", ()=> openVaultModal(v.id));
      el.querySelector('[data-act="delete"]').addEventListener("click", ()=> deleteVault(v.id));
      list.appendChild(el);
    });
}

/* ---------- Tools CRUD ---------- */

function persistTools(){
  saveJSON(LS_KEYS.tools, state.tools);
}

function upsertTool(tool){
  const idx = state.tools.findIndex(t=>t.id===tool.id);
  if(idx >= 0) state.tools[idx] = tool;
  else state.tools.unshift(tool);
  persistTools();
  renderAll();
}

function deleteTool(id){
  const t = state.tools.find(x=>x.id===id);
  if(!t) return;
  if(!confirm(`確定刪除工具：「${t.name||"未命名"}」？`)) return;

  state.tools = state.tools.filter(x=>x.id!==id);
  // also remove from themes flows
  state.themes = state.themes.map(th => ({
    ...th,
    toolIds: (th.toolIds||[]).filter(tid => tid !== id),
    updatedAt: nowISO()
  }));
  persistTools();
  saveJSON(LS_KEYS.themes, state.themes);
  renderAll();
}

function duplicateTool(id){
  const src = state.tools.find(x=>x.id===id);
  if(!src) return;
  const copy = {
    ...src,
    id: uid("tool"),
    name: `${src.name || "工具"}（複製）`,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  state.tools.unshift(copy);
  persistTools();
  renderAll();
}

function copyToolCard(t){
  const text = [
    `【工具名稱】${t.name||""}`,
    `【一句話用途】${t.one||""}`,
    `【陪語/內容】`,
    `${t.content||""}`,
    `【標籤】${tagsToText(t.tags||[])}`,
    `【狀態】${t.status==="ready"?"可用":"草稿"}`,
    t.aiPrompt ? `【AI協作提示】${t.aiPrompt}` : ""
  ].filter(Boolean).join("\n");
  copyText(text).then(()=> alert("已複製（可貼到備忘錄/Notion/訊息）"));
}

/* ---------- Themes CRUD ---------- */

function persistThemes(){
  saveJSON(LS_KEYS.themes, state.themes);
}

function upsertTheme(th){
  const idx = state.themes.findIndex(x=>x.id===th.id);
  if(idx >= 0) state.themes[idx] = th;
  else state.themes.unshift(th);
  persistThemes();
  renderAll();
}

function deleteTheme(id){
  const th = state.themes.find(x=>x.id===id);
  if(!th) return;
  if(!confirm(`確定刪除主題：「${th.title||"未命名"}」？`)) return;
  state.themes = state.themes.filter(x=>x.id!==id);
  persistThemes();
  renderAll();
}

function copyThemeCard(th){
  const toolLines = (th.toolIds||[]).map((id, i) => {
    const t = state.tools.find(x=>x.id===id);
    if(!t) return `${i+1}. （已刪除工具）`;
    return `${i+1}. ${t.name || ""}｜${t.one || ""}`;
  });

  const text = [
    `【主題】${th.title||""}`,
    `【描述】${th.desc||""}`,
    `【流程】`,
    toolLines.join("\n"),
    `【標籤】${tagsToText(th.tags||[])}`,
    th.aiPrompt ? `【AI協作提示】${th.aiPrompt}` : ""
  ].filter(Boolean).join("\n");

  copyText(text).then(()=> alert("已複製（可貼給 AI 或做課程講義）"));
}

/* ---------- Vault CRUD ---------- */

function persistVault(){
  saveJSON(LS_KEYS.vault, state.vault);
}

function upsertVault(v){
  const idx = state.vault.findIndex(x=>x.id===v.id);
  if(idx >= 0) state.vault[idx] = v;
  else state.vault.unshift(v);
  persistVault();
  renderAll();
}

function deleteVault(id){
  const v = state.vault.find(x=>x.id===id);
  if(!v) return;
  if(!confirm(`確定刪除連結：「${v.title||"未命名"}」？`)) return;
  state.vault = state.vault.filter(x=>x.id!==id);
  persistVault();
  renderAll();
}

/* ---------- Export / Import ---------- */

function exportAll(){
  const payload = {
    schema: "acw_backup_v1",
    exportedAt: nowISO(),
    data: {
      tools: state.tools,
      themes: state.themes,
      vault: state.vault,
      ui: state.ui,
    }
  };
  const filename = `acw-backup-${new Date().toISOString().slice(0,10)}.json`;
  downloadJSON(filename, payload);
}

async function importAllFromFile(file){
  const text = await file.text();
  let payload;
  try{
    payload = JSON.parse(text);
  }catch(e){
    alert("匯入失敗：不是合法 JSON 檔");
    return;
  }
  if(!payload?.data){
    alert("匯入失敗：檔案格式不符");
    return;
  }

  const mode = prompt("匯入模式：輸入 1 覆蓋全部 / 輸入 2 合併（保留本機，再加進來）", "2");
  if(mode !== "1" && mode !== "2") return;

  const incoming = payload.data;

  if(mode === "1"){
    state.tools = Array.isArray(incoming.tools) ? incoming.tools : [];
    state.themes = Array.isArray(incoming.themes) ? incoming.themes : [];
    state.vault = Array.isArray(incoming.vault) ? incoming.vault : [];
    state.ui = incoming.ui || state.ui;
  }else{
    // merge by id (incoming wins if same id)
    state.tools = mergeById(state.tools, incoming.tools);
    state.themes = mergeById(state.themes, incoming.themes);
    state.vault = mergeById(state.vault, incoming.vault);
    state.ui = {...state.ui, ...(incoming.ui||{})};
  }

  saveJSON(LS_KEYS.tools, state.tools);
  saveJSON(LS_KEYS.themes, state.themes);
  saveJSON(LS_KEYS.vault, state.vault);
  saveJSON(LS_KEYS.ui, state.ui);

  alert("匯入完成！");
  renderAll();
}

function mergeById(currentArr, incomingArr){
  const cur = Array.isArray(currentArr) ? currentArr : [];
  const inc = Array.isArray(incomingArr) ? incomingArr : [];
  const map = new Map(cur.map(x => [x.id, x]));
  inc.forEach(x => {
    if(x && x.id) map.set(x.id, x);
  });
  return Array.from(map.values()).sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""));
}

/* ---------- Modals: Tool ---------- */

const toolModal = $("#toolModal");
const tool_id = $("#tool_id");
const tool_name = $("#tool_name");
const tool_one = $("#tool_one");
const tool_content = $("#tool_content");
const tool_tags = $("#tool_tags");
const tool_status = $("#tool_status");
const tool_ai = $("#tool_ai");
const toolDeleteBtn = $("#toolDelete");
const toolCopyBtn = $("#toolCopy");
const toolSaveBtn = $("#toolSave");
const toolModalTitle = $("#toolModalTitle");

let editingToolId = null;

function openToolModal(id=null){
  editingToolId = id;
  const isNew = !id;
  toolModalTitle.textContent = isNew ? "新增工具" : "編輯工具";

  if(isNew){
    tool_id.value = uid("tool");
    tool_name.value = "";
    tool_one.value = "";
    tool_content.value = "";
    tool_tags.value = "";
    tool_status.value = "draft";
    tool_ai.value = "";
    toolDeleteBtn.style.display = "none";
  }else{
    const t = state.tools.find(x=>x.id===id);
    if(!t) return;
    tool_id.value = t.id;
    tool_name.value = t.name || "";
    tool_one.value = t.one || "";
    tool_content.value = t.content || "";
    tool_tags.value = tagsToText(t.tags||[]);
    tool_status.value = t.status || "draft";
    tool_ai.value = t.aiPrompt || "";
    toolDeleteBtn.style.display = "inline-flex";
  }

  toolModal.showModal();
}

$("#btnAddTool").addEventListener("click", ()=> openToolModal(null));

toolSaveBtn.addEventListener("click", ()=>{
  const id = tool_id.value || uid("tool");
  const existing = state.tools.find(x=>x.id===id);

  const t = {
    id,
    name: (tool_name.value||"").trim(),
    one: (tool_one.value||"").trim(),
    content: (tool_content.value||"").trim(),
    tags: normalizeTags(tool_tags.value),
    status: tool_status.value || "draft",
    aiPrompt: (tool_ai.value||"").trim(),
    createdAt: existing?.createdAt || nowISO(),
    updatedAt: nowISO(),
  };

  upsertTool(t);
  toolModal.close();
});

toolDeleteBtn.addEventListener("click", ()=>{
  const id = tool_id.value;
  toolModal.close();
  deleteTool(id);
});

toolCopyBtn.addEventListener("click", ()=>{
  const id = tool_id.value;
  const t = state.tools.find(x=>x.id===id);
  if(!t) return;
  copyToolCard(t);
});

/* ---------- Modals: Theme ---------- */

const themeModal = $("#themeModal");
const theme_id = $("#theme_id");
const theme_title = $("#theme_title");
const theme_desc = $("#theme_desc");
const theme_tags = $("#theme_tags");
const theme_ai = $("#theme_ai");
const themeDeleteBtn = $("#themeDelete");
const themeCopyBtn = $("#themeCopy");
const themeSaveBtn = $("#themeSave");
const themeModalTitle = $("#themeModalTitle");

const pickToolsList = $("#pickToolsList");
const pickToolsEmpty = $("#pickToolsEmpty");
const themeFlowList = $("#themeFlowList");
const themeFlowEmpty = $("#themeFlowEmpty");

let themeFlow = [];
let editingThemeId = null;

function openThemeModal(id=null){
  editingThemeId = id;
  const isNew = !id;
  themeModalTitle.textContent = isNew ? "新增主題" : "編輯主題";

  if(isNew){
    theme_id.value = uid("theme");
    theme_title.value = "";
    theme_desc.value = "";
    theme_tags.value = "";
    theme_ai.value = "";
    themeFlow = [];
    themeDeleteBtn.style.display = "none";
  }else{
    const th = state.themes.find(x=>x.id===id);
    if(!th) return;
    theme_id.value = th.id;
    theme_title.value = th.title || "";
    theme_desc.value = th.desc || "";
    theme_tags.value = tagsToText(th.tags||[]);
    theme_ai.value = th.aiPrompt || "";
    themeFlow = Array.isArray(th.toolIds) ? [...th.toolIds] : [];
    themeDeleteBtn.style.display = "inline-flex";
  }

  renderThemePicker();
  renderThemeFlow();
  themeModal.showModal();
}

$("#btnAddTheme").addEventListener("click", ()=> openThemeModal(null));

function renderThemePicker(){
  pickToolsList.innerHTML = "";
  if(state.tools.length === 0){
    pickToolsEmpty.style.display = "block";
    return;
  }
  pickToolsEmpty.style.display = "none";

  state.tools
    .slice()
    .sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""))
    .forEach(t=>{
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="meta">
          <strong>${escapeHTML(t.name || "（未命名工具）")}</strong>
          <div class="one">${escapeHTML(t.one || "")}</div>
        </div>
        <div class="actions">
          <button class="btn ghost" type="button">加入 →</button>
        </div>
      `;
      el.querySelector("button").addEventListener("click", ()=>{
        themeFlow.push(t.id);
        renderThemeFlow();
      });
      pickToolsList.appendChild(el);
    });
}

function renderThemeFlow(){
  themeFlowList.innerHTML = "";
  if(themeFlow.length === 0){
    themeFlowEmpty.style.display = "block";
    return;
  }
  themeFlowEmpty.style.display = "none";

  themeFlow.forEach((id, idx)=>{
    const t = state.tools.find(x=>x.id===id);
    const el = document.createElement("div");
    el.className = "item";
    el.setAttribute("draggable", "true");
    el.dataset.idx = String(idx);
    el.innerHTML = `
      <div class="meta">
        <strong>${escapeHTML(`${idx+1}. ${(t?.name)||"（已刪除工具）"}`)}</strong>
        <div class="one small">${escapeHTML(t?.one || "")}</div>
      </div>
      <div class="actions">
        <button class="btn ghost" type="button" data-act="up">上移</button>
        <button class="btn ghost" type="button" data-act="down">下移</button>
        <button class="btn danger" type="button" data-act="remove">移除</button>
      </div>
    `;

    el.querySelector('[data-act="up"]').addEventListener("click", ()=>{
      if(idx<=0) return;
      swap(themeFlow, idx, idx-1);
      renderThemeFlow();
    });
    el.querySelector('[data-act="down"]').addEventListener("click", ()=>{
      if(idx>=themeFlow.length-1) return;
      swap(themeFlow, idx, idx+1);
      renderThemeFlow();
    });
    el.querySelector('[data-act="remove"]').addEventListener("click", ()=>{
      themeFlow.splice(idx,1);
      renderThemeFlow();
    });

    // drag reorder (simple)
    el.addEventListener("dragstart", (e)=>{
      e.dataTransfer.setData("text/plain", String(idx));
    });
    el.addEventListener("dragover", (e)=> e.preventDefault());
    el.addEventListener("drop", (e)=>{
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      const to = idx;
      if(Number.isNaN(from) || from===to) return;
      const moved = themeFlow.splice(from,1)[0];
      themeFlow.splice(to,0,moved);
      renderThemeFlow();
    });

    themeFlowList.appendChild(el);
  });
}

function swap(arr, i, j){
  const tmp = arr[i];
  arr[i]=arr[j];
  arr[j]=tmp;
}

themeSaveBtn.addEventListener("click", ()=>{
  const id = theme_id.value || uid("theme");
  const existing = state.themes.find(x=>x.id===id);

  const th = {
    id,
    title: (theme_title.value||"").trim(),
    desc: (theme_desc.value||"").trim(),
    toolIds: themeFlow.filter(Boolean),
    tags: normalizeTags(theme_tags.value),
    aiPrompt: (theme_ai.value||"").trim(),
    createdAt: existing?.createdAt || nowISO(),
    updatedAt: nowISO(),
  };

  upsertTheme(th);
  themeModal.close();
});

themeDeleteBtn.addEventListener("click", ()=>{
  const id = theme_id.value;
  themeModal.close();
  deleteTheme(id);
});

themeCopyBtn.addEventListener("click", ()=>{
  const id = theme_id.value;
  const th = state.themes.find(x=>x.id===id);
  if(!th) return;
  copyThemeCard(th);
});

/* ---------- Modals: Vault ---------- */

const vaultModal = $("#vaultModal");
const vault_id = $("#vault_id");
const vault_title = $("#vault_title");
const vault_url = $("#vault_url");
const vault_note = $("#vault_note");
const vaultDeleteBtn = $("#vaultDelete");
const vaultSaveBtn = $("#vaultSave");

function openVaultModal(id=null){
  const isNew = !id;
  $("#vaultModalTitle").textContent = isNew ? "新增成品連結" : "編輯成品連結";

  if(isNew){
    vault_id.value = uid("vault");
    vault_title.value = "";
    vault_url.value = "";
    vault_note.value = "";
    vaultDeleteBtn.style.display = "none";
  }else{
    const v = state.vault.find(x=>x.id===id);
    if(!v) return;
    vault_id.value = v.id;
    vault_title.value = v.title || "";
    vault_url.value = v.url || "";
    vault_note.value = v.note || "";
    vaultDeleteBtn.style.display = "inline-flex";
  }

  vaultModal.showModal();
}

$("#btnAddVault").addEventListener("click", ()=> openVaultModal(null));

vaultSaveBtn.addEventListener("click", ()=>{
  const id = vault_id.value || uid("vault");
  const existing = state.vault.find(x=>x.id===id);

  const v = {
    id,
    title: (vault_title.value||"").trim(),
    url: (vault_url.value||"").trim(),
    note: (vault_note.value||"").trim(),
    createdAt: existing?.createdAt || nowISO(),
    updatedAt: nowISO(),
  };

  upsertVault(v);
  vaultModal.close();
});

vaultDeleteBtn.addEventListener("click", ()=>{
  const id = vault_id.value;
  vaultModal.close();
  deleteVault(id);
});

/* ---------- Seed buttons ---------- */

$("#btnSeedTool").addEventListener("click", ()=>{
  const demo = {
    id: uid("tool"),
    name: "暫停｜0.5 秒斷點",
    one: "在自動化反應全速運轉前，切回系統管理員模式。",
    content:
`✨ 此刻我感受到的是：
＿＿＿＿＿＿＿＿＿＿＿＿

✨ 我願意先暫停 30～90 秒，
讓身體先回來。`,
    tags: ["#暫停","#斷點","#情緒急救","#自動化反應"],
    status: "ready",
    aiPrompt: "",
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  state.tools.unshift(demo);
  persistTools();
  renderAll();
});

$("#btnSeedVault").addEventListener("click", ()=>{
  const demo = {
    id: uid("vault"),
    title: "示範｜90秒呼吸（獨立PWA）",
    url: "https://example.com/",
    note: "把你未來做出的獨立PWA網址放這裡，日後一鍵取用。",
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  state.vault.unshift(demo);
  persistVault();
  renderAll();
});

/* ---------- Search inputs ---------- */
$("#toolsSearch").addEventListener("input", renderTools);
$("#themesSearch").addEventListener("input", renderThemes);

/* ---------- Export/Import buttons ---------- */
$("#btnExport").addEventListener("click", exportAll);

const importFile = $("#importFile");
$("#btnImport").addEventListener("click", ()=>{
  importFile.value = "";
  importFile.click();
});
importFile.addEventListener("change", ()=>{
  const f = importFile.files?.[0];
  if(!f) return;
  importAllFromFile(f);
});

/* ---------- Initial tab ---------- */
(function init(){
  const tab = state.ui?.activeTab || "tools";
  setActiveTab(tab);
  renderAll();
})();

/* ---------- Helpers ---------- */
function escapeHTML(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function escapeAttr(s){
  return escapeHTML(s).replaceAll("\n"," ").trim();
}
// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}