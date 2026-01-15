/* Angel Collab Workshop - Combo Skeleton (local-first)
   - Tools library
   - Theme combiner (pick + order + tryout)
   - Generate AI prompt (text only)
   - Vault to store published PWA URLs (metadata only)
*/

const LS_KEYS = {
  tools: "acw_tools_v1",
  themes: "acw_themes_v1",
  vault: "acw_vault_v1",
  ui: "acw_ui_v1"
};
// ---- Migration: try to recover tools from old keys (safe, one-time) ----
(function migrateOldKeys(){
  const tryKeys = [
    "tools", "toolLibrary", "workshopTools", "angelTools",
    "acw_tools", "acwTools", "acw_tools_v0", "acw_tools_v0_1"
  ];

  const hasNew = !!localStorage.getItem(LS_KEYS.tools);
  if(hasNew) return;

  for(const k of tryKeys){
    const raw = localStorage.getItem(k);
    if(!raw) continue;
    try{
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length){
        localStorage.setItem(LS_KEYS.tools, JSON.stringify(parsed));
        console.log("[ACW] Migrated tools from", k, "->", LS_KEYS.tools);
        break;
      }
    }catch(e){}
  }
})();
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
    return fallback;
  }
}

function saveJSON(key, data){
  localStorage.setItem(key, JSON.stringify(data));
}

function escapeHTML(s=""){
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function nowISO(){
  return new Date().toISOString();
}

/* ------------------ State ------------------ */
let state = {
  tools: loadJSON(LS_KEYS.tools, []),
  themes: loadJSON(LS_KEYS.themes, []),
  vault: loadJSON(LS_KEYS.vault, []),
  ui: loadJSON(LS_KEYS.ui, {
    activeTab: "tools",
    activeThemeId: null,
    tryoutIndexByTheme: {}
  })
};

function persist(){
  saveJSON(LS_KEYS.tools, state.tools);
  saveJSON(LS_KEYS.themes, state.themes);
  saveJSON(LS_KEYS.vault, state.vault);
  saveJSON(LS_KEYS.ui, state.ui);
}

/* ------------------ Tabs ------------------ */
function setActiveTab(tab){
  state.ui.activeTab = tab;
  persist();

  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".panel").forEach(p => p.classList.remove("active"));
  $(`#panel-${tab}`).classList.add("active");
}

$$(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=> setActiveTab(btn.dataset.tab));
});

/* ------------------ Tools ------------------ */
function toolSummary(t){
  const tags = (t.tags || []).join(", ");
  const one = t.oneLiner ? `• ${t.oneLiner}` : "";
  const tg = tags ? `• #${tags}` : "";
  return [one, tg].filter(Boolean).join(" ");
}

function renderTools(){
  const q = ($("#toolSearch").value || "").trim().toLowerCase();
  const list = $("#toolsList");
  const filtered = state.tools.filter(t=>{
    if(!q) return true;
    const blob = `${t.name} ${t.oneLiner||""} ${(t.tags||[]).join(" ")} ${t.body||""}`.toLowerCase();
    return blob.includes(q);
  });

  $("#toolsCount").textContent = String(filtered.length);

  if(filtered.length === 0){
    list.innerHTML = `<div class="status">目前沒有工具。按右上角「新增工具」，或點「建立示範工具」。</div>`;
    return;
  }

  list.innerHTML = filtered.map(t=>`
    <div class="item" data-id="${t.id}">
      <div class="meta">
        <strong>${escapeHTML(t.name)}</strong>
        <span>${escapeHTML(toolSummary(t) || "（尚未填一句話用途/標籤）")}</span>
      </div>
      <div class="actions">
        <button class="btn ghost" data-act="edit" type="button">編輯</button>
        <button class="btn ghost" data-act="copy" type="button">複製卡片內容</button>
        <button class="btn danger" data-act="del" type="button">刪除</button>
      </div>
    </div>
  `).join("");
}

$("#toolSearch").addEventListener("input", renderTools);

function upsertTool(tool){
  const idx = state.tools.findIndex(t=>t.id===tool.id);
  if(idx>=0) state.tools[idx] = tool;
  else state.tools.unshift(tool);
  persist();
  renderTools();
  renderPickToolsList();
  renderThemesList();
  renderSequence();
  renderTryout();
}

