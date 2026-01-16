/* Angel Collab Workshop - app.js (full overwrite) */
(() => {
  const LS_KEY = "acw_state_v1";
  const BACKUP_SCHEMA = "acw_backup_v1";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const nowISO = () => new Date().toISOString();

  const builtInPromptTemplate = () => `你是「天使笑長」的協作夥伴，請依照以下資料，為我製作一個【可獨立安裝的 PWA 工具】。
品牌語感：把心站穩、活得自在；不說教、溫柔而篤定；可落地、可直接使用。

【A｜主題資訊】
- 主題名稱：{{THEME_TITLE}}
- 副標／描述：{{THEME_DESC}}
- 目標：每天練習＋現場急救都能用（簡單、好上手、能陪伴）

【B｜工具流程（請照順序做成『可走的路』）】
{{TOOLS_BLOCK}}

【C｜功能需求（必做）】
1) 說明頁：請把「主題介紹文」寫進 PWA 的說明頁（清楚、溫柔、可口說）。
2) 安裝說明：說明頁需包含『複製網址貼到瀏覽器』的字眼，教使用者如何用瀏覽器開啟與安裝到桌面。
3) Icon：請「分開獨立製作」兩個規格的 icon：192×192、512×512（PNG），並說明檔名與放置位置（例如 assets/icons/）。
4) Google 表單：請協助我設計一份 Google 表單用來收集回饋（建議欄位：使用情境、卡在哪一步、最有感一句、想新增什麼、Email 可選）。
5) 金句輪換：請做一個「金句輪換」區塊（可開關、可新增多句、每次刷新/或按鈕切換）。

【D｜斷字與排版（必注意）】
- 中文斷字不要一個字一行。
- 英文/網址可換行，但標題、按鈕文字不要被切碎。
- 請提供必要的 CSS（包含 line-break/word-break 建議）。

【E｜輸出格式（請一次給我完整檔案，可直接覆蓋）】
- index.html
- style.css
- app.js
- manifest.json
- sw.js（含快取版本號，確保更新生效）

【F｜互動設計（請幫我想得更像『陪伴』）】
- 每個步驟不要只是一張卡，要能有「自填欄位」：例如『我原本會怎麼反應』『我現在選擇』。
- 每一步提供一句可說出口的「替代句」，並可一鍵複製。
- 整體流程要一眼懂、按一下就能開始。

開始製作前，如有你需要補充的關鍵缺口，請用「最多 3 個問題」問我，其餘請直接做。`;

  const defaultState = () => ({
    tools: [],
    themes: [],
    vault: [],
    prompt: {
      template: builtInPromptTemplate(),
      lastThemeId: null
    },
    ui: {
      activeTab: "tools"
    }
  });

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        tools: Array.isArray(parsed.tools) ? parsed.tools : [],
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        vault: Array.isArray(parsed.vault) ? parsed.vault : [],
        prompt: { ...base.prompt, ...(parsed.prompt || {}) },
        ui: { ...base.ui, ...(parsed.ui || {}) }
      };
    } catch (e) {
      console.warn("loadState failed:", e);
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  // ---------- Tabs ----------
  function setActiveTab(tab) {
    state.ui.activeTab = tab;
    saveState();
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".panel").forEach((p) => p.classList.remove("active"));
    $(`#panel-${tab}`)?.classList.add("active");

    if (tab === "prompt") {
      refreshPromptThemePick();
      syncPromptUI();
    }
  }

  // ---------- Rendering ----------
  function renderAll() {
    renderTools();
    renderThemes();
    renderVault();
    setActiveTab(state.ui.activeTab || "tools");
  }

  function renderTools() {
    const q = ($("#toolsSearch")?.value || "").trim().toLowerCase();
    const list = $("#toolsList");
    const empty = $("#toolsEmpty");
    const count = $("#toolsCount");

    const items = state.tools
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .filter((t) => {
        if (!q) return true;
        return (
          (t.name || "").toLowerCase().includes(q) ||
          (t.oneLiner || "").toLowerCase().includes(q) ||
          (t.body || "").toLowerCase().includes(q) ||
          (t.tagsText || "").toLowerCase().includes(q)
        );
      });

    count.textContent = String(state.tools.length);
    list.innerHTML = "";

    if (items.length === 0) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    for (const t of items) {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemTop">
          <div>
            <div class="itemTitle">${escapeHtml(t.name || "（未命名工具）")}</div>
            <div class="itemOne">${escapeHtml(t.oneLiner || "")}</div>
            ${t.tagsText ? `<div class="itemTags">${escapeHtml(t.tagsText)}</div>` : ""}
          </div>
          <div class="itemBtns">
            <button class="btn ghost" data-act="editTool" data-id="${t.id}">編輯</button>
            <button class="btn ghost" data-act="copyTool" data-id="${t.id}">複製卡片內容</button>
            <button class="btn danger" data-act="delTool" data-id="${t.id}">刪除</button>
          </div>
        </div>
      `;
      list.appendChild(div);
    }
  }

  function renderThemes() {
    const q = ($("#themesSearch")?.value || "").trim().toLowerCase();
    const list = $("#themesList");
    const empty = $("#themesEmpty");
    const count = $("#themesCount");

    const items = state.themes
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .filter((th) => {
        if (!q) return true;
        return (
          (th.title || "").toLowerCase().includes(q) ||
          (th.desc || "").toLowerCase().includes(q) ||
          (th.tagsText || "").toLowerCase().includes(q)
        );
      });

    count.textContent = String(state.themes.length);
    list.innerHTML = "";

    if (items.length === 0) {
      empty.style.display = "block";
      refreshPromptThemePick();
      return;
    }
    empty.style.display = "none";

    for (const th of items) {
      const flowNames = (th.flow || [])
        .map((id) => state.tools.find((t) => t.id === id)?.name)
        .filter(Boolean);

      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemTop">
          <div>
            <div class="itemTitle">${escapeHtml(th.title || "（未命名主題）")}</div>
            <div class="itemOne">${escapeHtml(th.desc || "")}</div>
            ${flowNames.length ? `<div class="itemTags">流程：${escapeHtml(flowNames.join(" → "))}</div>` : `<div class="itemTags">流程：尚未加入工具</div>`}
            ${th.tagsText ? `<div class="itemTags">${escapeHtml(th.tagsText)}</div>` : ""}
          </div>
          <div class="itemBtns">
            <button class="btn ghost" data-act="editTheme" data-id="${th.id}">編輯</button>
            <button class="btn ghost" data-act="copyTheme" data-id="${th.id}">複製組合內容</button>
            <button class="btn" data-act="copyPrompt" data-id="${th.id}">複製協作咒語</button>
            <button class="btn danger" data-act="delTheme" data-id="${th.id}">刪除</button>
          </div>
        </div>
      `;
      list.appendChild(div);
    }

    refreshPromptThemePick();
  }

  function renderVault() {
    const list = $("#vaultList");
    const empty = $("#vaultEmpty");
    const count = $("#vaultCount");

    count.textContent = String(state.vault.length);

    const items = state.vault
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    list.innerHTML = "";
    if (items.length === 0) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    for (const v of items) {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemTop">
          <div>
            <div class="itemTitle">${escapeHtml(v.title || "（未命名連結）")}</div>
            <div class="itemOne">${v.url ? `<a href="${escapeAttr(v.url)}" target="_blank" rel="noopener">${escapeHtml(v.url)}</a>` : ""}</div>
            ${v.note ? `<div class="itemTags">${escapeHtml(v.note)}</div>` : ""}
          </div>
          <div class="itemBtns">
            <button class="btn ghost" data-act="editVault" data-id="${v.id}">編輯</button>
            <button class="btn danger" data-act="delVault" data-id="${v.id}">刪除</button>
          </div>
        </div>
      `;
      list.appendChild(div);
    }
  }

  // ---------- Prompt ----------
  function refreshPromptThemePick() {
    const sel = $("#promptThemePick");
    if (!sel) return;

    const current = state.prompt.lastThemeId || "";
    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "（先選一個主題）";
    sel.appendChild(opt0);

    for (const th of state.themes.slice().sort((a,b)=> (a.title||"").localeCompare(b.title||""))) {
      const opt = document.createElement("option");
      opt.value = th.id;
      opt.textContent = th.title || "（未命名主題）";
      sel.appendChild(opt);
    }

    sel.value = state.themes.some(t => t.id === current) ? current : "";
  }

  function syncPromptUI() {
    const tpl = $("#promptTemplate");
    const pv = $("#promptPreview");
    if (tpl) tpl.value = state.prompt.template || builtInPromptTemplate();
    if (pv) pv.value = "";
  }

  function buildToolsBlock(themeId) {
    const th = state.themes.find(x => x.id === themeId);
    if (!th) return "（找不到主題）";

    const ids = Array.isArray(th.flow) ? th.flow : [];
    if (ids.length === 0) return "（此主題尚未加入工具流程）";

    const lines = [];
    ids.forEach((tid, idx) => {
      const t = state.tools.find(x => x.id === tid);
      if (!t) {
        lines.push(`${idx+1}. （找不到工具：${tid}）`);
        return;
      }
      lines.push(`${idx+1}. 【工具名稱】${t.name || ""}`);
      if (t.oneLiner) lines.push(`   【一句話】${t.oneLiner}`);
      if (t.tagsText) lines.push(`   【標籤】${t.tagsText}`);
      lines.push(`   【內容】\n${indentBlock(t.body || "", "   ")}`);
      lines.push(""); // blank line
    });
    return lines.join("\n").trim();
  }

  function buildPrompt(themeId) {
    const th = state.themes.find(x => x.id === themeId);
    if (!th) return "";

    const tpl = state.prompt.template || builtInPromptTemplate();
    const toolsBlock = buildToolsBlock(themeId);

    return tpl
      .replaceAll("{{THEME_TITLE}}", th.title || "")
      .replaceAll("{{THEME_DESC}}", th.desc || "")
      .replaceAll("{{TOOLS_BLOCK}}", toolsBlock);
  }

  function previewPrompt(themeId) {
    const pv = $("#promptPreview");
    if (!pv) return;
    if (!themeId) {
      pv.value = "（請先選擇主題）";
      return;
    }
    pv.value = buildPrompt(themeId) || "（生成失敗）";
  }

  function copyPrompt(themeId) {
    if (!themeId) {
      alert("請先選擇主題。");
      return;
    }
    const text = buildPrompt(themeId);
    if (!text) {
      alert("生成失敗：找不到主題或模板。");
      return;
    }
    state.prompt.lastThemeId = themeId;
    saveState();
    copyToClipboard(text);
  }

  // ---------- Modals ----------
  const toolModal = $("#toolModal");
  const themeModal = $("#themeModal");
  const vaultModal = $("#vaultModal");

  // tool modal fields
  const tool_id = $("#tool_id");
  const tool_name = $("#tool_name");
  const tool_one = $("#tool_one");
  const tool_content = $("#tool_content");
  const tool_tags = $("#tool_tags");
  const tool_status = $("#tool_status");
  const tool_ai = $("#tool_ai");
  const toolDelete = $("#toolDelete");
  const toolSave = $("#toolSave");
  const toolCopy = $("#toolCopy");
  const toolModalTitle = $("#toolModalTitle");

  function openToolModal(editId = null) {
    const isEdit = !!editId;
    toolModalTitle.textContent = isEdit ? "編輯工具" : "新增工具";
    toolDelete.style.display = isEdit ? "inline-flex" : "none";

    if (!isEdit) {
      tool_id.value = "";
      tool_name.value = "";
      tool_one.value = "";
      tool_content.value = "";
      tool_tags.value = "";
      tool_status.value = "draft";
      tool_ai.value = "";
    } else {
      const t = state.tools.find((x) => x.id === editId);
      if (!t) return;
      tool_id.value = t.id;
      tool_name.value = t.name || "";
      tool_one.value = t.oneLiner || "";
      tool_content.value = t.body || "";
      tool_tags.value = t.tagsText || "";
      tool_status.value = t.status || "draft";
      tool_ai.value = t.ai || "";
    }
    toolModal.showModal();
  }

  function upsertTool() {
    const id = tool_id.value || uid("tool");
    const patch = {
      id,
      name: tool_name.value.trim(),
      oneLiner: tool_one.value.trim(),
      body: tool_content.value || "",
      tagsText: normalizeTags(tool_tags.value || ""),
      status: tool_status.value || "draft",
      ai: (tool_ai.value || "").trim(),
      updatedAt: Date.now()
    };

    const idx = state.tools.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const old = state.tools[idx];
      state.tools[idx] = { ...old, ...patch, createdAt: old.createdAt || Date.now() };
    } else {
      state.tools.push({ ...patch, createdAt: Date.now() });
    }

    saveState();
    renderAll();
    toolModal.close();
  }

  function deleteTool(id) {
    state.themes = state.themes.map((th) => ({
      ...th,
      flow: (th.flow || []).filter((x) => x !== id),
      updatedAt: Date.now()
    }));
    state.tools = state.tools.filter((t) => t.id !== id);
    saveState();
    renderAll();
  }

  function copyToolText(id) {
    const t = state.tools.find((x) => x.id === id);
    if (!t) return;
    const text = [
      `【工具】${t.name || ""}`,
      t.oneLiner ? `【一句話】${t.oneLiner}` : "",
      t.tagsText ? `【標籤】${t.tagsText}` : "",
      `【內容】\n${t.body || ""}`
    ].filter(Boolean).join("\n");
    copyToClipboard(text);
  }

  // theme modal fields
  const theme_id = $("#theme_id");
  const theme_title = $("#theme_title");
  const theme_desc = $("#theme_desc");
  const theme_tags = $("#theme_tags");
  const theme_ai = $("#theme_ai");
  const themeDelete = $("#themeDelete");
  const themeSave = $("#themeSave");
  const themeCopy = $("#themeCopy");
  const themeCopyPrompt = $("#themeCopyPrompt");
  const themeModalTitle = $("#themeModalTitle");
  const pickToolsList = $("#pickToolsList");
  const pickToolsEmpty = $("#pickToolsEmpty");
  const themeFlowList = $("#themeFlowList");
  const themeFlowEmpty = $("#themeFlowEmpty");

  let themeFlow = [];

  function openThemeModal(editId = null) {
    const isEdit = !!editId;
    themeModalTitle.textContent = isEdit ? "編輯主題" : "新增主題";
    themeDelete.style.display = isEdit ? "inline-flex" : "none";

    if (!isEdit) {
      theme_id.value = "";
      theme_title.value = "";
      theme_desc.value = "";
      theme_tags.value = "";
      theme_ai.value = "";
      themeFlow = [];
    } else {
      const th = state.themes.find((x) => x.id === editId);
      if (!th) return;
      theme_id.value = th.id;
      theme_title.value = th.title || "";
      theme_desc.value = th.desc || "";
      theme_tags.value = th.tagsText || "";
      theme_ai.value = th.ai || "";
      themeFlow = Array.isArray(th.flow) ? th.flow.slice() : [];
      state.prompt.lastThemeId = th.id; // ⬅ 打開主題時，順便記住
      saveState();
    }

    renderPickTools();
    renderThemeFlow();
    themeModal.showModal();
  }

  function renderPickTools() {
    pickToolsList.innerHTML = "";
    if (state.tools.length === 0) {
      pickToolsEmpty.style.display = "block";
      return;
    }
    pickToolsEmpty.style.display = "none";

    const items = state.tools.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    for (const t of items) {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemTop">
          <div>
            <div class="itemTitle">${escapeHtml(t.name || "（未命名工具）")}</div>
            <div class="itemOne">${escapeHtml(t.oneLiner || "")}</div>
          </div>
          <div class="itemBtns">
            <button class="btn ghost" data-act="addToFlow" data-id="${t.id}" type="button">加入 →</button>
          </div>
        </div>
      `;
      pickToolsList.appendChild(div);
    }
  }

  function renderThemeFlow() {
    themeFlowList.innerHTML = "";
    if (themeFlow.length === 0) {
      themeFlowEmpty.style.display = "block";
      return;
    }
    themeFlowEmpty.style.display = "none";

    themeFlow.forEach((id, idx) => {
      const t = state.tools.find((x) => x.id === id);
      const name = t?.name || "（找不到的工具）";
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemTop">
          <div>
            <div class="itemTitle">${idx + 1}. ${escapeHtml(name)}</div>
          </div>
          <div class="itemBtns">
            <button class="btn ghost" data-act="moveUp" data-idx="${idx}" type="button">↑</button>
            <button class="btn ghost" data-act="moveDown" data-idx="${idx}" type="button">↓</button>
            <button class="btn danger" data-act="removeFromFlow" data-idx="${idx}" type="button">移除</button>
          </div>
        </div>
      `;
      themeFlowList.appendChild(div);
    });
  }

  function upsertTheme() {
    const id = theme_id.value || uid("theme");
    const patch = {
      id,
      title: theme_title.value.trim(),
      desc: theme_desc.value || "",
      flow: themeFlow.slice(),
      tagsText: normalizeTags(theme_tags.value || ""),
      ai: (theme_ai.value || "").trim(),
      updatedAt: Date.now()
    };

    const idx = state.themes.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const old = state.themes[idx];
      state.themes[idx] = { ...old, ...patch, createdAt: old.createdAt || Date.now() };
    } else {
      state.themes.push({ ...patch, createdAt: Date.now() });
    }

    state.prompt.lastThemeId = id;
    saveState();
    renderAll();
    themeModal.close();
  }

  function deleteTheme(id) {
    state.themes = state.themes.filter((x) => x.id !== id);
    if (state.prompt.lastThemeId === id) state.prompt.lastThemeId = null;
    saveState();
    renderAll();
  }

  function copyThemeText(id) {
    const th = state.themes.find((x) => x.id === id);
    if (!th) return;
    const flowNames = (th.flow || [])
      .map((tid) => state.tools.find((t) => t.id === tid)?.name)
      .filter(Boolean);

    const text = [
      `【主題】${th.title || ""}`,
      th.desc ? `【描述】${th.desc}` : "",
      th.tagsText ? `【標籤】${th.tagsText}` : "",
      flowNames.length ? `【流程】${flowNames.join(" → ")}` : `【流程】（尚未加入工具）`,
      th.ai ? `【AI 協作提示】${th.ai}` : ""
    ].filter(Boolean).join("\n");
    copyToClipboard(text);
  }

  // vault modal fields
  const vault_id = $("#vault_id");
  const vault_title = $("#vault_title");
  const vault_url = $("#vault_url");
  const vault_note = $("#vault_note");
  const vaultDelete = $("#vaultDelete");
  const vaultSave = $("#vaultSave");
  const vaultModalTitle = $("#vaultModalTitle");

  function openVaultModal(editId = null) {
    const isEdit = !!editId;
    vaultModalTitle.textContent = isEdit ? "編輯成品連結" : "新增成品連結";
    vaultDelete.style.display = isEdit ? "inline-flex" : "none";

    if (!isEdit) {
      vault_id.value = "";
      vault_title.value = "";
      vault_url.value = "";
      vault_note.value = "";
    } else {
      const v = state.vault.find((x) => x.id === editId);
      if (!v) return;
      vault_id.value = v.id;
      vault_title.value = v.title || "";
      vault_url.value = v.url || "";
      vault_note.value = v.note || "";
    }
    vaultModal.showModal();
  }

  function upsertVault() {
    const id = vault_id.value || uid("vault");
    const patch = {
      id,
      title: vault_title.value.trim(),
      url: (vault_url.value || "").trim(),
      note: vault_note.value || "",
      updatedAt: Date.now()
    };

    const idx = state.vault.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const old = state.vault[idx];
      state.vault[idx] = { ...old, ...patch, createdAt: old.createdAt || Date.now() };
    } else {
      state.vault.push({ ...patch, createdAt: Date.now() });
    }

    saveState();
    renderAll();
    vaultModal.close();
  }

  function deleteVault(id) {
    state.vault = state.vault.filter((x) => x.id !== id);
    saveState();
    renderAll();
  }

  // ---------- Export / Import ----------
  function exportBackup() {
    const payload = {
      schema: BACKUP_SCHEMA,
      exportedAt: nowISO(),
      data: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `acw-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importBackupFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || "");
        const parsed = JSON.parse(raw);

        if (parsed?.schema !== BACKUP_SCHEMA || !parsed?.data) {
          alert("這不是 Angel Collab Workshop 的備份檔（schema 不符）。");
          return;
        }

        const incoming = sanitizeIncomingState(parsed.data);

        const mode = confirm(
          "要『覆蓋』目前工房資料嗎？\n\n【確定】＝覆蓋（完全以匯入檔為準）\n【取消】＝合併（保留現有 + 加入匯入）"
        ) ? "overwrite" : "merge";

        if (mode === "overwrite") {
          state = incoming;
        } else {
          state = mergeState(state, incoming);
        }

        saveState();
        renderAll();
        alert("匯入完成 ✅");
      } catch (e) {
        console.error(e);
        alert("匯入失敗：檔案格式可能損壞或不是 JSON。");
      }
    };
    reader.readAsText(file);
  }

  function sanitizeIncomingState(s) {
    const base = defaultState();
    return {
      ...base,
      ...s,
      tools: Array.isArray(s.tools) ? s.tools : [],
      themes: Array.isArray(s.themes) ? s.themes : [],
      vault: Array.isArray(s.vault) ? s.vault : [],
      prompt: { ...base.prompt, ...(s.prompt || {}) },
      ui: { ...base.ui, ...(s.ui || {}) }
    };
  }

  function mergeState(a, b) {
    const out = sanitizeIncomingState(a);

    const mergeById = (arr1, arr2) => {
      const map = new Map(arr1.map((x) => [x.id, x]));
      for (const x of arr2) {
        if (!x?.id) continue;
        if (!map.has(x.id)) map.set(x.id, x);
        else {
          const old = map.get(x.id);
          const oldT = old.updatedAt || old.createdAt || 0;
          const newT = x.updatedAt || x.createdAt || 0;
          if (newT >= oldT) map.set(x.id, { ...old, ...x });
        }
      }
      return Array.from(map.values());
    };

    out.tools = mergeById(out.tools, b.tools || []);
    out.themes = mergeById(out.themes, b.themes || []);
    out.vault = mergeById(out.vault, b.vault || []);
    out.prompt = { ...out.prompt, ...(b.prompt || {}) };
    out.ui = { ...out.ui, ...(b.ui || {}) };
    return out;
  }

  // ---------- Seeds ----------
  function seedTool() {
    const t = {
      id: uid("tool"),
      name: "斷點停火｜暫停",
      oneLiner: "在自動反應全速運轉前，先讓身體回來。",
      body: "為什麼改變很難？\n因為自動反應啟動只要 12ms，而理性至少要 500ms。\n\n✦ 此刻我感受到的是：\n＿＿＿＿＿＿＿＿＿＿\n\n✦ 我願意先暫停 30～90 秒：\n（1）把手放在胸口\n（2）吸一口氣\n（3）慢慢吐完\n\n✦ 我原本會怎麼反應：\n＿＿＿＿＿＿＿＿＿＿\n\n✦ 我現在選擇：\n＿＿＿＿＿＿＿＿＿＿",
      tagsText: "#暫停 #斷點 #急救",
      status: "ready",
      ai: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.tools.push(t);
    saveState();
    renderAll();
  }

  function seedVault() {
    const v = {
      id: uid("vault"),
      title: "示範｜改變（獨立PWA）",
      url: "https://yourname.github.io/pwa-change/",
      note: "v1.0｜可分享給學員｜搭配：改變｜建立新反應",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.vault.push(v);
    saveState();
    renderAll();
  }

  // ---------- Events ----------
  function bindEvents() {
    // tabs
    $$(".tab").forEach((b) => {
      b.addEventListener("click", () => setActiveTab(b.dataset.tab));
    });

    // searches
    $("#toolsSearch")?.addEventListener("input", renderTools);
    $("#themesSearch")?.addEventListener("input", renderThemes);

    // top buttons
    $("#btnExport")?.addEventListener("click", exportBackup);
    $("#btnImport")?.addEventListener("click", () => $("#importFile").click());
    $("#importFile")?.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) importBackupFromFile(f);
      e.target.value = "";
    });

    $("#btnAddTool")?.addEventListener("click", () => openToolModal(null));
    $("#btnAddTheme")?.addEventListener("click", () => openThemeModal(null));
    $("#btnAddVault")?.addEventListener("click", () => openVaultModal(null));

    $("#btnSeedTool")?.addEventListener("click", seedTool);
    $("#btnSeedVault")?.addEventListener("click", seedVault);

    // prompt page buttons
    $("#promptThemePick")?.addEventListener("change", (e) => {
      const id = e.target.value || "";
      state.prompt.lastThemeId = id || null;
      saveState();
    });
    $("#btnPreviewPrompt")?.addEventListener("click", () => previewPrompt(state.prompt.lastThemeId));
    $("#btnCopyPrompt")?.addEventListener("click", () => copyPrompt(state.prompt.lastThemeId));
    $("#btnSavePrompt")?.addEventListener("click", () => {
      const tpl = $("#promptTemplate")?.value || "";
      state.prompt.template = tpl.trim() ? tpl : builtInPromptTemplate();
      saveState();
      alert("模板已儲存 ✅");
    });
    $("#btnResetPrompt")?.addEventListener("click", () => {
      if (!confirm("確定還原為內建模板？")) return;
      state.prompt.template = builtInPromptTemplate();
      saveState();
      syncPromptUI();
      alert("已還原 ✅");
    });

    // tool modal actions
    $("#toolSave")?.addEventListener("click", upsertTool);
    $("#toolDelete")?.addEventListener("click", () => {
      const id = tool_id.value;
      if (!id) return;
      if (confirm("確定刪除這張工具卡？")) {
        deleteTool(id);
        toolModal.close();
      }
    });
    $("#toolCopy")?.addEventListener("click", () => {
      const id = tool_id.value;
      if (id) copyToolText(id);
      else {
        const text = [
          `【工具】${tool_name.value.trim()}`,
          tool_one.value.trim() ? `【一句話】${tool_one.value.trim()}` : "",
          normalizeTags(tool_tags.value || "") ? `【標籤】${normalizeTags(tool_tags.value || "")}` : "",
          `【內容】\n${tool_content.value || ""}`
        ].filter(Boolean).join("\n");
        copyToClipboard(text);
      }
    });

    // theme modal actions
    $("#pickToolsList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.act === "addToFlow") {
        const id = btn.dataset.id;
        if (id) themeFlow.push(id);
        renderThemeFlow();
      }
    });

    $("#themeFlowList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      const idx = Number(btn.dataset.idx);
      if (Number.isNaN(idx)) return;

      if (act === "removeFromFlow") {
        themeFlow.splice(idx, 1);
        renderThemeFlow();
      }
      if (act === "moveUp" && idx > 0) {
        [themeFlow[idx - 1], themeFlow[idx]] = [themeFlow[idx], themeFlow[idx - 1]];
        renderThemeFlow();
      }
      if (act === "moveDown" && idx < themeFlow.length - 1) {
        [themeFlow[idx + 1], themeFlow[idx]] = [themeFlow[idx], themeFlow[idx + 1]];
        renderThemeFlow();
      }
    });

    $("#themeSave")?.addEventListener("click", upsertTheme);
    $("#themeDelete")?.addEventListener("click", () => {
      const id = theme_id.value;
      if (!id) return;
      if (confirm("確定刪除這個主題？")) {
        deleteTheme(id);
        themeModal.close();
      }
    });
    $("#themeCopy")?.addEventListener("click", () => {
      const id = theme_id.value;
      if (id) copyThemeText(id);
      else {
        const flowNames = themeFlow
          .map((tid) => state.tools.find((t) => t.id === tid)?.name)
          .filter(Boolean);
        const text = [
          `【主題】${theme_title.value.trim()}`,
          theme_desc.value ? `【描述】${theme_desc.value}` : "",
          normalizeTags(theme_tags.value || "") ? `【標籤】${normalizeTags(theme_tags.value || "")}` : "",
          flowNames.length ? `【流程】${flowNames.join(" → ")}` : ""
        ].filter(Boolean).join("\n");
        copyToClipboard(text);
      }
    });

    $("#themeCopyPrompt")?.addEventListener("click", () => {
      const id = theme_id.value;
      if (!id) {
        alert("請先儲存主題，才有 ID 可以生成咒語。");
        return;
      }
      copyPrompt(id);
    });

    // vault modal actions
    $("#vaultSave")?.addEventListener("click", upsertVault);
    $("#vaultDelete")?.addEventListener("click", () => {
      const id = vault_id.value;
      if (!id) return;
      if (confirm("確定刪除這筆連結？")) {
        deleteVault(id);
        vaultModal.close();
      }
    });

    // main list actions (delegation)
    $("#toolsList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (!id) return;

      if (act === "editTool") openToolModal(id);
      if (act === "copyTool") copyToolText(id);
      if (act === "delTool") {
        if (confirm("確定刪除這張工具卡？")) deleteTool(id);
      }
    });

    $("#themesList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (!id) return;

      if (act === "editTheme") openThemeModal(id);
      if (act === "copyTheme") copyThemeText(id);
      if (act === "copyPrompt") copyPrompt(id);
      if (act === "delTheme") {
        if (confirm("確定刪除這個主題？")) deleteTheme(id);
      }
    });

    $("#vaultList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (!id) return;

      if (act === "editVault") openVaultModal(id);
      if (act === "delVault") {
        if (confirm("確定刪除這筆連結？")) deleteVault(id);
      }
    });
  }

  // ---------- Helpers ----------
  function normalizeTags(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const parts = raw
      .replace(/,/g, " ")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith("#") ? s : `#${s}`));
    const seen = new Set();
    const out = [];
    for (const p of parts) {
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out.join(" ");
  }

  function indentBlock(text, pad) {
    const s = String(text || "");
    if (!s.trim()) return "";
    return s.split("\n").map(line => pad + line).join("\n");
  }

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(
      () => alert("已複製 ✅"),
      () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        alert("已複製 ✅");
      }
    );
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(str) {
    return String(str || "").replaceAll('"', "%22");
  }

  // ---------- Init ----------
  bindEvents();
  renderAll();

  // service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.warn);
    });
  }
})();