function deleteTool(id){
  // remove from themes sequences too
  state.themes.forEach(th=>{
    th.sequence = (th.sequence || []).filter(tid => tid !== id);
  });
  state.tools = state.tools.filter(t=>t.id!==id);
  persist();
  renderTools();
  renderPickToolsList();
  renderThemesList();
  renderSequence();
  renderTryout();
}

function openToolDialog(mode="add", tool=null){
  const dlg = $("#toolDialog");
  const title = $("#toolDlgTitle");
  const status = $("#toolDlgStatus");
  status.textContent = "";

  const isEdit = mode === "edit";
  title.textContent = isEdit ? "編輯工具" : "新增工具";

  $("#toolName").value = tool?.name || "";
  $("#toolOneLiner").value = tool?.oneLiner || "";
  $("#toolBody").value = tool?.body || "";
  $("#toolTags").value = (tool?.tags || []).join(", ");

  const saveBtn = $("#toolSaveBtn");
  saveBtn.onclick = (e)=>{
    e.preventDefault();

    const name = $("#toolName").value.trim();
    if(!name){
      status.textContent = "請輸入工具名稱。";
      return;
    }
    const oneLiner = $("#toolOneLiner").value.trim();
    const body = $("#toolBody").value.trim();
    const tags = $("#toolTags").value.split(",").map(s=>s.trim()).filter(Boolean);

    const next = {
      id: isEdit ? tool.id : uid("tool"),
      name,
      oneLiner,
      body,
      tags,
      updatedAt: nowISO(),
      createdAt: isEdit ? tool.createdAt : nowISO()
    };

    upsertTool(next);
    dlg.close();
  };

  dlg.showModal();
}

$("#btnAddTool").addEventListener("click", ()=> openToolDialog("add"));

$("#toolsList").addEventListener("click", (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const item = e.target.closest(".item");
  if(!item) return;

  const id = item.dataset.id;
  const tool = state.tools.find(t=>t.id===id);
  if(!tool) return;

  const act = btn.dataset.act;
  if(act === "edit"){
    openToolDialog("edit", tool);
  }else if(act === "del"){
    if(confirm(`要刪除「${tool.name}」嗎？（會同時從所有主題組合中移除）`)){
      deleteTool(id);
    }
  }else if(act === "copy"){
    const text = [
      `【工具】${tool.name}`,
      tool.oneLiner ? `【一句話用途】${tool.oneLiner}` : "",
      tool.tags?.length ? `【標籤】${tool.tags.join(", ")}` : "",
      tool.body ? `【內容】\n${tool.body}` : ""
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(text).then(()=>{
      alert("已複製卡片內容。");
    }).catch(()=>{
      alert("複製失敗：你的瀏覽器可能不允許自動複製。");
    });
  }
});

$("#btnSeedTools").addEventListener("click", ()=>{
  if(state.tools.length > 0 && !confirm("工具庫已有內容，仍要加入示範工具嗎？")) return;

  const demo = [
    {
      id: uid("tool"),
      name: "黃金90秒｜呼吸陪伴",
      oneLiner: "情緒升高時，陪你撐過系統切換的90秒，回到可以選擇的狀態。",
      tags: ["呼吸","情緒","陪伴"],
      body: "不用急。\n現在，只要陪呼吸走過 90 秒就好。\n\n（開始 90 秒）\n\n結束後：\n- 有一點鬆\n- 差不多\n- 還不行（可以再走一回）",
      createdAt: nowISO(),
      updatedAt: nowISO()
    },
    {
      id: uid("tool"),
      name: "快遞拒收｜想像法",
      oneLiner: "被指責時，先把不屬於你的包裹退回原收件地址。",
      tags: ["認知重構","界線","關係"],
      body: "想像：對方的指責是一箱送錯的快遞。\n在心裡對自己說：\n「這是一份送錯的包裹，內容物不屬於我，我選擇退回。」",
      createdAt: nowISO(),
      updatedAt: nowISO()
    },
    {
      id: uid("tool"),
      name: "第三方視角｜把『我』換成『他』",
      oneLiner: "把委屈縮小一點，讓勇氣長出來。",
      tags: ["書寫","抽離","情緒"],
      body: "拿出紙筆，寫下：\n「剛才那個被指責的『他』，發生了什麼事？」\n用第三人稱寫 5 行。\n你會發現：事情變小了，你變大了。",
      createdAt: nowISO(),
      updatedAt: nowISO()
    }
  ];

  demo.forEach(upsertTool);
  alert("已建立示範工具（可刪）。");
});

/* ------------------ Themes ------------------ */
function getActiveTheme(){
  return state.themes.find(t=>t.id === state.ui.activeThemeId) || null;
}

function renderThemesList(){
  const list = $("#themesList");
  $("#themesCount").textContent = String(state.themes.length);

  if(state.themes.length === 0){
    list.innerHTML = `<div class="status">目前沒有主題。按右上角「新增主題」。</div>`;
    return;
  }

  list.innerHTML = state.themes.map(th=>{
    const seqCount = (th.sequence||[]).length;
    return `
      <div class="item" data-id="${th.id}">
        <div class="meta">
          <strong>${escapeHTML(th.name || "（未命名主題）")}</strong>
          <span>${escapeHTML(th.goal || "")} ${seqCount ? `• 已選 ${seqCount} 張卡` : "• 尚未選卡"}</span>
        </div>
        <div class="actions">
          <button class="btn ghost" data-act="open" type="button">開啟</button>
        </div>
      </div>
    `;
  }).join("");
}

$("#themesList").addEventListener("click",(e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const item = e.target.closest(".item");
  if(!item) return;
  if(btn.dataset.act !== "open") return;

  state.ui.activeThemeId = item.dataset.id;
  persist();
  loadThemeIntoEditor();
});

$("#btnAddTheme").addEventListener("click", ()=>{
  const th = {
    id: uid("theme"),
    name: "新主題（請改名）",
    goal: "",
    sequence: [],
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  state.themes.unshift(th);
  state.ui.activeThemeId = th.id;
  persist();

  renderThemesList();
  loadThemeIntoEditor();
  setActiveTab("themes");
});

function loadThemeIntoEditor(){
  const th = getActiveTheme();
  $("#activeThemeBadge").textContent = th ? "已選主題" : "未選主題";
  $("#themeEmpty").classList.toggle("hidden", !!th);
  $("#themeEditor").classList.toggle("hidden", !th);

  if(!th) return;

  $("#themeName").value = th.name || "";
  $("#themeGoal").value = th.goal || "";

  $("#vaultName").value = th.name || "";
  $("#vaultVer").value = "";
  $("#vaultUrl").value = "";
  $("#vaultNote").value = "";

  $("#themeStatus").textContent = "";
  $("#promptBox").textContent = "";
  $("#promptStatus").textContent = "";
  $("#vaultSaveStatus").textContent = "";

  renderPickToolsList();
  renderSequence();
  renderTryout();
}

function updateActiveTheme(fields){
  const th = getActiveTheme();
  if(!th) return;
  Object.assign(th, fields, {updatedAt: nowISO()});
  persist();
  renderThemesList();
}

$("#themeName").addEventListener("input", ()=>{
  updateActiveTheme({name: $("#themeName").value});
  $("#vaultName").value = $("#themeName").value;
});
$("#themeGoal").addEventListener("input", ()=> updateActiveTheme({goal: $("#themeGoal").value}));

/* pick tools */
function renderPickToolsList(){
  const th = getActiveTheme();
  const box = $("#pickToolsList");
  if(!box) return;

  if(!th){
    box.innerHTML = "";
    return;
  }
  if(state.tools.length === 0){
    box.innerHTML = `<div class="status">工具庫還沒有工具。先去「工具庫」新增工具卡。</div>`;
    return;
  }

  const seqSet = new Set(th.sequence || []);
  box.innerHTML = state.tools.map(t=>{
    const checked = seqSet.has(t.id) ? "checked" : "";
    return `
      <label class="item" style="align-items:center">
        <div class="meta">
          <strong>${escapeHTML(t.name)}</strong>
          <span>${escapeHTML(toolSummary(t) || "")}</span>
        </div>
        <div class="actions">
          <input type="checkbox" data-tool-id="${t.id}" ${checked} aria-label="pick ${escapeHTML(t.name)}" />
        </div>
      </label>
    `;
  }).join("");

  box.querySelectorAll("input[type=checkbox]").forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const tid = chk.dataset.toolId;
      const seq = th.sequence || [];
      if(chk.checked){
        if(!seq.includes(tid)) seq.push(tid);
      }else{
        th.sequence = seq.filter(x=>x!==tid);
      }
      updateActiveTheme({sequence: th.sequence});
      renderSequence();
      renderTryout();
    });
  });
}

/* sequence list */
function renderSequence(){
  const th = getActiveTheme();
  const box = $("#sequenceList");
  if(!box) return;

  if(!th){
    box.innerHTML = "";
    return;
  }

  const seq = th.sequence || [];
  if(seq.length === 0){
    box.innerHTML = `<div class="status">尚未選卡。請在上方勾選工具加入組合。</div>`;
    return;
  }

  box.innerHTML = seq.map((tid, idx)=>{
    const t = state.tools.find(x=>x.id===tid);
    const name = t ? t.name : "（已刪除的工具）";
    return `
      <div class="item" data-idx="${idx}">
        <div class="meta">
          <strong>${escapeHTML(String(idx+1).padStart(2,"0"))}. ${escapeHTML(name)}</strong>
          <span>${escapeHTML(t ? toolSummary(t) : "此工具已不存在，建議移除")}</span>
        </div>
        <div class="actions">
          <button class="btn ghost" data-act="up" type="button">上移</button>
          <button class="btn ghost" data-act="down" type="button">下移</button>
          <button class="btn danger" data-act="remove" type="button">移除</button>
        </div>
      </div>
    `;
  }).join("");

  box.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const item = btn.closest(".item");
      const idx = Number(item.dataset.idx);
      const act = btn.dataset.act;

      const seq2 = [...(th.sequence||[])];
      if(act === "up" && idx>0){
        [seq2[idx-1], seq2[idx]] = [seq2[idx], seq2[idx-1]];
      }else if(act === "down" && idx<seq2.length-1){
        [seq2[idx+1], seq2[idx]] = [seq2[idx], seq2[idx+1]];
      }else if(act === "remove"){
        seq2.splice(idx,1);
      }
      updateActiveTheme({sequence: seq2});
      renderPickToolsList();
      renderSequence();
      renderTryout();
    });
  });
}

/* Tryout */
function tryoutIndex(){
  const th = getActiveTheme();
  if(!th) return 0;
  const map = state.ui.tryoutIndexByTheme || {};
  return map[th.id] ?? 0;
}
function setTryoutIndex(i){
  const th = getActiveTheme();
  if(!th) return;
  if(!state.ui.tryoutIndexByTheme) state.ui.tryoutIndexByTheme = {};
  state.ui.tryoutIndexByTheme[th.id] = i;
  persist();
}

function renderTryout(){
  const th = getActiveTheme();
  const box = $("#tryoutBox");
  if(!box) return;

  if(!th){
    box.textContent = "尚未選主題。";
    return;
  }
  const seq = th.sequence || [];
  if(seq.length === 0){
    box.textContent = "尚未開始。請先在「已選組合」加入至少 1 張卡。";
    return;
  }

  let idx = tryoutIndex();
  if(idx < 0) idx = 0;
  if(idx > seq.length-1) idx = seq.length-1;
  setTryoutIndex(idx);

  const tool = state.tools.find(t=>t.id===seq[idx]);
  const title = tool ? tool.name : "（已刪除的工具）";
  const body = tool?.body || "（此卡尚未填內容）";

  box.innerHTML = `
    <div><strong>${escapeHTML(`${idx+1}/${seq.length}  ${title}`)}</strong></div>
    <div class="sep"></div>
    <div class="status">${escapeHTML(body)}</div>
  `;
}

$("#btnStartTry").addEventListener("click", ()=>{
  const th = getActiveTheme();
  if(!th) return;
  if((th.sequence||[]).length === 0){
    alert("請先加入至少 1 張卡。");
    return;
  }
  setTryoutIndex(0);
  renderTryout();
});

$("#btnPrev").addEventListener("click", ()=>{
  const th = getActiveTheme();
  if(!th) return;
  const seq = th.sequence || [];
  if(seq.length === 0) return;
  setTryoutIndex(Math.max(0, tryoutIndex()-1));
  renderTryout();
});
$("#btnNext").addEventListener("click", ()=>{
  const th = getActiveTheme();
  if(!th) return;
  const seq = th.sequence || [];
  if(seq.length === 0) return;
  setTryoutIndex(Math.min(seq.length-1, tryoutIndex()+1));
  renderTryout();
});

/* Prompt generation */
function buildPromptForTheme(th){
  const tools = (th.sequence||[])
    .map(id => state.tools.find(t=>t.id===id))
    .filter(Boolean);

  const brandTone = [
    "品牌語感：把心站穩、活得自在；不說教、溫柔而篤定；要有畫面感；要可落地、可直接使用。",
    "系統定錨（隱性）：任何時候停下來，都可以。只要舒服，就很好。",
    "命名與路徑規則：GitHub repo / 檔案 / 資料夾全部英文；資產路徑使用 assets/icons、assets/audio。"
  ].join("\n");

  const toolBlocks = tools.map((t,i)=>[
    `【工具${i+1}】${t.name}`,
    t.oneLiner ? `【一句話用途】${t.oneLiner}` : "",
    t.tags?.length ? `【標籤】${t.tags.join(", ")}` : "",
    `【卡片內容】\n${t.body || "（待補）"}`
  ].filter(Boolean).join("\n")).join("\n\n");

  const skeleton = [
    "你是「天使笑長」的協作夥伴。請依照以下輸入，產出「獨立 PWA」的完整覆蓋版檔案：index.html / style.css / app.js / manifest.json / sw.js。",
    "",
    brandTone,
    "",
    `【主題】${th.name || "（未命名）"}`,
    th.goal ? `【一句話目標】${th.goal}` : "【一句話目標】（可選）",
    "",
    "【功能需求】",
    "- 這是一個單一主題的陪伴型 PWA（非工房）。",
    "- 依照下方工具順序呈現（上一張/下一張），也可以一鍵開始（從第1張）。",
    "- 每張卡顯示：工具名 + 內容。",
    "- 提供一鍵複製『當下這張卡的內容』。",
    "- 介面簡約有質感、減法舒壓、不壓迫。",
    "",
    "【工具順序與內容】",
    toolBlocks,
    "",
    "【輸出要求】",
    "- 所有路徑英文；icons 放 assets/icons；如有音檔放 assets/audio。",
    "- manifest 設定 icon-192.png & icon-512.png；theme_color 與背景走深綠系。",
    "- service worker 基礎離線快取。",
    "- 請直接給完整可覆蓋的檔案內容，不要只給差異。"
  ].join("\n");

  return skeleton;
}

$("#btnGenPrompt").addEventListener("click", ()=>{
  const th = getActiveTheme();
  if(!th) return;

  if((th.sequence||[]).length === 0){
    alert("主題尚未選任何工具卡，無法生成咒語。");
    return;
  }

  const prompt = buildPromptForTheme(th);
  $("#promptBox").textContent = prompt;
  $("#promptStatus").textContent = "已生成。你可以按「一鍵複製」貼給 AI 協作（成品請在新的 repo 建立）。";
});

$("#btnCopyPrompt").addEventListener("click", ()=>{
  const text = $("#promptBox").textContent || "";
  if(!text.trim()){
    alert("目前沒有咒語內容。請先按「生成咒語」。");
    return;
  }
  navigator.clipboard?.writeText(text).then(()=>{
    $("#promptStatus").textContent = "已複製到剪貼簿。";
  }).catch(()=>{
    $("#promptStatus").textContent = "複製失敗：你的瀏覽器可能不允許自動複製。";
  });
});

/* Theme delete / import export */
$("#btnDeleteTheme").addEventListener("click", ()=>{
  const th = getActiveTheme();
  if(!th) return;
  if(!confirm(`要刪除主題「${th.name}」嗎？`)) return;

  state.themes = state.themes.filter(x=>x.id!==th.id);
  state.ui.activeThemeId = state.themes[0]?.id || null;
  persist();

  renderThemesList();
  loadThemeIntoEditor();
});

$("#btnExportTheme").addEventListener("click", ()=>{
  const th = getActiveTheme();
  if(!th) return;
  const blob = new Blob([JSON.stringify(th,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `theme-${(th.name||"untitled").replaceAll(" ","-")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#btnImportTheme").addEventListener("click", ()=>{
  $("#importThemeFile").click();
});

$("#importThemeFile").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const th = JSON.parse(text);
    if(!th || !th.id) throw new Error("invalid");
    // ensure id unique
    th.id = uid("theme");
    th.createdAt = nowISO();
    th.updatedAt = nowISO();
    state.themes.unshift(th);
    state.ui.activeThemeId = th.id;
    persist();
    renderThemesList();
    loadThemeIntoEditor();
    $("#themeStatus").textContent = "已匯入主題。";
  }catch(err){
    alert("匯入失敗：檔案不是有效的主題 JSON。");
  }finally{
    e.target.value = "";
  }
});

/* ------------------ Vault ------------------ */
function renderVault(){
  const q = ($("#vaultSearch").value || "").trim().toLowerCase();
  const box = $("#vaultList");

  const filtered = state.vault.filter(v=>{
    if(!q) return true;
    const blob = `${v.name||""} ${v.version||""} ${v.url||""} ${v.note||""} ${v.themeName||""}`.toLowerCase();
    return blob.includes(q);
  });

  $("#vaultCount").textContent = String(filtered.length);

  if(filtered.length === 0){
    box.innerHTML = `<div class="status">倉庫目前是空的。當你完成某個獨立 PWA 發佈，把網址貼回來存放即可。</div>`;
    return;
  }

  box.innerHTML = filtered.map(v=>`
    <div class="item" data-id="${v.id}">
      <div class="meta">
        <strong>${escapeHTML(v.name || v.themeName || "（未命名成品）")}</strong>
        <span>${escapeHTML([v.version ? `版本 ${v.version}`:"", v.url? v.url:"", v.note? `備註：${v.note}`:""].filter(Boolean).join(" • "))}</span>
      </div>
      <div class="actions">
        <a class="btn ghost" href="${escapeHTML(v.url||"#")}" target="_blank" rel="noopener">開啟</a>
        <button class="btn ghost" data-act="copy" type="button">複製網址</button>
        <button class="btn danger" data-act="del" type="button">刪除</button>
      </div>
    </div>
  `).join("");
}

$("#vaultSearch").addEventListener("input", renderVault);

$("#vaultList").addEventListener("click",(e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const item = e.target.closest(".item");
  if(!item) return;
  const id = item.dataset.id;
  const v = state.vault.find(x=>x.id===id);
  if(!v) return;

  const act = btn.dataset.act;
  if(act === "del"){
    if(confirm("要刪除這筆成品連結嗎？")){
      state.vault = state.vault.filter(x=>x.id!==id);
      persist();
      renderVault();
    }
  }else if(act === "copy"){
    navigator.clipboard?.writeText(v.url||"").then(()=>{
      alert("已複製網址。");
    }).catch(()=>{
      alert("複製失敗。");
    });
  }
});

$("#btnSaveVault").addEventListener("click", ()=>{
  const th = getActiveTheme();
  const name = ($("#vaultName").value || (th?.name||"")).trim();
  const version = ($("#vaultVer").value || "").trim();
  const url = ($("#vaultUrl").value || "").trim();
  const note = ($("#vaultNote").value || "").trim();

  if(!url || !/^https?:\/\//i.test(url)){
    $("#vaultSaveStatus").textContent = "請貼上有效的網址（需以 http/https 開頭）。";
    return;
  }

  const entry = {
    id: uid("vault"),
    name: name || (th?.name||""),
    version,
    url,
    note,
    themeId: th?.id || null,
    themeName: th?.name || "",
    createdAt: nowISO()
  };

  state.vault.unshift(entry);
  persist();
  $("#vaultSaveStatus").textContent = "已存到倉庫。";
  renderVault();
});

$("#btnExportVault").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state.vault,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vault.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#btnImportVault").addEventListener("click", ()=> $("#importVaultFile").click());

$("#importVaultFile").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!Array.isArray(data)) throw new Error("invalid");
    // normalize ids
    const normalized = data.map(v=>({
      id: uid("vault"),
      name: v.name || "",
      version: v.version || "",
      url: v.url || "",
      note: v.note || "",
      themeId: v.themeId || null,
      themeName: v.themeName || "",
      createdAt: v.createdAt || nowISO()
    })).filter(v=>v.url);

    state.vault = normalized.concat(state.vault);
    persist();
    renderVault();
    alert("已匯入倉庫資料。");
  }catch(err){
    alert("匯入失敗：檔案不是有效的倉庫 JSON。");
  }finally{
    e.target.value = "";
  }
});

/* ------------------ SW register ------------------ */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}

/* ------------------ Init ------------------ */
function init(){
  setActiveTab(state.ui.activeTab || "tools");

  renderTools();
  renderThemesList();
  loadThemeIntoEditor();
  renderVault();

  // Auto-open themes editor if activeTab is themes
  if(state.ui.activeTab === "themes" && state.ui.activeThemeId){
    loadThemeIntoEditor();
  }
}

init();