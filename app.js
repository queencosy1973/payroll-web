/**
 * QueenCosy AI Payroll & Job Sheet Scanner - Frontend Controller (app.js)
 */
(function () {
  'use strict';

  // Application State
  let captureQueue = []; // { id, name, imageDataUrl, status: 'PENDING'|'PROCESSING'|'DONE'|'ERROR', errorMsg, sheetId }
  let activeSheetId = null;
  let cameraStream = null;
  let imgZoom = 1;
  let imgRotation = 0;

  // Chart.js Instances for Tab 5 Executive Dashboard
  let chartMonthlyTrend = null;
  let chartSkuMix = null;
  let chartWorkerRank = null;
  let chartDailyRhythm = null;

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initConfigAndApiUI();
    initMappingTablesUI();
    initScannerAndCameraUI();
    initReviewWorkspaceUI();
    initPayrollSummaryUI();
    initExecutiveDashboardUI();
    initCloudSyncUI();

    refreshAllViews();
    PayrollDB.syncFromCloud(false);
  });

  function initCloudSyncUI() {
    const btnSync = document.getElementById('btn-header-cloud-sync');
    const badgeSync = document.getElementById('badge-cloud-sync');

    const triggerManualSync = async () => {
      if (badgeSync) {
        badgeSync.className = 'px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse cursor-pointer';
        badgeSync.textContent = '⏳ กำลังซิงค์ข้อมูลมือถือ ⇄ คอม...';
      }
      if (btnSync) btnSync.disabled = true;
      await PayrollDB.syncFromCloud(false);
      if (btnSync) btnSync.disabled = false;
    };

    if (btnSync) btnSync.addEventListener('click', triggerManualSync);
    if (badgeSync) badgeSync.addEventListener('click', triggerManualSync);

    PayrollDB.onCloudSync((meta) => {
      const inputKey = document.getElementById('input-gemini-api-key');
      const selectModel = document.getElementById('select-gemini-model');
      const cfg = PayrollDB.getConfig();
      const activeEl = document.activeElement;
      const isTypingInInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);

      if (inputKey && activeEl !== inputKey && cfg.geminiApiKey) {
        inputKey.value = cfg.geminiApiKey;
      }
      if (selectModel && activeEl !== selectModel && cfg.geminiModel) {
        selectModel.value = cfg.geminiModel;
      }

      if (badgeSync) {
        if (meta && meta.ok) {
          const timeStr = meta.syncedAt ? meta.syncedAt.toLocaleTimeString('th-TH') : '';
          badgeSync.className = 'px-2.5 py-0.5 text-[10px] font-black rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300 cursor-pointer';
          badgeSync.textContent = `☁️ ซิงค์ฐานข้อมูลกลางแล้ว (${timeStr})`;
        } else if (meta && meta.isBackground) {
          const lastStr = meta.lastSyncedAt ? `ล่าสุด ${meta.lastSyncedAt.toLocaleTimeString('th-TH')}` : 'ทำงานต่อได้ปกติ';
          badgeSync.className = 'px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer';
          badgeSync.textContent = `🟡 เซฟในเครื่องแล้ว • รอซิงค์คลาวด์ (${lastStr})`;
        } else {
          badgeSync.className = 'px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-100 text-rose-800 border border-rose-300 cursor-pointer';
          badgeSync.textContent = `⚠️ คลาวด์กำลังคิวเต็ม (คลิกเพื่อซิงค์ใหม่ — ข้อมูลในเครื่องปลอดภัย)`;
        }
      }

      // Always refresh Queue, Badges, Payroll Summary & Dashboard
      renderQueueList();
      renderPayrollDashboard();
      renderExecutiveDashboard();
      updateHeaderBadges();

      // Refresh Mapping tables only on manual sync OR when Cloud actually brought newer mappings and user is not typing
      if (!meta.isBackground || (meta.mappingsChangedFromCloud && !isTypingInInput)) {
        renderSkuMappingTable();
        renderWorkerMappingTable();
      }
      if (!meta.isBackground || (meta.sheetsChangedFromCloud && !isTypingInInput && !activeSkuSearchState)) {
        renderReviewSelectorAndWorkspace();
      }
    });
  }

  function refreshAllViews() {
    renderSkuMappingTable();
    renderWorkerMappingTable();
    renderQueueList();
    renderReviewSelectorAndWorkspace();
    renderPayrollDashboard();
    renderExecutiveDashboard();
    updateHeaderBadges();
  }

  function updateHeaderBadges() {
    const cfg = PayrollDB.getConfig();
    const apiBadge = document.getElementById('badge-api-status');
    if (apiBadge) {
      apiBadge.style.cursor = 'pointer';
      apiBadge.onclick = () => {
        const entered = prompt('🔑 ตั้งค่า Gemini API Key (วางคีย์แล้วกดตกลง ระบบจะซิงค์ให้ทุกเครื่องอัตโนมัติ):', cfg.geminiApiKey || '');
        if (entered && entered.trim()) {
          PayrollDB.saveConfig({ geminiApiKey: entered.trim() });
          const inputKey = document.getElementById('input-gemini-api-key');
          if (inputKey) inputKey.value = entered.trim();
          updateHeaderBadges();
        }
      };
      if (cfg.geminiApiKey) {
        apiBadge.className = 'px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer';
        apiBadge.textContent = `🟢 Gemini AI พร้อมใช้งาน (${cfg.geminiModel || 'gemini-flash-latest'})`;
      } else {
        apiBadge.className = 'px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer';
        apiBadge.textContent = '🔑 คลิกที่นี่เพื่อใส่ Gemini API Key';
      }
    }

    const queueItems = PayrollDB.getQueueItems();
    const qCount = document.getElementById('badge-queue-count');
    if (qCount) qCount.textContent = String(queueItems.length);

    const sheets = PayrollDB.getSavedSheets();
    const sCount = document.getElementById('badge-sheets-count');
    if (sCount) sCount.textContent = `${sheets.length} ใบ`;
  }

  // ===========================================================================
  // TAB NAVIGATION
  // ===========================================================================
  function initTabs() {
    const btns = document.querySelectorAll('.nav-tab-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        switchTab(target);
      });
    });
  }

  function switchTab(tabName) {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const isMatch = btn.getAttribute('data-tab') === tabName;
      if (isMatch) {
        btn.className = 'nav-tab-btn py-3 px-4 text-xs sm:text-sm font-black border-b-2 border-emerald-600 text-emerald-700 flex items-center gap-2 whitespace-nowrap transition-colors';
      } else {
        btn.className = 'nav-tab-btn py-3 px-4 text-xs sm:text-sm font-bold border-b-2 border-transparent text-slate-600 hover:text-slate-900 flex items-center gap-2 whitespace-nowrap transition-colors';
      }
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
      if (panel.id === `tab-panel-${tabName}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    if (tabName === 'review') {
      renderReviewSelectorAndWorkspace();
    } else if (tabName === 'payroll') {
      renderPayrollDashboard();
    } else if (tabName === 'dashboard') {
      renderExecutiveDashboard();
    }
  }

  // ===========================================================================
  // TAB 1: EXCEL TEMPLATE, GEMINI API SETUP & MAPPING TABLES
  // ===========================================================================
  function initConfigAndApiUI() {
    const cfg = PayrollDB.getConfig();
    const inputKey = document.getElementById('input-gemini-api-key');
    const selectModel = document.getElementById('select-gemini-model');
    const btnToggle = document.getElementById('btn-toggle-key-visibility');
    const btnVerify = document.getElementById('btn-verify-gemini-api');
    const resultBox = document.getElementById('box-api-check-result');
    const pill = document.getElementById('api-verify-pill');

    if (inputKey) {
      inputKey.value = cfg.geminiApiKey || '';
      inputKey.addEventListener('input', () => {
        const val = inputKey.value.trim();
        if (val) {
          PayrollDB.saveConfig({ geminiApiKey: val });
          updateHeaderBadges();
        }
      });
    }
    if (selectModel) {
      if (cfg.geminiModel) selectModel.value = cfg.geminiModel;
      selectModel.addEventListener('change', () => {
        PayrollDB.saveConfig({ geminiModel: selectModel.value });
        updateHeaderBadges();
      });
    }

    if (cfg.geminiApiKey && pill) {
      pill.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40';
      pill.textContent = '✅ พร้อมใช้งานทุกอุปกรณ์';
    }

    if (btnToggle && inputKey) {
      btnToggle.addEventListener('click', () => {
        if (inputKey.type === 'password') {
          inputKey.type = 'text';
          btnToggle.textContent = 'ซ่อน';
        } else {
          inputKey.type = 'password';
          btnToggle.textContent = 'แสดง';
        }
      });
    }

    if (btnVerify) {
      btnVerify.addEventListener('click', async () => {
        const keyVal = (inputKey ? inputKey.value : '').trim();
        const modelVal = selectModel ? selectModel.value : 'gemini-2.5-flash';

        btnVerify.disabled = true;
        btnVerify.innerHTML = '<span>⏳ กำลังทดสอบเชื่อมต่อ...</span>';
        if (resultBox) {
          resultBox.classList.remove('hidden');
          resultBox.className = 'p-2.5 rounded-xl text-xs font-bold bg-white/10 text-slate-200';
          resultBox.textContent = 'กำลังส่งคำขอทดสอบไปยัง Google Gemini API...';
        }

        const res = await PayrollDB.verifyGeminiApiKey(keyVal, modelVal);
        btnVerify.disabled = false;
        btnVerify.innerHTML = '<span>🔍 บันทึก & ตรวจเช็ค API</span>';

        if (res.ok) {
          if (selectModel && Array.isArray(res.availableModels) && res.availableModels.length > 0) {
            selectModel.innerHTML = res.availableModels.map(m =>
              `<option value="${escapeHtml(m)}" ${m === res.model ? 'selected' : ''}>⚡ ${escapeHtml(m)}</option>`
            ).join('');
          }
          if (selectModel && res.model) selectModel.value = res.model;
          if (pill) {
            pill.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950';
            pill.textContent = '✅ เชื่อมต่อสำเร็จ';
          }
          if (resultBox) {
            resultBox.className = 'p-2.5 rounded-xl text-xs font-bold bg-emerald-500/25 border border-emerald-400/50 text-emerald-200';
            resultBox.textContent = `✅ ${res.message}`;
          }
          updateHeaderBadges();
        } else {
          if (pill) {
            pill.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white';
            pill.textContent = '❌ เชื่อมต่อไม่สำเร็จ';
          }
          if (resultBox) {
            resultBox.className = 'p-2.5 rounded-xl text-xs font-bold bg-rose-500/25 border border-rose-400/50 text-rose-200';
            resultBox.textContent = `❌ ${res.message}`;
          }
        }
      });
    }

    // Download Excel Template buttons
    const btnHeaderDl = document.getElementById('btn-header-download-template');
    const btnHeroDl = document.getElementById('btn-hero-download-template');
    [btnHeaderDl, btnHeroDl].forEach(b => {
      if (b) {
        b.addEventListener('click', () => {
          PayrollDB.downloadMappingTemplateExcel();
        });
      }
    });

    // Import Excel Mapping files
    const fileHeaderImp = document.getElementById('file-header-import-mapping');
    const fileHeroImp = document.getElementById('file-hero-import-mapping');
    [fileHeaderImp, fileHeroImp].forEach(inp => {
      if (inp) {
        inp.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          try {
            const result = await PayrollDB.importMappingFromExcel(file);
            refreshAllViews();
            alert(`✅ นำเข้าไฟล์จับคู่สำเร็จ!\n- อัปเดตรหัสสินค้า (SKU): ${result.skuCount} รุ่น\n- อัปเดตรายชื่อช่าง: ${result.workerCount} คน`);
          } catch (err) {
            alert(`❌ เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: ${err.message}`);
          } finally {
            inp.value = '';
          }
        });
      }
    });

    // Sync from Google Sheets
    const btnSyncCloud = document.getElementById('btn-sync-cloud-master');
    if (btnSyncCloud) {
      btnSyncCloud.addEventListener('click', async () => {
        btnSyncCloud.disabled = true;
        const origText = btnSyncCloud.innerHTML;
        btnSyncCloud.innerHTML = '<span>⏳ กำลังดึงข้อมูลจาก Google Sheets...</span>';
        try {
          const res = await PayrollDB.syncMasterDataFromCloud();
          refreshAllViews();
          alert(`✅ ซิงค์ข้อมูลล่าสุดจาก Google Sheets เรียบร้อย!\n- อัปเดตเรทค่าแรง: ${res.syncedWageCount} รุ่น\n- อัปเดตรายชื่อช่าง: ${res.syncedWorkerCount} คน`);
        } catch (err) {
          alert(`❌ ซิงค์ไม่สำเร็จ: ${err.message}`);
        } finally {
          btnSyncCloud.disabled = false;
          btnSyncCloud.innerHTML = origText;
        }
      });
    }

    // Live Matcher Test Input
    const inputLiveTest = document.getElementById('input-live-test-sku');
    const badgeLiveTest = document.getElementById('badge-live-test-result');
    if (inputLiveTest && badgeLiveTest) {
      inputLiveTest.addEventListener('input', () => {
        const val = inputLiveTest.value.trim();
        if (!val) {
          badgeLiveTest.className = 'px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 whitespace-nowrap';
          badgeLiveTest.textContent = 'ผลลัพธ์จะแสดงที่นี่';
          return;
        }
        const m = PayrollDB.matchSkuFromText(val);
        if (m.matched) {
          badgeLiveTest.className = 'px-3.5 py-2 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-black text-emerald-900 whitespace-nowrap';
          badgeLiveTest.textContent = `✅ ตรงกับ SKU: ${m.model.toUpperCase()} | หุ้ม ${m.upholsteryWage}฿ / เย็บ ${m.sewingWage}฿`;
        } else {
          badgeLiveTest.className = 'px-3.5 py-2 rounded-xl bg-amber-100 border border-amber-300 text-xs font-bold text-amber-900 whitespace-nowrap';
          badgeLiveTest.textContent = `⚠️ ยังไม่พบในตารางจับคู่ (เพิ่มคำนี้ในตารางด้านล่างได้)`;
        }
      });
    }
  }

  function initMappingTablesUI() {
    // Save SKU Table button
    const btnSaveSku = document.getElementById('btn-save-sku-table');
    if (btnSaveSku) {
      btnSaveSku.addEventListener('click', () => {
        saveSkuTableFromDOM();
        alert('✅ บันทึกตารางจับคู่รหัสสินค้า (SKU) และเรทค่าแรงเรียบร้อยแล้ว!');
      });
    }

    // Add SKU Row button
    const btnAddSku = document.getElementById('btn-add-sku-row');
    if (btnAddSku) {
      btnAddSku.addEventListener('click', () => {
        const modelEl = document.getElementById('new-sku-model');
        const nameEl = document.getElementById('new-sku-name');
        const uphEl = document.getElementById('new-sku-uph');
        const sewEl = document.getElementById('new-sku-sew');
        const aliasEl = document.getElementById('new-sku-aliases');

        const model = (modelEl.value || '').trim().toLowerCase();
        if (!model) {
          alert('กรุณาระบุรหัส SKU เช่น bs4');
          return;
        }
        const name = (nameEl.value || '').trim() || model;
        const uphWage = parseFloat(uphEl.value) || 0;
        const sewWage = parseFloat(sewEl.value) || 0;
        const rawAliases = (aliasEl.value || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!rawAliases.includes(model)) rawAliases.unshift(model);

        saveSkuTableFromDOM();
        const list = PayrollDB.getSkuMappings();
        const existingIdx = list.findIndex(s => s.model.toLowerCase() === model);
        if (existingIdx >= 0) {
          list[existingIdx].name = name;
          list[existingIdx].upholsteryWage = uphWage;
          list[existingIdx].sewingWage = sewWage;
          rawAliases.forEach(a => {
            if (!list[existingIdx].aliases.includes(a)) list[existingIdx].aliases.push(a);
          });
        } else {
          list.unshift({
            model,
            name,
            category: 'กำหนดเอง',
            upholsteryWage: uphWage,
            sewingWage: sewWage,
            aliases: rawAliases,
            note: ''
          });
        }
        PayrollDB.saveSkuMappings(list);
        modelEl.value = '';
        nameEl.value = '';
        uphEl.value = '';
        sewEl.value = '';
        aliasEl.value = '';
        renderSkuMappingTable();
      });
    }

    // Save Worker Table button
    const btnSaveWorker = document.getElementById('btn-save-worker-table');
    if (btnSaveWorker) {
      btnSaveWorker.addEventListener('click', () => {
        saveWorkerTableFromDOM();
        alert('✅ บันทึกตารางจับคู่รายชื่อช่างเรียบร้อยแล้ว!');
      });
    }

    // Add Worker Row button
    const btnAddWorker = document.getElementById('btn-add-worker-row');
    if (btnAddWorker) {
      btnAddWorker.addEventListener('click', () => {
        const codeEl = document.getElementById('new-worker-code');
        const nameEl = document.getElementById('new-worker-name');
        const deptEl = document.getElementById('new-worker-dept');
        const aliasEl = document.getElementById('new-worker-aliases');

        const code = (codeEl.value || '').trim();
        const name = (nameEl.value || '').trim();
        if (!code || !name) {
          alert('กรุณาระบุรหัสช่างและชื่อช่างจริง');
          return;
        }
        const dept = deptEl.value || 'หุ้ม';
        const rawAliases = (aliasEl.value || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!rawAliases.includes(name)) rawAliases.unshift(name);
        if (!rawAliases.includes(code)) rawAliases.push(code);

        saveWorkerTableFromDOM();
        const list = PayrollDB.getWorkerMappings();
        list.unshift({ code, name, dept, aliases: rawAliases });
        PayrollDB.saveWorkerMappings(list);

        codeEl.value = '';
        nameEl.value = '';
        aliasEl.value = '';
        renderWorkerMappingTable();
      });
    }
  }

  function renderSkuMappingTable() {
    const tbody = document.getElementById('tbody-sku-mapping');
    const countBadge = document.getElementById('count-sku-models');
    if (!tbody) return;

    const list = PayrollDB.getSkuMappings();
    if (countBadge) countBadge.textContent = `${list.length} รุ่น`;

    tbody.innerHTML = list.map((item, idx) => {
      const aliasesStr = (item.aliases || []).join(', ');
      return `
        <tr class="hover:bg-slate-50/80" data-sku-idx="${idx}">
          <td class="py-2 px-3">
            <input type="text" class="sku-row-model w-full px-2 py-1 font-mono font-black text-indigo-700 bg-indigo-50/60 border border-indigo-200 rounded-lg text-xs" value="${escapeHtml(item.model)}">
          </td>
          <td class="py-2 px-3">
            <input type="text" class="sku-row-name w-full px-2 py-1 text-slate-800 border border-slate-200 rounded-lg text-xs" value="${escapeHtml(item.name)}">
          </td>
          <td class="py-2 px-2 bg-amber-50/30">
            <input type="number" class="sku-row-uph w-full px-2 py-1 text-right font-mono font-bold text-amber-900 bg-white border border-amber-300 rounded-lg text-xs" value="${Number(item.upholsteryWage) || 0}">
          </td>
          <td class="py-2 px-2 bg-emerald-50/30">
            <input type="number" class="sku-row-sew w-full px-2 py-1 text-right font-mono font-bold text-emerald-900 bg-white border border-emerald-300 rounded-lg text-xs" value="${Number(item.sewingWage) || 0}">
          </td>
          <td class="py-2 px-3">
            <input type="text" class="sku-row-aliases w-full px-2.5 py-1 font-medium text-slate-900 bg-white border border-slate-300 focus:border-indigo-500 rounded-lg text-xs" value="${escapeHtml(aliasesStr)}" placeholder="เช่น 3<>11, 3 ข้าวหลามตัด 11">
          </td>
          <td class="py-2 px-2 text-center">
            <button type="button" class="btn-del-sku text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5" data-idx="${idx}" title="ลบรุ่นนี้">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    let skuSaveFeedbackTimer = null;
    const triggerSkuAutoSave = () => {
      saveSkuTableFromDOM();
      const btnSaveSku = document.getElementById('btn-save-sku-table');
      if (btnSaveSku) {
        btnSaveSku.textContent = '✅ บันทึกอัตโนมัติแล้ว!';
        if (skuSaveFeedbackTimer) clearTimeout(skuSaveFeedbackTimer);
        skuSaveFeedbackTimer = setTimeout(() => {
          btnSaveSku.textContent = '💾 บันทึกการแก้ไขตาราง';
        }, 2000);
      }
    };

    tbody.querySelectorAll('.sku-row-model, .sku-row-name, .sku-row-uph, .sku-row-sew, .sku-row-aliases').forEach(inp => {
      inp.addEventListener('input', triggerSkuAutoSave);
      inp.addEventListener('change', triggerSkuAutoSave);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerSkuAutoSave();
          inp.blur();
        }
      });
    });

    tbody.querySelectorAll('.btn-del-sku').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        saveSkuTableFromDOM();
        const current = PayrollDB.getSkuMappings();
        current.splice(idx, 1);
        PayrollDB.saveSkuMappings(current);
        renderSkuMappingTable();
      });
    });
  }

  function saveSkuTableFromDOM() {
    const tbody = document.getElementById('tbody-sku-mapping');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr[data-sku-idx]');
    const newList = [];
    rows.forEach(tr => {
      const model = (tr.querySelector('.sku-row-model')?.value || '').trim().toLowerCase();
      if (!model) return;
      const name = (tr.querySelector('.sku-row-name')?.value || '').trim() || model;
      const upholsteryWage = parseFloat(tr.querySelector('.sku-row-uph')?.value) || 0;
      const sewingWage = parseFloat(tr.querySelector('.sku-row-sew')?.value) || 0;
      const aliasesRaw = (tr.querySelector('.sku-row-aliases')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!aliasesRaw.some(a => a.toLowerCase() === model)) {
        aliasesRaw.unshift(model);
      }
      newList.push({
        model,
        name,
        upholsteryWage,
        sewingWage,
        aliases: aliasesRaw
      });
    });
    if (newList.length > 0) {
      PayrollDB.saveSkuMappings(newList);
    }
  }

  function renderWorkerMappingTable() {
    const tbody = document.getElementById('tbody-worker-mapping');
    const countBadge = document.getElementById('count-workers');
    if (!tbody) return;

    const list = PayrollDB.getWorkerMappings();
    if (countBadge) countBadge.textContent = `${list.length} คน`;

    tbody.innerHTML = list.map((w, idx) => {
      const aliasesStr = (w.aliases || []).join(', ');
      return `
        <tr class="hover:bg-slate-50/80" data-worker-idx="${idx}">
          <td class="py-2 px-2.5">
            <input type="text" class="worker-row-code w-full px-1.5 py-1 font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg text-xs" value="${escapeHtml(w.code)}">
          </td>
          <td class="py-2 px-2.5">
            <input type="text" class="worker-row-name w-full px-2 py-1 font-bold text-slate-900 border border-slate-200 rounded-lg text-xs" value="${escapeHtml(w.name)}">
          </td>
          <td class="py-2 px-2">
            <select class="worker-row-dept w-full px-1.5 py-1 font-bold rounded-lg border text-xs ${w.dept === 'เย็บ' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-amber-50 text-amber-900 border-amber-300'}">
              <option value="หุ้ม" ${w.dept === 'หุ้ม' ? 'selected' : ''}>🔨 หุ้ม</option>
              <option value="เย็บ" ${w.dept === 'เย็บ' ? 'selected' : ''}>🧵 เย็บ</option>
            </select>
          </td>
          <td class="py-2 px-2.5">
            <input type="text" class="worker-row-aliases w-full px-2 py-1 text-slate-800 bg-white border border-slate-300 rounded-lg text-xs" value="${escapeHtml(aliasesStr)}" placeholder="เช่น Blai Morn, Blai Mon">
          </td>
          <td class="py-2 px-2 text-center">
            <button type="button" class="btn-del-worker text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5" data-idx="${idx}" title="ลบช่างคนนี้">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    let workerSaveFeedbackTimer = null;
    const triggerWorkerAutoSave = () => {
      saveWorkerTableFromDOM();
      const btnSaveWorker = document.getElementById('btn-save-worker-table');
      if (btnSaveWorker) {
        btnSaveWorker.textContent = '✅ บันทึกอัตโนมัติแล้ว!';
        if (workerSaveFeedbackTimer) clearTimeout(workerSaveFeedbackTimer);
        workerSaveFeedbackTimer = setTimeout(() => {
          btnSaveWorker.textContent = '💾 บันทึกตารางช่าง';
        }, 2000);
      }
    };

    tbody.querySelectorAll('.worker-row-code, .worker-row-name, .worker-row-dept, .worker-row-aliases').forEach(inp => {
      inp.addEventListener('input', triggerWorkerAutoSave);
      inp.addEventListener('change', triggerWorkerAutoSave);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerWorkerAutoSave();
          inp.blur();
        }
      });
    });

    tbody.querySelectorAll('.btn-del-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        saveWorkerTableFromDOM();
        const current = PayrollDB.getWorkerMappings();
        current.splice(idx, 1);
        PayrollDB.saveWorkerMappings(current);
        renderWorkerMappingTable();
      });
    });
  }

  function saveWorkerTableFromDOM() {
    const tbody = document.getElementById('tbody-worker-mapping');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr[data-worker-idx]');
    const newList = [];
    rows.forEach(tr => {
      const code = (tr.querySelector('.worker-row-code')?.value || '').trim();
      const name = (tr.querySelector('.worker-row-name')?.value || '').trim();
      if (!code && !name) return;
      const dept = tr.querySelector('.worker-row-dept')?.value || 'หุ้ม';
      const aliasesRaw = (tr.querySelector('.worker-row-aliases')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      if (name && !aliasesRaw.includes(name)) aliasesRaw.unshift(name);
      if (code && !aliasesRaw.includes(code)) aliasesRaw.push(code);
      newList.push({ code, name, dept, aliases: aliasesRaw });
    });
    if (newList.length > 0) {
      PayrollDB.saveWorkerMappings(newList);
    }
  }

  // ===========================================================================
  // TAB 2: RAPID CAMERA CAPTURE & DRAG-AND-DROP QUEUE
  // ===========================================================================
  function initScannerAndCameraUI() {
    const btnStartCam = document.getElementById('btn-start-camera');
    const btnStartCamCenter = document.getElementById('btn-start-camera-center');
    const btnStopCam = document.getElementById('btn-stop-camera');
    const btnShutter = document.getElementById('btn-shutter-capture');
    const inputNativeCam = document.getElementById('input-native-camera');
    const fileBatchImages = document.getElementById('file-batch-images');
    const dropzone = document.getElementById('dropzone-sheets');
    const btnProcessAll = document.getElementById('btn-process-all-queue');
    const btnClearFinished = document.getElementById('btn-clear-finished-queue');
    const btnSample = document.getElementById('btn-load-sample-sheet');
    const btnReviewSample = document.getElementById('btn-review-load-sample');
    const btnManualSheet = document.getElementById('btn-create-manual-sheet');

    [btnStartCam, btnStartCamCenter].forEach(b => {
      if (b) b.addEventListener('click', startLiveCamera);
    });
    if (btnStopCam) btnStopCam.addEventListener('click', stopLiveCamera);
    if (btnShutter) btnShutter.addEventListener('click', captureFrameFromCamera);

    // Spacebar shortcut for rapid shutter capture when on scanner tab
    document.addEventListener('keydown', (e) => {
      const scannerPanel = document.getElementById('tab-panel-scanner');
      if (e.code === 'Space' && cameraStream && scannerPanel && !scannerPanel.classList.contains('hidden')) {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        captureFrameFromCamera();
      }
    });

    if (inputNativeCam) {
      inputNativeCam.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          enqueueImageFiles(Array.from(e.target.files));
          inputNativeCam.value = '';
        }
      });
    }

    if (fileBatchImages) {
      fileBatchImages.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          enqueueImageFiles(Array.from(e.target.files));
          fileBatchImages.value = '';
        }
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-indigo-600', 'bg-indigo-100/60');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-indigo-600', 'bg-indigo-100/60');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-600', 'bg-indigo-100/60');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          enqueueImageFiles(Array.from(e.dataTransfer.files));
        }
      });
    }

    if (btnProcessAll) {
      btnProcessAll.addEventListener('click', () => {
        processAllPendingQueue();
      });
    }

    if (btnClearFinished) {
      btnClearFinished.addEventListener('click', async () => {
        await PayrollDB.clearFinishedQueueItems();
        renderQueueList();
        updateHeaderBadges();
      });
    }

    // Load Sample Sheet (Blai Morn 15.6.69)
    [btnSample, btnReviewSample].forEach(b => {
      if (b) {
        b.addEventListener('click', () => {
          const sample = PayrollDB.createSampleBlaiMornSheet();
          const saved = PayrollDB.upsertSheet(sample);
          activeSheetId = saved.id;
          refreshAllViews();
          switchTab('review');
        });
      }
    });

    // Create Blank Manual Sheet
    if (btnManualSheet) {
      btnManualSheet.addEventListener('click', () => {
        const today = new Date().toISOString().slice(0, 10);
        const period = PayrollDB.calculatePayrollPeriod(today);
        const workers = PayrollDB.getWorkerMappings();
        const firstW = workers[0] || { code: 'cv1', name: 'นาย', dept: 'หุ้ม' };
        const newSheet = PayrollDB.upsertSheet({
          id: 'SH-MANUAL-' + Date.now(),
          createdAt: new Date().toISOString(),
          imageDataUrl: '',
          rawWorkerName: firstW.name,
          workerCode: firstW.code,
          workerName: firstW.name,
          workerDept: firstW.dept,
          isWorkerMatched: true,
          rawDate: today,
          sheetDate: today,
          specialNote: '',
          isLateCarryOver: false,
          payrollPeriodKey: period.periodKey,
          status: 'VERIFIED',
          items: [
            { rowNo: 1, rawModel: 'ln3', matchedSku: 'ln3', skuName: 'โซฟา 3 ที่นั่งกระดุมวางแก้ว (ln3)', isMatched: true, color: '', qty: 1, channel: '', foamBy: '', stockReceiver: '', unitRate: 140, lineTotal: 140 }
          ]
        });
        activeSheetId = newSheet.id;
        refreshAllViews();
        switchTab('review');
      });
    }
  }

  async function startLiveCamera() {
    const video = document.getElementById('camera-video');
    const placeholder = document.getElementById('camera-placeholder');
    const btnStart = document.getElementById('btn-start-camera');
    const btnStop = document.getElementById('btn-stop-camera');
    const btnShutter = document.getElementById('btn-shutter-capture');

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 }
        },
        audio: false
      });
      if (video) {
        video.srcObject = cameraStream;
        video.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnStart) btnStart.classList.add('hidden');
      if (btnStop) btnStop.classList.remove('hidden');
      if (btnShutter) btnShutter.disabled = false;
    } catch (err) {
      alert(`ไม่สามารถเปิดกล้องบนเบราว์เซอร์ได้ (${err.message})\nคุณสามารถใช้ปุ่ม "📸 เปิดแอปกล้องมือถือ" หรือลากไฟล์รูปใบงานลงในช่องขวามือได้ทันทีครับ`);
    }
  }

  function stopLiveCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    const video = document.getElementById('camera-video');
    const placeholder = document.getElementById('camera-placeholder');
    const btnStart = document.getElementById('btn-start-camera');
    const btnStop = document.getElementById('btn-stop-camera');
    const btnShutter = document.getElementById('btn-shutter-capture');

    if (video) video.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (btnStart) btnStart.classList.remove('hidden');
    if (btnStop) btnStop.classList.add('hidden');
    if (btnShutter) btnShutter.disabled = true;
  }

  function captureFrameFromCamera() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const flash = document.getElementById('camera-flash-overlay');
    if (!video || !canvas || !cameraStream) return;

    // Visual shutter flash
    if (flash) {
      flash.classList.remove('shutter-flash');
      void flash.offsetWidth;
      flash.classList.add('shutter-flash');
    }

    const maxDim = 1280;
    let w = video.videoWidth || 1280;
    let h = video.videoHeight || 960;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
    const currentQ = PayrollDB.getQueueItems();
    const item = {
      id: 'Q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      name: `ภาพถ่ายใบงาน #${currentQ.length + 1} (${new Date().toLocaleTimeString('th-TH')})`,
      imageDataUrl: dataUrl,
      status: 'PENDING',
      errorMsg: '',
      sheetId: null,
      createdAt: new Date().toISOString()
    };
    PayrollDB.upsertQueueItem(item, true);
    renderQueueList();
    updateHeaderBadges();

    const autoScan = document.getElementById('chk-auto-ai-scan')?.checked;
    if (autoScan) {
      drainAutoScanQueue();
    }
  }

  let isAutoScanDraining = false;
  const activeProcessingQueueIds = new Set();
  const recentUploadedFileSigs = new Map();

  async function drainAutoScanQueue() {
    if (isAutoScanDraining) return;
    isAutoScanDraining = true;
    try {
      while (true) {
        const nextPending = PayrollDB.getQueueItems().find(
          q => q.status === 'PENDING' && !activeProcessingQueueIds.has(q.id)
        );
        if (!nextPending) break;
        await processQueueItem(nextPending.id);
      }
    } finally {
      isAutoScanDraining = false;
    }
  }

  function enqueueImageFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const autoScan = Boolean(document.getElementById('chk-auto-ai-scan')?.checked);
    const nowMs = Date.now();

    imageFiles.forEach((file, idx) => {
      const fileSig = `${file.name || ''}_${file.size || 0}_${file.lastModified || 0}`;
      const prevTime = recentUploadedFileSigs.get(fileSig) || 0;
      if (file.name && (nowMs - prevTime) < 45000) {
        // Prevent accidental double-upload of the exact same file within 45 seconds
        return;
      }
      recentUploadedFileSigs.set(fileSig, nowMs);

      const reader = new FileReader();
      reader.onload = (e) => {
        resizeImageDataUrl(e.target.result, 1050, 0.68).then(resizedUrl => {
          const item = {
            id: 'Q-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
            name: file.name || `ภาพใบงาน (${new Date().toLocaleTimeString('th-TH')})`,
            imageDataUrl: resizedUrl,
            status: 'PENDING',
            errorMsg: '',
            sheetId: null,
            createdAt: new Date().toISOString()
          };
          // If autoScan is enabled on this device, scan locally first and push the resulting lightweight Sheet to Cloud
          PayrollDB.upsertQueueItem(item, !autoScan);
          renderQueueList();
          updateHeaderBadges();

          if (autoScan) {
            drainAutoScanQueue();
          }
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function resizeImageDataUrl(dataUrl, maxDim = 1050, quality = 0.68) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function stitchImagesVertically(topDataUrl, bottomDataUrl, targetWidth = 1000, quality = 0.68) {
    if (!topDataUrl || !topDataUrl.startsWith('data:image')) return Promise.resolve(bottomDataUrl || '');
    if (!bottomDataUrl || !bottomDataUrl.startsWith('data:image')) return Promise.resolve(topDataUrl);
    return new Promise((resolve) => {
      const imgTop = new Image();
      const imgBot = new Image();
      let loaded = 0;
      const onBothLoaded = () => {
        loaded++;
        if (loaded < 2) return;
        try {
          const w = targetWidth;
          const hTop = Math.round((imgTop.height * w) / (imgTop.width || w));
          const hBot = Math.round((imgBot.height * w) / (imgBot.width || w));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = hTop + hBot + 8;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(imgTop, 0, 0, w, hTop);
          ctx.drawImage(imgBot, 0, hTop + 8, w, hBot);
          resolve(c.toDataURL('image/jpeg', quality));
        } catch (e) {
          resolve(topDataUrl);
        }
      };
      imgTop.onload = onBothLoaded;
      imgTop.onerror = () => resolve(bottomDataUrl);
      imgBot.onload = onBothLoaded;
      imgBot.onerror = () => resolve(topDataUrl);
      imgTop.src = topDataUrl;
      imgBot.src = bottomDataUrl;
    });
  }

  async function processQueueItem(queueId) {
    if (!queueId || activeProcessingQueueIds.has(queueId)) return;
    const queueItems = PayrollDB.getQueueItems();
    const item = queueItems.find(q => q.id === queueId);
    if (!item || item.status === 'PROCESSING' || item.status === 'DONE') return;

    if (!PayrollDB.getConfig().geminiApiKey) {
      const entered = prompt('🔑 เครื่องนี้ยังไม่ได้ใส่ Gemini API Key\nกรุณาวาง Gemini API Key ของคุณที่นี่ (ใส่ครั้งเดียวระบบจะซิงค์ให้ทุกเครื่องอัตโนมัติ):');
      if (entered && entered.trim()) {
        PayrollDB.saveConfig({ geminiApiKey: entered.trim() });
        const inputKey = document.getElementById('input-gemini-api-key');
        if (inputKey) inputKey.value = entered.trim();
        updateHeaderBadges();
      }
    }

    activeProcessingQueueIds.add(queueId);
    item.status = 'PROCESSING';
    item.errorMsg = '';
    PayrollDB.upsertQueueItem(item, false);
    renderQueueList();

    try {
      const parsedSheet = await PayrollDB.analyzeJobSheetWithGemini(item.imageDataUrl);
      const saved = PayrollDB.upsertSheet(parsedSheet);
      item.status = 'DONE';
      item.sheetId = saved.id;
      PayrollDB.upsertQueueItem(item, true);
      activeSheetId = saved.id;
      refreshAllViews();
    } catch (err) {
      item.status = 'ERROR';
      item.errorMsg = err.message || 'เกิดข้อผิดพลาดในการอ่านรูปใบงาน';
      PayrollDB.upsertQueueItem(item, true);
      renderQueueList();
    } finally {
      activeProcessingQueueIds.delete(queueId);
    }
  }

  async function processAllPendingQueue() {
    const queueItems = PayrollDB.getQueueItems();
    const pendingOrError = queueItems.filter(q => q.status === 'PENDING' || q.status === 'ERROR');
    if (pendingOrError.length === 0) {
      if (isAutoScanDraining) {
        return;
      }
      alert('ไม่มีรายการที่รออ่านในคิว');
      return;
    }
    pendingOrError.forEach(q => {
      if (q.status === 'ERROR') {
        q.status = 'PENDING';
        q.errorMsg = '';
      }
    });
    renderQueueList();
    await drainAutoScanQueue();
  }

  function renderQueueList() {
    const container = document.getElementById('queue-list-container');
    if (!container) return;

    const queueItems = PayrollDB.getQueueItems();
    if (queueItems.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          ยังไม่มีใบงานในคิว (สามารถใช้มือถือถ่ายรูปใบงาน แล้วเปิดดูบนจอคอมพิวเตอร์นี้ได้ทันทีครับ)
        </div>
      `;
      return;
    }

    container.innerHTML = queueItems.map(q => {
      let badgeHtml = '';
      if (q.status === 'PENDING') {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">☁️ รออ่าน</span>`;
      } else if (q.status === 'PROCESSING') {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">⏳ AI กำลังอ่าน...</span>`;
      } else if (q.status === 'DONE') {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">✅ อ่านสำเร็จ</span>`;
      } else {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">❌ ไม่สำเร็จ</span>`;
      }

      return `
        <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <img src="${q.imageDataUrl}" class="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-slate-800 truncate">${escapeHtml(q.name)}</div>
              ${q.errorMsg ? `<div class="text-[11px] text-rose-600 font-semibold break-words leading-snug mt-0.5">${escapeHtml(q.errorMsg)}</div>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${badgeHtml}
            ${q.status === 'DONE' && q.sheetId ? `<button type="button" class="btn-open-done-sheet px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px]" data-sheet-id="${q.sheetId}">ดูผลลัพธ์</button>` : ''}
            ${(q.status === 'PENDING' || q.status === 'ERROR') ? `<button type="button" class="btn-retry-queue px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px]" data-qid="${q.id}">อ่านด้วย AI</button>` : ''}
            <button type="button" class="btn-del-queue-item px-1.5 py-1 text-slate-400 hover:text-rose-600 font-bold text-xs" data-qid="${q.id}" title="ลบออกจากคิว">✕</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-open-done-sheet').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSheetId = btn.getAttribute('data-sheet-id');
        switchTab('review');
      });
    });

    container.querySelectorAll('.btn-retry-queue').forEach(btn => {
      btn.addEventListener('click', () => {
        processQueueItem(btn.getAttribute('data-qid'));
      });
    });

    container.querySelectorAll('.btn-del-queue-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qid = btn.getAttribute('data-qid');
        await PayrollDB.deleteQueueItem(qid, true);
        renderQueueList();
        updateHeaderBadges();
      });
    });
  }

  // ===========================================================================
  // TAB 3: SIDE-BY-SIDE REVIEW & VERIFY WORKSPACE
  // ===========================================================================
  function initReviewWorkspaceUI() {
    const selectSheet = document.getElementById('select-review-sheet');
    const btnPrev = document.getElementById('btn-prev-sheet');
    const btnNext = document.getElementById('btn-next-sheet');
    const btnDelete = document.getElementById('btn-delete-current-sheet');
    const btnRescan = document.getElementById('btn-rescan-current-sheet');

    // Image Zoom & Rotate buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnRotate = document.getElementById('btn-rotate-img');
    const btnResetImg = document.getElementById('btn-reset-img');

    if (btnZoomIn) btnZoomIn.addEventListener('click', () => { imgZoom = Math.min(3, imgZoom + 0.25); applyImageTransform(); });
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => { imgZoom = Math.max(0.5, imgZoom - 0.25); applyImageTransform(); });
    if (btnRotate) btnRotate.addEventListener('click', () => { imgRotation = (imgRotation + 90) % 360; applyImageTransform(); });
    if (btnResetImg) btnResetImg.addEventListener('click', () => { imgZoom = 1; imgRotation = 0; applyImageTransform(); });

    if (selectSheet) {
      selectSheet.addEventListener('change', () => {
        activeSheetId = selectSheet.value;
        renderReviewSelectorAndWorkspace();
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        const sheets = PayrollDB.getSavedSheets();
        const idx = sheets.findIndex(s => s.id === activeSheetId);
        if (idx > 0) {
          activeSheetId = sheets[idx - 1].id;
          renderReviewSelectorAndWorkspace();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const sheets = PayrollDB.getSavedSheets();
        const idx = sheets.findIndex(s => s.id === activeSheetId);
        if (idx >= 0 && idx < sheets.length - 1) {
          activeSheetId = sheets[idx + 1].id;
          renderReviewSelectorAndWorkspace();
        }
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (!activeSheetId) return;
        if (!confirm('ต้องการลบใบงานนี้ออกจากระบบใช่หรือไม่?')) return;
        PayrollDB.deleteSheet(activeSheetId);
        const remaining = PayrollDB.getSavedSheets();
        activeSheetId = remaining[0]?.id || null;
        refreshAllViews();
      });
    }

    if (btnRescan) {
      btnRescan.addEventListener('click', async () => {
        const sheet = getActiveSheet();
        if (!sheet) return;
        if (!sheet.imageDataUrl && typeof PayrollDB.fetchSheetImage === 'function') {
          await PayrollDB.fetchSheetImage(sheet.id);
        }
        if (!sheet.imageDataUrl) {
          alert('ใบงานนี้ยังไม่มีรูปภาพต้นฉบับ กรุณากดปุ่ม "📷 แนบ/เปลี่ยนรูปใบงานนี้" ด้านซ้ายมือก่อนครับ');
          return;
        }
        btnRescan.disabled = true;
        btnRescan.textContent = '⏳ กำลังอ่านใหม่...';
        try {
          const fresh = await PayrollDB.analyzeJobSheetWithGemini(sheet.imageDataUrl);
          fresh.id = sheet.id;
          PayrollDB.upsertSheet(fresh);
          refreshAllViews();
        } catch (err) {
          alert(`❌ ไม่สามารถให้ AI อ่านใหม่ได้: ${err.message}`);
        } finally {
          btnRescan.disabled = false;
          btnRescan.textContent = '🔄 ให้ AI อ่านใบนี้ใหม่';
        }
      });
    }

    const inputAttachPhoto = document.getElementById('input-attach-sheet-photo');
    if (inputAttachPhoto) {
      inputAttachPhoto.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const sheet = getActiveSheet();
        if (!sheet) {
          inputAttachPhoto.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const resizedUrl = await resizeImageDataUrl(ev.target.result, 1050, 0.68);
            syncReviewTableToSheetObject(sheet);
            sheet.imageDataUrl = resizedUrl;
            sheet.hasCloudImage = true;
            PayrollDB.upsertSheet(sheet);
            renderReviewSelectorAndWorkspace();
          } catch (err) {
            console.warn('Attach sheet photo error:', err);
          } finally {
            inputAttachPhoto.value = '';
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Worker selection & Learn Worker Alias
    const selectWorker = document.getElementById('review-select-worker');
    if (selectWorker) {
      selectWorker.addEventListener('change', () => {
        const sheet = getActiveSheet();
        if (!sheet) return;
        const workers = PayrollDB.getWorkerMappings();
        const w = workers.find(x => x.code === selectWorker.value);
        if (w) {
          sheet.workerCode = w.code;
          sheet.workerName = w.name;
          sheet.workerDept = w.dept;
          sheet.isWorkerMatched = true;
          PayrollDB.upsertSheet(sheet);
          renderReviewSelectorAndWorkspace();
        }
      });
    }

    const btnLearnWorker = document.getElementById('btn-learn-worker-alias');
    if (btnLearnWorker) {
      btnLearnWorker.addEventListener('click', () => {
        const sheet = getActiveSheet();
        if (!sheet || !sheet.rawWorkerName || !sheet.workerCode) return;
        PayrollDB.learnWorkerAlias(sheet.rawWorkerName, sheet.workerCode);
        renderWorkerMappingTable();
        alert(`📌 จำชื่อ "${sheet.rawWorkerName}" คู่กับช่าง "${sheet.workerName} (${sheet.workerCode})" เรียบร้อยแล้ว!`);
      });
    }

    // Sheet Date & Period changes
    const inputDate = document.getElementById('review-input-date');
    if (inputDate) {
      inputDate.addEventListener('change', () => {
        const sheet = getActiveSheet();
        if (!sheet) return;
        sheet.sheetDate = inputDate.value;
        const p = PayrollDB.calculatePayrollPeriod(sheet.sheetDate);
        sheet.payrollPeriodKey = p.periodKey;
        PayrollDB.upsertSheet(sheet);
        renderReviewSelectorAndWorkspace();
      });
    }

    const selectPeriod = document.getElementById('review-select-period');
    if (selectPeriod) {
      selectPeriod.addEventListener('change', () => {
        const sheet = getActiveSheet();
        if (!sheet) return;
        sheet.payrollPeriodKey = selectPeriod.value;
        PayrollDB.upsertSheet(sheet);
        renderReviewSelectorAndWorkspace();
      });
    }

    const btnShiftNextPeriod = document.getElementById('btn-shift-next-period');
    if (btnShiftNextPeriod) {
      btnShiftNextPeriod.addEventListener('click', () => {
        const sheet = getActiveSheet();
        if (!sheet) return;
        const baseP = PayrollDB.calculatePayrollPeriod(sheet.sheetDate);
        sheet.payrollPeriodKey = PayrollDB.getNextPayrollPeriodKey(baseP.periodKey);
        sheet.isLateCarryOver = true;
        PayrollDB.upsertSheet(sheet);
        renderReviewSelectorAndWorkspace();
      });
    }

    // Add Row, Append Continuation Sheet (Page 2+) & Save Verified Sheet
    const inputAppendCont = document.getElementById('input-append-continuation-sheet');
    const lblAppendCont = document.getElementById('lbl-append-continuation-sheet');
    if (inputAppendCont) {
      inputAppendCont.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;
        const sheet = getActiveSheet();
        if (!sheet) {
          inputAppendCont.value = '';
          return;
        }

        syncReviewTableToSheetObject(sheet);
        if (!sheet.imageDataUrl && typeof PayrollDB.fetchSheetImage === 'function') {
          await PayrollDB.fetchSheetImage(sheet.id);
        }

        const origHtml = lblAppendCont ? lblAppendCont.innerHTML : '';
        if (lblAppendCont) {
          lblAppendCont.classList.add('opacity-60', 'pointer-events-none');
          lblAppendCont.innerHTML = '<span>⏳ AI กำลังอ่านใบต่อแล้วนำมาต่อท้าย...</span>';
        }

        let addedRowsCount = 0;
        try {
          for (const file of files) {
            const rawUrl = await new Promise((res, rej) => {
              const r = new FileReader();
              r.onload = (ev) => res(ev.target.result);
              r.onerror = rej;
              r.readAsDataURL(file);
            });
            const resizedUrl = await resizeImageDataUrl(rawUrl, 1050, 0.68);
            const parsedCont = await PayrollDB.analyzeJobSheetWithGemini(resizedUrl);
            const contItems = Array.isArray(parsedCont.items) ? parsedCont.items : [];
            if (contItems.length > 0) {
              contItems.forEach((it) => {
                sheet.items.push({
                  ...it,
                  rowNo: sheet.items.length + 1
                });
              });
              addedRowsCount += contItems.length;
            }
            if (sheet.imageDataUrl && sheet.imageDataUrl.startsWith('data:image')) {
              sheet.imageDataUrl = await stitchImagesVertically(sheet.imageDataUrl, resizedUrl, 1000, 0.66);
            } else {
              sheet.imageDataUrl = resizedUrl;
            }
            sheet.hasCloudImage = true;
          }

          PayrollDB.upsertSheet(sheet);
          refreshAllViews();
          alert(`✅ สแกนเพิ่มใบต่อสำเร็จ!\n- เพิ่มรายการต่อท้ายอีก: ${addedRowsCount} แถว\n- รวมใบงานนี้ทั้งหมด: ${sheet.items.length} แถว (${sheet.totalUnits} ชิ้น = ${sheet.totalWage.toLocaleString()} บาท)`);
        } catch (err) {
          alert(`❌ ไม่สามารถอ่านใบต่อได้: ${err.message || err}`);
        } finally {
          if (lblAppendCont) {
            lblAppendCont.classList.remove('opacity-60', 'pointer-events-none');
            lblAppendCont.innerHTML = origHtml || '<span>➕ สแกนเพิ่มใบต่อ (แผ่นที่ 2+)</span>';
          }
          inputAppendCont.value = '';
        }
      });
    }

    const btnAddRow = document.getElementById('btn-add-review-item');
    if (btnAddRow) {
      btnAddRow.addEventListener('click', () => {
        const sheet = getActiveSheet();
        if (!sheet) return;
        syncReviewTableToSheetObject(sheet);
        sheet.items.push({
          rowNo: sheet.items.length + 1,
          rawModel: '',
          matchedSku: 'ln3',
          skuName: '',
          isMatched: true,
          color: '',
          qty: 1,
          channel: '',
          foamBy: '',
          stockReceiver: '',
          unitRate: 0,
          lineTotal: 0
        });
        PayrollDB.upsertSheet(sheet);
        renderReviewSelectorAndWorkspace();
      });
    }

    const btnSaveSheet = document.getElementById('btn-save-verified-sheet');
    if (btnSaveSheet) {
      btnSaveSheet.addEventListener('click', () => {
        const sheet = getActiveSheet();
        if (!sheet) return;
        syncReviewTableToSheetObject(sheet);
        sheet.status = 'VERIFIED';
        PayrollDB.upsertSheet(sheet);
        refreshAllViews();
        alert(`✅ บันทึกใบงานของคุณ "${sheet.workerName}" (รวม ${sheet.totalUnits} ชิ้น = ${sheet.totalWage.toLocaleString()} บาท) เข้าสรุปงวดจ่ายเงินเรียบร้อย!`);
      });
    }
  }

  function applyImageTransform() {
    const img = document.getElementById('review-sheet-image');
    const lbl = document.getElementById('label-zoom-level');
    if (img) {
      img.style.transform = `scale(${imgZoom}) rotate(${imgRotation}deg)`;
    }
    if (lbl) {
      lbl.textContent = `${Math.round(imgZoom * 100)}%`;
    }
  }

  function getActiveSheet() {
    const sheets = PayrollDB.getSavedSheets();
    if (sheets.length === 0) return null;
    let found = sheets.find(s => s.id === activeSheetId);
    if (!found) {
      found = sheets[0];
      activeSheetId = found.id;
    }
    return found;
  }

  function buildPeriodOptionsList(centerDateStr) {
    const baseDate = centerDateStr ? new Date(centerDateStr) : new Date();
    const year = baseDate.getFullYear();
    const keys = [];
    for (let y = year - 1; y <= year + 1; y++) {
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0');
        keys.push(`${y}-${mm}-P1`);
        keys.push(`${y}-${mm}-P2`);
      }
    }
    return keys;
  }

  function renderReviewSelectorAndWorkspace() {
    const sheets = PayrollDB.getSavedSheets();
    const selectSheet = document.getElementById('select-review-sheet');
    const emptyState = document.getElementById('review-empty-state');
    const workspace = document.getElementById('review-workspace');

    if (sheets.length === 0) {
      if (selectSheet) selectSheet.innerHTML = `<option value="">-- ยังไม่มีใบงาน --</option>`;
      if (emptyState) emptyState.classList.remove('hidden');
      if (workspace) workspace.classList.add('hidden');
      return;
    }

    const sheet = getActiveSheet();
    if (emptyState) emptyState.classList.add('hidden');
    if (workspace) workspace.classList.remove('hidden');

    if (selectSheet) {
      selectSheet.innerHTML = sheets.map((s, i) => {
        const pMeta = PayrollDB.getPeriodMetaFromKey(s.payrollPeriodKey);
        return `<option value="${s.id}" ${s.id === sheet.id ? 'selected' : ''}>ใบที่ ${i + 1}: ${s.workerName} (${s.sheetDate}) - ${s.totalUnits || 0} ชิ้น / ${(s.totalWage || 0).toLocaleString()}฿ [${pMeta.periodLabel}]</option>`;
      }).join('');
    }

    // Image (Lazy-loaded on demand from IndexedDB / QC_PAYROLL_IMAGE; NEVER fallback to sample Blai Morn photo for real sheets!)
    const imgEl = document.getElementById('review-sheet-image');
    const missingBox = document.getElementById('review-missing-image-box');
    const missingTitle = document.getElementById('review-missing-image-title');

    const applySheetImageState = (dataUrl, sheetObj) => {
      if (!imgEl) return;
      if (dataUrl) {
        imgEl.src = dataUrl;
        imgEl.classList.remove('hidden');
        if (missingBox) missingBox.classList.add('hidden');
      } else if (sheetObj && sheetObj.isDemo) {
        imgEl.src = 'sample_jobsheet.jpg';
        imgEl.classList.remove('hidden');
        if (missingBox) missingBox.classList.add('hidden');
      } else {
        imgEl.removeAttribute('src');
        imgEl.classList.add('hidden');
        if (missingTitle && sheetObj) {
          missingTitle.textContent = `ข้อมูลตารางของช่าง "${sheetObj.workerName || '-'}" (${sheetObj.sheetDate || '-'}) ครบถ้วน 100%`;
        }
        if (missingBox) missingBox.classList.remove('hidden');
      }
    };

    if (imgEl) {
      if (sheet.imageDataUrl) {
        applySheetImageState(sheet.imageDataUrl, sheet);
      } else if (typeof PayrollDB.fetchSheetImage === 'function' && !sheet.isDemo) {
        const loadingSheetId = sheet.id;
        PayrollDB.fetchSheetImage(loadingSheetId).then(dataUrl => {
          const current = getActiveSheet();
          if (current && current.id === loadingSheetId) {
            applySheetImageState(dataUrl, current);
          }
        });
      } else {
        applySheetImageState('', sheet);
      }
    }

    // Header fields
    const rawWorkerEl = document.getElementById('review-raw-worker');
    if (rawWorkerEl) rawWorkerEl.textContent = sheet.rawWorkerName ? `"${sheet.rawWorkerName}"` : '-';

    const workers = PayrollDB.getWorkerMappings();
    const selectWorker = document.getElementById('review-select-worker');
    if (selectWorker) {
      selectWorker.innerHTML = workers.map(w => `
        <option value="${escapeHtml(w.code)}" ${w.code === sheet.workerCode ? 'selected' : ''}>
          ${escapeHtml(w.name)} (${escapeHtml(w.code)} - แผนก${escapeHtml(w.dept)})
        </option>
      `).join('');
    }

    const deptBadge = document.getElementById('review-worker-dept-badge');
    if (deptBadge) {
      if (sheet.workerDept === 'เย็บ') {
        deptBadge.className = 'px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300';
        deptBadge.textContent = '🧵 แผนกช่างเย็บ (คิดเรทค่าเย็บ)';
      } else {
        deptBadge.className = 'px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300';
        deptBadge.textContent = '🔨 แผนกช่างหุ้ม (คิดเรทค่าหุ้ม)';
      }
    }

    const rawDateEl = document.getElementById('review-raw-date');
    if (rawDateEl) rawDateEl.textContent = sheet.rawDate || sheet.sheetDate;

    const inputDate = document.getElementById('review-input-date');
    if (inputDate) inputDate.value = sheet.sheetDate;

    // Payroll Period options
    const selectPeriod = document.getElementById('review-select-period');
    const payDateHint = document.getElementById('review-paydate-hint');
    if (selectPeriod) {
      const periodKeys = buildPeriodOptionsList(sheet.sheetDate);
      if (!periodKeys.includes(sheet.payrollPeriodKey)) {
        periodKeys.unshift(sheet.payrollPeriodKey);
      }
      selectPeriod.innerHTML = periodKeys.map(pk => {
        const meta = PayrollDB.getPeriodMetaFromKey(pk);
        return `<option value="${pk}" ${pk === sheet.payrollPeriodKey ? 'selected' : ''}>${meta.periodLabel}</option>`;
      }).join('');
      const activeMeta = PayrollDB.getPeriodMetaFromKey(sheet.payrollPeriodKey);
      if (payDateHint) {
        payDateHint.textContent = `💰 กำหนดโอนจ่ายวันที่ ${activeMeta.payDateLabel}`;
      }
    }

    // Special Note
    const inputNote = document.getElementById('review-input-note');
    if (inputNote) inputNote.value = sheet.specialNote || '';

    // Items Table
    const tbody = document.getElementById('tbody-review-items');
    const skuList = PayrollDB.getSkuMappings();
    if (tbody) {
      const formatSkuDisplay = (skuCode) => {
        if (!skuCode) return '';
        const found = skuList.find(s => s.model.toLowerCase() === String(skuCode).toLowerCase());
        if (!found) return String(skuCode).toUpperCase();
        const rate = sheet.workerDept === 'เย็บ' ? found.sewingWage : found.upholsteryWage;
        return `${found.model.toUpperCase()} - ${found.name} (${rate}฿)`;
      };

      tbody.innerHTML = (sheet.items || []).map((item, idx) => {
        const currentSkuLabel = formatSkuDisplay(item.matchedSku);

        return `
          <tr class="${item.matchedSku ? 'hover:bg-slate-50' : 'bg-amber-50'}" data-item-idx="${idx}">
            <td class="py-1.5 px-2 text-center font-mono font-bold text-slate-500">${idx + 1}</td>
            <td class="py-1.5 px-2">
              <div class="flex items-center gap-1">
                <input type="text" class="rev-item-raw w-full px-2 py-1 font-mono font-bold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg text-xs" value="${escapeHtml(item.rawModel || '')}">
                <button type="button" class="btn-learn-item-sku px-1.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold shrink-0 cursor-pointer" data-idx="${idx}" title="จำคำในใบงานนี้ให้ตรงกับ SKU ที่เลือก">📌จำ</button>
              </div>
            </td>
            <td class="py-1.5 px-2">
              <div class="relative flex items-center">
                <input type="hidden" class="rev-item-sku" value="${escapeHtml(item.matchedSku || '')}">
                <input
                  type="text"
                  class="rev-item-sku-search w-full pl-2 pr-6 py-1 font-bold rounded-lg border text-xs cursor-pointer focus:cursor-text focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition ${item.matchedSku ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950' : 'border-amber-400 bg-amber-100 text-amber-950'}"
                  value="${escapeHtml(currentSkuLabel)}"
                  placeholder="🔍 พิมพ์ค้นหา SKU / ชื่อรุ่น..."
                  autocomplete="off"
                  data-idx="${idx}"
                >
                <span class="rev-item-sku-toggle absolute right-1.5 text-[10px] text-slate-500 hover:text-indigo-700 cursor-pointer select-none px-1" data-idx="${idx}" title="คลิกเพื่อเปิดรายการ / พิมพ์ค้นหาคีย์เวิร์ด">▾</span>
              </div>
            </td>
            <td class="py-1.5 px-2">
              <input type="text" class="rev-item-color w-full px-2 py-1 font-mono text-slate-800 border border-slate-200 rounded-lg text-xs" value="${escapeHtml(item.color || '')}">
            </td>
            <td class="py-1.5 px-2">
              <input type="number" min="1" class="rev-item-qty w-full px-1.5 py-1 text-center font-mono font-black text-slate-900 border border-slate-300 rounded-lg text-xs" value="${item.qty || 1}">
            </td>
            <td class="py-1.5 px-2">
              <input type="text" class="rev-item-channel w-full px-2 py-1 text-slate-700 border border-slate-200 rounded-lg text-xs" value="${escapeHtml(item.channel || '')}">
            </td>
            <td class="py-1.5 px-2">
              <input type="text" class="rev-item-stock w-full px-2 py-1 font-mono text-slate-700 border border-slate-200 rounded-lg text-xs" value="${escapeHtml(item.stockReceiver || '')}">
            </td>
            <td class="py-1.5 px-2 text-right font-mono font-bold text-slate-700">${(item.unitRate || 0).toLocaleString()}</td>
            <td class="py-1.5 px-2 text-right font-mono font-black text-emerald-700">${(item.lineTotal || 0).toLocaleString()}</td>
            <td class="py-1.5 px-1 text-center">
              <button type="button" class="btn-del-rev-item text-rose-500 hover:text-rose-700 font-bold cursor-pointer" data-idx="${idx}">✕</button>
            </td>
          </tr>
        `;
      }).join('');

      // Attach searchable SKU combobox portal events
      bindSearchableSkuComboboxes(tbody, sheet, skuList, formatSkuDisplay);

      // Live recalculate when SKU, Qty or other row fields change
      tbody.querySelectorAll('.rev-item-sku, .rev-item-qty, .rev-item-raw, .rev-item-color, .rev-item-channel, .rev-item-stock').forEach(el => {
        el.addEventListener('change', () => {
          syncReviewTableToSheetObject(sheet);
          PayrollDB.upsertSheet(sheet);
          renderReviewSelectorAndWorkspace();
        });
      });

      // Learn SKU alias button (also applies SKU to any other rows in this sheet with the same rawModel)
      tbody.querySelectorAll('.btn-learn-item-sku').forEach(btn => {
        btn.addEventListener('click', () => {
          syncReviewTableToSheetObject(sheet);
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          const targetItem = sheet.items[idx];
          if (!targetItem || !targetItem.rawModel || !targetItem.matchedSku) {
            alert('กรุณาพิมพ์คำในใบงานและเลือกรหัส SKU โรงงานก่อนกดจำ');
            return;
          }
          const normRaw = targetItem.rawModel.trim().toLowerCase();
          let updatedRowsCount = 0;
          sheet.items.forEach(it => {
            if ((it.rawModel || '').trim().toLowerCase() === normRaw) {
              it.matchedSku = targetItem.matchedSku;
              updatedRowsCount++;
            }
          });
          PayrollDB.learnSkuAlias(targetItem.rawModel, targetItem.matchedSku);
          PayrollDB.upsertSheet(sheet);
          renderSkuMappingTable();
          renderReviewSelectorAndWorkspace();
          alert(`📌 จำคำว่า "${targetItem.rawModel}" ➔ SKU "${targetItem.matchedSku.toUpperCase()}" เข้าตารางจับคู่ และอัปเดตในใบงานนี้ (${updatedRowsCount} แถว) เรียบร้อยแล้ว!`);
        });
      });

      // Delete item row
      tbody.querySelectorAll('.btn-del-rev-item').forEach(btn => {
        btn.addEventListener('click', () => {
          syncReviewTableToSheetObject(sheet);
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          sheet.items.splice(idx, 1);
          PayrollDB.upsertSheet(sheet);
          renderReviewSelectorAndWorkspace();
        });
      });
    }

    // Totals
    const totalUnitsEl = document.getElementById('review-total-units');
    const totalWageEl = document.getElementById('review-total-wage');
    if (totalUnitsEl) totalUnitsEl.textContent = String(sheet.totalUnits || 0);
    if (totalWageEl) totalWageEl.textContent = (sheet.totalWage || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  }

  // ===========================================================================
  // SEARCHABLE SKU COMBOBOX PORTAL FOR TAB 3
  // ===========================================================================
  let skuPortalEl = null;
  let activeSkuSearchState = null;

  function ensureSkuSearchPortal() {
    if (skuPortalEl) return skuPortalEl;
    skuPortalEl = document.createElement('div');
    skuPortalEl.id = 'sku-search-portal';
    skuPortalEl.className = 'fixed z-[9999] bg-white border-2 border-indigo-600 rounded-xl shadow-2xl overflow-hidden hidden flex-col text-xs';
    skuPortalEl.style.width = '360px';
    skuPortalEl.style.maxHeight = '320px';
    document.body.appendChild(skuPortalEl);

    // Close portal when clicking outside (if user typed a matching keyword, auto-commit it!)
    document.addEventListener('mousedown', (e) => {
      if (!skuPortalEl || skuPortalEl.classList.contains('hidden')) return;
      if (skuPortalEl.contains(e.target)) return;
      if (activeSkuSearchState && activeSkuSearchState.inputEl && activeSkuSearchState.inputEl.parentElement.contains(e.target)) return;
      if (
        activeSkuSearchState &&
        activeSkuSearchState.isDirty &&
        activeSkuSearchState.filtered &&
        activeSkuSearchState.filtered.length > 0 &&
        typeof activeSkuSearchState.commitSkuSelection === 'function'
      ) {
        const picked = activeSkuSearchState.filtered[activeSkuSearchState.highlightIdx] || activeSkuSearchState.filtered[0];
        if (picked) {
          activeSkuSearchState.commitSkuSelection(picked.model);
          return;
        }
      }
      closeSkuSearchPortal(true);
    });

    // Reposition portal on window resize or scroll (except scrolling inside the portal itself)
    window.addEventListener('scroll', (e) => {
      if (!skuPortalEl || skuPortalEl.classList.contains('hidden')) return;
      if (skuPortalEl.contains(e.target)) return;
      positionSkuSearchPortal();
    }, true);

    window.addEventListener('resize', () => {
      if (!skuPortalEl || skuPortalEl.classList.contains('hidden')) return;
      positionSkuSearchPortal();
    });

    return skuPortalEl;
  }

  function positionSkuSearchPortal() {
    if (!skuPortalEl || !activeSkuSearchState || !activeSkuSearchState.inputEl) return;
    const rect = activeSkuSearchState.inputEl.getBoundingClientRect();
    const portalWidth = Math.max(350, rect.width);
    skuPortalEl.style.width = `${portalWidth}px`;

    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom;
    const desiredHeight = 310;

    let left = rect.left;
    if (left + portalWidth > viewportW - 12) {
      left = Math.max(12, viewportW - portalWidth - 12);
    }
    skuPortalEl.style.left = `${left}px`;

    if (spaceBelow < 220 && rect.top > 240) {
      // Open upward
      skuPortalEl.style.top = 'auto';
      skuPortalEl.style.bottom = `${viewportH - rect.top + 4}px`;
      skuPortalEl.style.maxHeight = `${Math.min(desiredHeight, rect.top - 16)}px`;
    } else {
      // Open downward
      skuPortalEl.style.bottom = 'auto';
      skuPortalEl.style.top = `${rect.bottom + 4}px`;
      skuPortalEl.style.maxHeight = `${Math.min(desiredHeight, Math.max(180, spaceBelow - 16))}px`;
    }
  }

  function closeSkuSearchPortal(restoreLabel = true) {
    if (restoreLabel && activeSkuSearchState) {
      const { inputEl, hiddenEl, formatSkuDisplay } = activeSkuSearchState;
      if (inputEl && hiddenEl && formatSkuDisplay) {
        inputEl.value = formatSkuDisplay(hiddenEl.value);
      }
    }
    if (skuPortalEl) {
      skuPortalEl.classList.add('hidden');
      skuPortalEl.classList.remove('flex');
    }
    activeSkuSearchState = null;
  }

  function bindSearchableSkuComboboxes(tbody, sheet, skuList, formatSkuDisplay) {
    ensureSkuSearchPortal();

    const filterSkusByKeyword = (query) => {
      const q = (query || '').trim().toLowerCase();
      if (!q) return skuList;
      const tokens = q.split(/\s+/).filter(Boolean);
      const filtered = skuList.filter(s => {
        const rate = sheet.workerDept === 'เย็บ' ? s.sewingWage : s.upholsteryWage;
        const haystack = `${s.model} ${s.name} ${(s.aliases || []).join(' ')} ${rate}`.toLowerCase();
        return tokens.every(tok => haystack.includes(tok));
      });
      // Sort exact/prefix SKU code matches first
      return filtered.slice().sort((a, b) => {
        const am = a.model.toLowerCase();
        const bm = b.model.toLowerCase();
        if (am === q && bm !== q) return -1;
        if (bm === q && am !== q) return 1;
        if (am.startsWith(q) && !bm.startsWith(q)) return -1;
        if (bm.startsWith(q) && !am.startsWith(q)) return 1;
        return 0;
      });
    };

    const renderPortalList = () => {
      if (!skuPortalEl || !activeSkuSearchState) return;
      const { query, filtered, highlightIdx, hiddenEl } = activeSkuSearchState;
      const currentVal = (hiddenEl?.value || '').toLowerCase();

      const headerHtml = `
        <div class="px-3 py-1.5 bg-indigo-950 text-white flex items-center justify-between text-[11px] font-bold shrink-0">
          <span>🔍 พิมพ์ค้นหารหัส SKU / ชื่อรุ่น / คำย่อ / ราคา</span>
          <span class="px-1.5 py-0.5 rounded bg-indigo-800 text-cyan-300 font-mono text-[10px]">พบ ${filtered.length} รุ่น</span>
        </div>
      `;

      const clearOptionHtml = `
        <div data-sku-value="" class="sku-portal-option px-3 py-1.5 border-b border-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer flex items-center justify-between text-[11px] font-bold">
          <span>-- ล้างค่า / ไม่ระบุ SKU --</span>
          <span class="text-[10px]">✕</span>
        </div>
      `;

      const itemsHtml = filtered.length === 0
        ? `<div class="p-4 text-center text-slate-500 font-bold">ไม่พบรุ่นที่ตรงกับคีย์เวิร์ด "${escapeHtml(query)}"</div>`
        : filtered.map((s, i) => {
            const rate = sheet.workerDept === 'เย็บ' ? s.sewingWage : s.upholsteryWage;
            const isSelected = s.model.toLowerCase() === currentVal;
            const isHighlighted = i === highlightIdx;
            const aliasPreview = (s.aliases || []).filter(a => a.toLowerCase() !== s.model.toLowerCase()).slice(0, 4).join(', ');
            return `
              <div
                data-sku-value="${escapeHtml(s.model)}"
                data-opt-idx="${i}"
                class="sku-portal-option px-3 py-2 border-b border-slate-100 cursor-pointer flex items-center justify-between gap-2 transition ${
                  isHighlighted
                    ? 'bg-indigo-600 text-white'
                    : isSelected
                    ? 'bg-emerald-50 text-emerald-950 font-black'
                    : 'hover:bg-indigo-50 text-slate-800'
                }"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="px-1.5 py-0.5 rounded font-mono font-black text-[11px] ${
                      isHighlighted ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-800'
                    }">${escapeHtml(s.model.toUpperCase())}</span>
                    <span class="font-bold truncate">${escapeHtml(s.name)}</span>
                  </div>
                  ${aliasPreview ? `<div class="text-[10px] truncate mt-0.5 ${isHighlighted ? 'text-indigo-100' : 'text-slate-400'}">คำในใบงาน: ${escapeHtml(aliasPreview)}</div>` : ''}
                </div>
                <span class="px-2 py-0.5 rounded-full font-mono font-black text-[11px] shrink-0 ${
                  isHighlighted
                    ? 'bg-amber-300 text-slate-950'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }">${rate}฿</span>
              </div>
            `;
          }).join('');

      skuPortalEl.innerHTML = `
        ${headerHtml}
        <div id="sku-portal-scroll" class="overflow-y-auto flex-1 divide-y divide-slate-50">
          ${clearOptionHtml}
          ${itemsHtml}
        </div>
      `;

      // Bind mousedown on options so selection triggers before input blur
      skuPortalEl.querySelectorAll('.sku-portal-option').forEach(optEl => {
        optEl.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const chosenSku = optEl.getAttribute('data-sku-value') || '';
          commitSkuSelection(chosenSku);
        });
      });

      // Scroll highlighted item into view
      const scrollBox = skuPortalEl.querySelector('#sku-portal-scroll');
      const hiEl = skuPortalEl.querySelector(`[data-opt-idx="${highlightIdx}"]`);
      if (scrollBox && hiEl) {
        const hiTop = hiEl.offsetTop;
        const hiBottom = hiTop + hiEl.offsetHeight;
        if (hiTop < scrollBox.scrollTop) {
          scrollBox.scrollTop = Math.max(0, hiTop - 28);
        } else if (hiBottom > scrollBox.scrollTop + scrollBox.clientHeight) {
          scrollBox.scrollTop = hiBottom - scrollBox.clientHeight + 12;
        }
      }
    };

    const commitSkuSelection = (chosenSku) => {
      if (!activeSkuSearchState) return;
      const { hiddenEl, inputEl } = activeSkuSearchState;
      hiddenEl.value = chosenSku;
      inputEl.value = formatSkuDisplay(chosenSku);
      closeSkuSearchPortal(false);
      syncReviewTableToSheetObject(sheet);
      PayrollDB.upsertSheet(sheet);
      renderReviewSelectorAndWorkspace();
      const btnSaveSheet = document.getElementById('btn-save-verified-sheet');
      if (btnSaveSheet) {
        btnSaveSheet.innerHTML = '<span>✅ บันทึก SKU อัตโนมัติแล้ว! (กดยืนยันใบงานได้)</span>';
        setTimeout(() => {
          btnSaveSheet.innerHTML = '<span>✅ บันทึก & ยืนยันยอดใบงานนี้เข้าสรุปงวดจ่ายเงิน</span>';
        }, 2500);
      }
    };

    const openForInput = (inputEl, initialQuery = '', isDirty = false) => {
      const tr = inputEl.closest('tr[data-item-idx]');
      const hiddenEl = tr?.querySelector('.rev-item-sku');
      if (!tr || !hiddenEl) return;

      const filtered = filterSkusByKeyword(initialQuery);
      const currentVal = (hiddenEl.value || '').toLowerCase();
      let highlightIdx = filtered.findIndex(s => s.model.toLowerCase() === currentVal);
      if (highlightIdx < 0) highlightIdx = 0;

      activeSkuSearchState = {
        inputEl,
        hiddenEl,
        formatSkuDisplay,
        commitSkuSelection,
        query: initialQuery,
        isDirty,
        filtered,
        highlightIdx
      };

      skuPortalEl.classList.remove('hidden');
      skuPortalEl.classList.add('flex');
      positionSkuSearchPortal();
      renderPortalList();
    };

    tbody.querySelectorAll('.rev-item-sku-search').forEach(inputEl => {
      inputEl.addEventListener('focus', () => {
        openForInput(inputEl, '', false);
        setTimeout(() => {
          if (document.activeElement === inputEl) inputEl.select();
        }, 10);
      });

      inputEl.addEventListener('click', () => {
        if (!activeSkuSearchState || activeSkuSearchState.inputEl !== inputEl) {
          openForInput(inputEl, '', false);
        }
      });

      inputEl.addEventListener('input', () => {
        const q = inputEl.value;
        const filtered = filterSkusByKeyword(q);
        if (!activeSkuSearchState || activeSkuSearchState.inputEl !== inputEl) {
          openForInput(inputEl, q, true);
        } else {
          activeSkuSearchState.query = q;
          activeSkuSearchState.isDirty = true;
          activeSkuSearchState.filtered = filtered;
          activeSkuSearchState.highlightIdx = 0;
          positionSkuSearchPortal();
          renderPortalList();
        }
      });

      inputEl.addEventListener('keydown', (e) => {
        if (!activeSkuSearchState || activeSkuSearchState.inputEl !== inputEl) return;
        const len = activeSkuSearchState.filtered.length;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (len > 0) {
            activeSkuSearchState.highlightIdx = (activeSkuSearchState.highlightIdx + 1) % len;
            renderPortalList();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (len > 0) {
            activeSkuSearchState.highlightIdx = (activeSkuSearchState.highlightIdx - 1 + len) % len;
            renderPortalList();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (len > 0) {
            const picked = activeSkuSearchState.filtered[activeSkuSearchState.highlightIdx] || activeSkuSearchState.filtered[0];
            if (picked) commitSkuSelection(picked.model);
          }
        } else if (e.key === 'Tab') {
          if (activeSkuSearchState.isDirty && len > 0) {
            const picked = activeSkuSearchState.filtered[activeSkuSearchState.highlightIdx] || activeSkuSearchState.filtered[0];
            if (picked) commitSkuSelection(picked.model);
          } else {
            closeSkuSearchPortal(true);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeSkuSearchPortal(true);
          inputEl.blur();
        }
      });
    });

    tbody.querySelectorAll('.rev-item-sku-toggle').forEach(toggleEl => {
      toggleEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const tr = toggleEl.closest('tr[data-item-idx]');
        const inputEl = tr?.querySelector('.rev-item-sku-search');
        if (!inputEl) return;
        if (activeSkuSearchState && activeSkuSearchState.inputEl === inputEl && !skuPortalEl.classList.contains('hidden')) {
          closeSkuSearchPortal(true);
        } else {
          inputEl.focus();
          openForInput(inputEl, '');
          setTimeout(() => inputEl.select(), 10);
        }
      });
    });
  }

  function syncReviewTableToSheetObject(sheet) {
    const tbody = document.getElementById('tbody-review-items');
    if (!tbody || !sheet) return;
    const inputNote = document.getElementById('review-input-note');
    if (inputNote) sheet.specialNote = inputNote.value.trim();

    const rows = tbody.querySelectorAll('tr[data-item-idx]');
    const newItems = [];
    rows.forEach((tr, i) => {
      const rawModel = (tr.querySelector('.rev-item-raw')?.value || '').trim();
      const matchedSku = (tr.querySelector('.rev-item-sku')?.value || '').trim().toLowerCase();
      const color = (tr.querySelector('.rev-item-color')?.value || '').trim();
      const qty = Math.max(1, parseInt(tr.querySelector('.rev-item-qty')?.value, 10) || 1);
      const channel = (tr.querySelector('.rev-item-channel')?.value || '').trim();
      const stockReceiver = (tr.querySelector('.rev-item-stock')?.value || '').trim();

      newItems.push({
        rowNo: i + 1,
        rawModel,
        matchedSku,
        color,
        qty,
        channel,
        stockReceiver
      });
    });
    sheet.items = newItems;
  }

  // ===========================================================================
  // TAB 4: 15-DAY PAYROLL SUMMARY, SLIPS & EXCEL EXPORT
  // ===========================================================================
  function initPayrollSummaryUI() {
    const filterPeriod = document.getElementById('filter-payroll-period');
    const filterDept = document.getElementById('filter-payroll-dept');
    const filterSearch = document.getElementById('filter-payroll-search');
    const btnExport = document.getElementById('btn-export-payroll-excel');
    const btnCloseSlip = document.getElementById('btn-close-payslip');
    const btnPrintSlip = document.getElementById('btn-print-slip-now');

    [filterPeriod, filterDept].forEach(el => {
      if (el) el.addEventListener('change', renderPayrollDashboard);
    });
    if (filterSearch) {
      filterSearch.addEventListener('input', renderPayrollDashboard);
    }
    if (btnExport) {
      btnExport.addEventListener('click', exportPayrollSummaryExcel);
    }
    if (btnCloseSlip) {
      btnCloseSlip.addEventListener('click', () => {
        document.getElementById('modal-payslip')?.classList.add('hidden');
      });
    }
    if (btnPrintSlip) {
      btnPrintSlip.addEventListener('click', () => {
        window.print();
      });
    }
  }

  function getFilteredPayrollData() {
    const allSheets = PayrollDB.getSavedSheets();
    const filterPeriod = document.getElementById('filter-payroll-period');
    const filterDept = document.getElementById('filter-payroll-dept');
    const filterSearch = document.getElementById('filter-payroll-search');

    const selectedPeriod = filterPeriod ? filterPeriod.value : 'ALL';
    const selectedDept = filterDept ? filterDept.value : 'ALL';
    const searchQ = (filterSearch ? filterSearch.value : '').trim().toLowerCase();

    const filteredSheets = allSheets.filter(s => {
      if (selectedPeriod && selectedPeriod !== 'ALL' && s.payrollPeriodKey !== selectedPeriod) return false;
      if (selectedDept && selectedDept !== 'ALL' && s.workerDept !== selectedDept) return false;
      if (searchQ) {
        const hay = `${s.workerCode} ${s.workerName} ${s.rawWorkerName}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });

    const byWorkerMap = new Map();
    let totalUnits = 0;
    let totalUphWage = 0;
    let totalSewWage = 0;

    filteredSheets.forEach(s => {
      const wKey = (s.workerCode || s.workerName || 'UNKNOWN').toLowerCase();
      if (!byWorkerMap.has(wKey)) {
        byWorkerMap.set(wKey, {
          workerCode: s.workerCode || '-',
          workerName: s.workerName || 'ไม่ระบุชื่อ',
          dept: s.workerDept || 'หุ้ม',
          sheetCount: 0,
          totalUnits: 0,
          totalWage: 0,
          bySku: {},
          sheets: []
        });
      }
      const wEntry = byWorkerMap.get(wKey);
      wEntry.sheetCount += 1;
      wEntry.totalUnits += (s.totalUnits || 0);
      wEntry.totalWage += (s.totalWage || 0);
      wEntry.sheets.push(s);

      (s.items || []).forEach(it => {
        const skuKey = (it.matchedSku || 'ไม่ระบุ').toUpperCase();
        if (!wEntry.bySku[skuKey]) wEntry.bySku[skuKey] = { qty: 0, wage: 0 };
        wEntry.bySku[skuKey].qty += (it.qty || 1);
        wEntry.bySku[skuKey].wage += (it.lineTotal || 0);
      });

      totalUnits += (s.totalUnits || 0);
      if (s.workerDept === 'เย็บ') {
        totalSewWage += (s.totalWage || 0);
      } else {
        totalUphWage += (s.totalWage || 0);
      }
    });

    return {
      selectedPeriod,
      filteredSheets,
      workersList: Array.from(byWorkerMap.values()),
      totalSheets: filteredSheets.length,
      totalUnits,
      totalUphWage,
      totalSewWage,
      grandWage: totalUphWage + totalSewWage
    };
  }

  function renderPayrollDashboard() {
    const allSheets = PayrollDB.getSavedSheets();
    const filterPeriod = document.getElementById('filter-payroll-period');

    if (filterPeriod) {
      const currentVal = filterPeriod.value || 'ALL';
      const uniquePeriods = Array.from(new Set(allSheets.map(s => s.payrollPeriodKey).filter(Boolean))).sort().reverse();
      filterPeriod.innerHTML = [
        `<option value="ALL">ทุกงวดรวมกัน (${allSheets.length} ใบงาน)</option>`,
        ...uniquePeriods.map(pk => {
          const meta = PayrollDB.getPeriodMetaFromKey(pk);
          return `<option value="${pk}" ${pk === currentVal ? 'selected' : ''}>${meta.periodLabel}</option>`;
        })
      ].join('');
    }

    const data = getFilteredPayrollData();

    document.getElementById('kpi-total-sheets').textContent = String(data.totalSheets);
    document.getElementById('kpi-total-units').textContent = String(data.totalUnits);
    document.getElementById('kpi-uph-wage').textContent = data.totalUphWage.toLocaleString('th-TH', { minimumFractionDigits: 2 });
    document.getElementById('kpi-sew-wage').textContent = data.totalSewWage.toLocaleString('th-TH', { minimumFractionDigits: 2 });
    document.getElementById('kpi-grand-wage').textContent = data.grandWage.toLocaleString('th-TH', { minimumFractionDigits: 2 });

    const payBadge = document.getElementById('kpi-paydate-badge');
    if (payBadge) {
      if (data.selectedPeriod && data.selectedPeriod !== 'ALL') {
        const meta = PayrollDB.getPeriodMetaFromKey(data.selectedPeriod);
        payBadge.textContent = `กำหนดโอนวันที่ ${meta.payDateLabel}`;
      } else {
        payBadge.textContent = 'บาท (รวมทุกงวดที่เลือก)';
      }
    }

    // Worker Summary Table
    const tbodyWorkers = document.getElementById('tbody-payroll-workers');
    if (tbodyWorkers) {
      if (data.workersList.length === 0) {
        tbodyWorkers.innerHTML = `
          <tr>
            <td colspan="7" class="py-8 text-center text-slate-400">
              ยังไม่มีข้อมูลใบงานในงวดนี้ (ไปที่แท็บ 2 หรือ 3 เพื่อสแกนใบงานหรือโหลดใบงานตัวอย่างได้เลยครับ)
            </td>
          </tr>
        `;
      } else {
        tbodyWorkers.innerHTML = data.workersList.map((w, idx) => {
          const skuPills = Object.entries(w.bySku).map(([sku, info]) =>
            `<span class="inline-block px-2 py-0.5 mr-1 mb-1 rounded bg-white/10 text-slate-200 font-mono text-[11px]">${sku} × ${info.qty} (${info.wage.toLocaleString()}฿)</span>`
          ).join('');

          return `
            <tr class="hover:bg-white/5">
              <td class="py-3 px-4 font-black text-white">
                ${escapeHtml(w.workerName)} <span class="text-slate-400 font-mono text-[11px]">(${escapeHtml(w.workerCode)})</span>
              </td>
              <td class="py-3 px-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${w.dept === 'เย็บ' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'}">
                  ${w.dept === 'เย็บ' ? '🧵 ช่างเย็บ' : '🔨 ช่างหุ้ม'}
                </span>
              </td>
              <td class="py-3 px-3 text-center font-mono font-bold text-slate-200">${w.sheetCount} ใบ</td>
              <td class="py-3 px-3 text-center font-mono font-black text-cyan-300 text-sm">${w.totalUnits} ชิ้น</td>
              <td class="py-3 px-4">${skuPills}</td>
              <td class="py-3 px-4 text-right font-mono font-black text-emerald-300 text-sm">${w.totalWage.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</td>
              <td class="py-3 px-4 text-center">
                <button type="button" class="btn-view-payslip px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl font-bold text-xs cursor-pointer" data-widx="${idx}">
                  🧾 พิมพ์สลิป
                </button>
              </td>
            </tr>
          `;
        }).join('');

        tbodyWorkers.querySelectorAll('.btn-view-payslip').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-widx'), 10);
            const workerSummary = data.workersList[idx];
            if (workerSummary) openWorkerPayslipModal(workerSummary, data.selectedPeriod);
          });
        });
      }
    }

    // All Sheets Table
    const tbodySheets = document.getElementById('tbody-payroll-sheets');
    if (tbodySheets) {
      if (data.filteredSheets.length === 0) {
        tbodySheets.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400">ไม่มีรายการใบงาน</td></tr>`;
      } else {
        tbodySheets.innerHTML = data.filteredSheets.map(s => {
          const pMeta = PayrollDB.getPeriodMetaFromKey(s.payrollPeriodKey);
          return `
            <tr class="hover:bg-slate-50">
              <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500">${escapeHtml(s.id)}</td>
              <td class="py-2.5 px-3 font-mono font-bold">${escapeHtml(s.sheetDate)} <span class="text-slate-400 text-[10px]">(${escapeHtml(s.rawDate || '')})</span></td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">${escapeHtml(pMeta.periodLabel)}</span>
              </td>
              <td class="py-2.5 px-3 font-bold text-slate-900">
                ${escapeHtml(s.workerName)} (${escapeHtml(s.workerCode)})
                <span class="text-slate-400 text-[11px] font-normal">← "${escapeHtml(s.rawWorkerName || '')}"</span>
              </td>
              <td class="py-2.5 px-3 text-center font-mono font-black text-indigo-700">${s.totalUnits || 0}</td>
              <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-700">${(s.totalWage || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              <td class="py-2.5 px-3 text-amber-800 font-medium">${escapeHtml(s.specialNote || '-')}</td>
              <td class="py-2.5 px-3 text-center">
                <button type="button" class="btn-edit-sheet-from-payroll px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs" data-sid="${s.id}">
                  🔍 เปิดดู/แก้ไข
                </button>
              </td>
            </tr>
          `;
        }).join('');

        tbodySheets.querySelectorAll('.btn-edit-sheet-from-payroll').forEach(btn => {
          btn.addEventListener('click', () => {
            activeSheetId = btn.getAttribute('data-sid');
            switchTab('review');
          });
        });
      }
    }
  }

  function openWorkerPayslipModal(workerSummary, periodKey) {
    const modal = document.getElementById('modal-payslip');
    const area = document.getElementById('print-slip-Area');
    if (!modal || !area) return;

    const pMeta = (periodKey && periodKey !== 'ALL')
      ? PayrollDB.getPeriodMetaFromKey(periodKey)
      : { periodLabel: 'รวมทุกงวด', payDateLabel: '-' };

    let allRowsHtml = '';
    let rowCounter = 1;
    workerSummary.sheets.forEach(s => {
      (s.items || []).forEach(it => {
        allRowsHtml += `
          <tr class="border-b border-slate-200">
            <td class="py-1.5 px-2 text-center font-mono">${rowCounter++}</td>
            <td class="py-1.5 px-2 font-mono">${escapeHtml(s.sheetDate)}</td>
            <td class="py-1.5 px-2">${escapeHtml(it.rawModel)}</td>
            <td class="py-1.5 px-2 font-mono font-bold uppercase">${escapeHtml(it.matchedSku)}</td>
            <td class="py-1.5 px-2">${escapeHtml(it.color || '-')}</td>
            <td class="py-1.5 px-2 text-center font-mono font-bold">${it.qty}</td>
            <td class="py-1.5 px-2 text-right font-mono">${(it.unitRate || 0).toLocaleString()}</td>
            <td class="py-1.5 px-2 text-right font-mono font-bold">${(it.lineTotal || 0).toLocaleString()}</td>
          </tr>
        `;
      });
    });

    area.innerHTML = `
      <div class="border-2 border-slate-800 rounded-xl p-5 space-y-4">
        <div class="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <h2 class="text-lg font-black text-slate-900">QueenCosy - ใบสรุปค่าแรงเหมาช่าง (Payroll Slip)</h2>
            <p class="text-xs text-slate-600">งวดการจ่ายเงิน: <strong>${escapeHtml(pMeta.periodLabel)}</strong> | กำหนดจ่าย: <strong>${escapeHtml(pMeta.payDateLabel)}</strong></p>
          </div>
          <div class="text-right">
            <div class="text-sm font-black text-slate-900">ช่าง: ${escapeHtml(workerSummary.workerName)} (${escapeHtml(workerSummary.workerCode)})</div>
            <div class="text-xs font-bold text-slate-600">แผนก: ช่าง${escapeHtml(workerSummary.dept)} (${workerSummary.sheetCount} ใบงาน)</div>
          </div>
        </div>

        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100 border-b border-slate-300 font-bold">
              <th class="py-2 px-2 w-10 text-center">#</th>
              <th class="py-2 px-2">วันที่ใบงาน</th>
              <th class="py-2 px-2">รายการในใบงาน</th>
              <th class="py-2 px-2">SKU</th>
              <th class="py-2 px-2">สี</th>
              <th class="py-2 px-2 text-center">จำนวน</th>
              <th class="py-2 px-2 text-right">เรท/ชิ้น</th>
              <th class="py-2 px-2 text-right">รวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            ${allRowsHtml}
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 font-black text-sm border-t-2 border-slate-800">
              <td colspan="5" class="py-2.5 px-3 text-right">รวมสุทธิทั้งสิ้น:</td>
              <td class="py-2.5 px-2 text-center font-mono">${workerSummary.totalUnits} ชิ้น</td>
              <td class="py-2.5 px-2"></td>
              <td class="py-2.5 px-2 text-right font-mono text-emerald-800">${workerSummary.totalWage.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</td>
            </tr>
          </tfoot>
        </table>

        <div class="grid grid-cols-2 gap-8 pt-6 text-center text-xs text-slate-600">
          <div>
            <div class="border-b border-slate-400 w-48 mx-auto mb-1 h-6"></div>
            <div>ลงชื่อผู้ตรวจใบงาน / บัญชี</div>
          </div>
          <div>
            <div class="border-b border-slate-400 w-48 mx-auto mb-1 h-6"></div>
            <div>ลงชื่อช่างผู้รับเงิน (${escapeHtml(workerSummary.workerName)})</div>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  function exportPayrollSummaryExcel() {
    if (typeof XLSX === 'undefined') {
      alert('ไม่พบไลบรารีสร้างไฟล์ Excel');
      return;
    }
    const data = getFilteredPayrollData();
    if (data.workersList.length === 0) {
      alert('ยังไม่มีข้อมูลใบงานสำหรับส่งออก Excel');
      return;
    }

    const summaryRows = data.workersList.map((w, idx) => {
      const skuBreakdown = Object.entries(w.bySku).map(([k, v]) => `${k}x${v.qty}`).join(', ');
      return {
        'ลำดับ': idx + 1,
        'รหัสช่าง': w.workerCode,
        'ชื่อช่าง': w.workerName,
        'แผนก': w.dept,
        'จำนวนใบงาน': w.sheetCount,
        'จำนวนชิ้นรวม': w.totalUnits,
        'รายละเอียดรุ่นที่ผลิต': skuBreakdown,
        'ยอดเงินค่าแรงสุทธิ (บาท)': w.totalWage
      };
    });

    const detailRows = [];
    data.filteredSheets.forEach(s => {
      const pMeta = PayrollDB.getPeriodMetaFromKey(s.payrollPeriodKey);
      (s.items || []).forEach(it => {
        detailRows.push({
          'รหัสใบงาน': s.id,
          'วันที่ใบงาน': s.sheetDate,
          'งวดจ่ายเงิน': pMeta.periodLabel,
          'รหัสช่าง': s.workerCode,
          'ชื่อช่าง': s.workerName,
          'ลายมือชื่อช่าง': s.rawWorkerName,
          'แผนก': s.workerDept,
          'ลำดับในใบงาน': it.rowNo,
          'คำที่เขียนในใบงาน': it.rawModel,
          'SKU ที่จับคู่ได้': (it.matchedSku || '').toUpperCase(),
          'สี/รหัสผ้า': it.color,
          'จำนวนชิ้น': it.qty,
          'เรทค่าแรง/ชิ้น (บาท)': it.unitRate,
          'รวมเป็นเงิน (บาท)': it.lineTotal,
          'ช่องทาง/ผู้แจกงาน': it.channel,
          'ผู้รับเข้าสต็อก': it.stockReceiver,
          'หมายเหตุใบงาน': s.specialNote || ''
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsSum = XLSX.utils.json_to_sheet(summaryRows);
    const wsDet = XLSX.utils.json_to_sheet(detailRows);

    XLSX.utils.book_append_sheet(wb, wsSum, '1_สรุปยอดโอนรายคน');
    XLSX.utils.book_append_sheet(wb, wsDet, '2_รายละเอียดรายบรรทัด');

    const periodTag = data.selectedPeriod === 'ALL' ? 'ALL' : data.selectedPeriod;
    XLSX.writeFile(wb, `QueenCosy_Payroll_${periodTag}.xlsx`);
  }

  // ===========================================================================
  // TAB 5: EXECUTIVE MONTHLY DASHBOARD & MULTI-MONTH COMPARISON CHARTS
  // ===========================================================================
  const THAI_MONTHS_SHORT = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const THAI_MONTHS_FULL = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  function formatMonthKeyLabel(ymKey, full = false) {
    if (!ymKey || ymKey === 'ALL') return 'ทุกเดือนรวมกัน';
    const [yStr, mStr] = ymKey.split('-');
    const yearAD = parseInt(yStr, 10) || 2026;
    const monthNum = parseInt(mStr, 10) || 1;
    const yearBE = yearAD + 543;
    return full
      ? `${THAI_MONTHS_FULL[monthNum]} ${yearBE}`
      : `${THAI_MONTHS_SHORT[monthNum]} ${String(yearBE).slice(-2)}`;
  }

  function getMonthKeyFromSheet(sheet) {
    if (sheet.payrollPeriodKey && /^\d{4}-\d{2}/.test(sheet.payrollPeriodKey)) {
      return sheet.payrollPeriodKey.slice(0, 7);
    }
    if (sheet.sheetDate && /^\d{4}-\d{2}/.test(sheet.sheetDate)) {
      return sheet.sheetDate.slice(0, 7);
    }
    return '2026-06';
  }

  function initExecutiveDashboardUI() {
    const selectMonth = document.getElementById('dash-select-month');
    const selectTrendMode = document.getElementById('dash-select-trend-mode');
    const selectDept = document.getElementById('dash-select-dept');
    const btnSeedDemo = document.getElementById('btn-seed-demo-months');
    const btnClearDemo = document.getElementById('btn-clear-demo-months');
    const btnBackupJson = document.getElementById('btn-backup-history-json');
    const fileRestoreJson = document.getElementById('file-restore-history-json');

    [selectMonth, selectTrendMode, selectDept].forEach(el => {
      if (el) el.addEventListener('change', renderExecutiveDashboard);
    });

    if (btnSeedDemo) {
      btnSeedDemo.addEventListener('click', () => {
        const added = PayrollDB.seedDemoMultiMonthData();
        refreshAllViews();
        switchTab('dashboard');
        alert(`🧪 สร้างข้อมูลจำลองเปรียบเทียบ 3 เดือน (พ.ค., มิ.ย., ก.ค. 2569) จำนวน ${added} ใบงานเรียบร้อยแล้ว!\n\nคุณสามารถดูกราฟเปรียบเทียบรายเดือน/รายวิก, สัดส่วน SKU และอันดับช่างได้ทันที และกดปุ่ม "🗑️ ล้างข้อมูลจำลอง" ออกเมื่อไหร่ก็ได้ครับ`);
      });
    }

    if (btnClearDemo) {
      btnClearDemo.addEventListener('click', () => {
        const remain = PayrollDB.clearDemoSheets();
        refreshAllViews();
        alert(`🗑️ ล้างข้อมูลจำลองออกเรียบร้อยแล้ว (เหลือใบงานจริงในระบบ ${remain.length} ใบ)`);
      });
    }

    if (btnBackupJson) {
      btnBackupJson.addEventListener('click', () => {
        PayrollDB.exportHistoryBackupJson();
      });
    }

    if (fileRestoreJson) {
      fileRestoreJson.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const count = await PayrollDB.importHistoryBackupJson(file);
          refreshAllViews();
          alert(`📂 กู้คืนข้อมูลประวัติใบงานทั้งหมด (${count} ใบงาน) พร้อมตารางจับคู่ SKU/ชื่อช่าง เรียบร้อยแล้ว!`);
        } catch (err) {
          alert(`❌ ไม่สามารถกู้คืนไฟล์สำรองได้: ${err.message}`);
        } finally {
          fileRestoreJson.value = '';
        }
      });
    }
  }

  function renderExecutiveDashboard() {
    const allSheets = PayrollDB.getSavedSheets();
    const selectMonth = document.getElementById('dash-select-month');
    const selectTrendMode = document.getElementById('dash-select-trend-mode');
    const selectDept = document.getElementById('dash-select-dept');
    if (!selectMonth) return;

    const currentFocusMonth = selectMonth.value || 'ALL';
    const trendMode = selectTrendMode ? selectTrendMode.value : 'MONTHLY';
    const deptFilter = selectDept ? selectDept.value : 'ALL';

    // Populate unique months dropdown
    const allMonthKeys = Array.from(new Set(allSheets.map(getMonthKeyFromSheet))).sort().reverse();
    selectMonth.innerHTML = [
      `<option value="ALL">ทุกเดือนรวมกัน (${allSheets.length} ใบงาน)</option>`,
      ...allMonthKeys.map(ym => `<option value="${ym}" ${ym === currentFocusMonth ? 'selected' : ''}>📅 เดือน${formatMonthKeyLabel(ym, true)}</option>`)
    ].join('');

    const activeFocusMonth = allMonthKeys.includes(currentFocusMonth) ? currentFocusMonth : 'ALL';

    // Filter sheets by dept for overall trend & focus month
    const deptFilteredSheets = allSheets.filter(s => {
      if (deptFilter !== 'ALL' && s.workerDept !== deptFilter) return false;
      return true;
    });

    // Aggregate by Month (YYYY-MM) ascending for historical comparison
    const monthlyMap = new Map();
    deptFilteredSheets.forEach(s => {
      const ym = getMonthKeyFromSheet(s);
      if (!monthlyMap.has(ym)) {
        monthlyMap.set(ym, {
          ym,
          sheetCount: 0,
          totalUnits: 0,
          p1Wage: 0,
          p2Wage: 0,
          uphWage: 0,
          sewWage: 0,
          totalWage: 0,
          lateCount: 0
        });
      }
      const m = monthlyMap.get(ym);
      const wage = s.totalWage || 0;
      const units = s.totalUnits || 0;
      m.sheetCount += 1;
      m.totalUnits += units;
      m.totalWage += wage;
      if (String(s.payrollPeriodKey || '').endsWith('-P1')) {
        m.p1Wage += wage;
      } else {
        m.p2Wage += wage;
      }
      if (s.workerDept === 'เย็บ') {
        m.sewWage += wage;
      } else {
        m.uphWage += wage;
      }
      if (s.isLateCarryOver || (s.specialNote && /ล่าช้า|รวมยอด/.test(s.specialNote))) {
        m.lateCount += 1;
      }
    });

    const sortedMonths = Array.from(monthlyMap.values()).sort((a, b) => a.ym.localeCompare(b.ym));

    // Focus sheets (filtered by activeFocusMonth + deptFilter)
    const focusSheets = deptFilteredSheets.filter(s => {
      if (activeFocusMonth !== 'ALL' && getMonthKeyFromSheet(s) !== activeFocusMonth) return false;
      return true;
    });

    // Compute 6 KPI Cards for Focus Selection
    let focusTotalWage = 0;
    let focusP1Wage = 0;
    let focusP2Wage = 0;
    let focusUnits = 0;
    let focusUphWage = 0;
    let focusSewWage = 0;
    let focusLateCount = 0;
    const workerAgg = new Map();
    const skuAgg = new Map();
    const dailyUnits = new Array(31).fill(0);
    const dailyWages = new Array(31).fill(0);

    const skuMaster = PayrollDB.getSkuMappings();

    focusSheets.forEach(s => {
      const wage = s.totalWage || 0;
      const units = s.totalUnits || 0;
      focusTotalWage += wage;
      focusUnits += units;

      if (String(s.payrollPeriodKey || '').endsWith('-P1')) {
        focusP1Wage += wage;
      } else {
        focusP2Wage += wage;
      }

      if (s.workerDept === 'เย็บ') {
        focusSewWage += wage;
      } else {
        focusUphWage += wage;
      }

      if (s.isLateCarryOver || (s.specialNote && /ล่าช้า|รวมยอด/.test(s.specialNote))) {
        focusLateCount += 1;
      }

      // Worker aggregation
      const wKey = (s.workerCode || s.workerName || 'UNKNOWN').toLowerCase();
      if (!workerAgg.has(wKey)) {
        workerAgg.set(wKey, {
          code: s.workerCode || '-',
          name: s.workerName || 'ไม่ระบุ',
          dept: s.workerDept || 'หุ้ม',
          units: 0,
          wage: 0
        });
      }
      const wObj = workerAgg.get(wKey);
      wObj.units += units;
      wObj.wage += wage;

      // Daily rhythm (day 1..31)
      if (s.sheetDate && /^\d{4}-\d{2}-\d{2}$/.test(s.sheetDate)) {
        const day = parseInt(s.sheetDate.slice(8, 10), 10);
        if (day >= 1 && day <= 31) {
          dailyUnits[day - 1] += units;
          dailyWages[day - 1] += wage;
        }
      }

      // SKU aggregation
      (s.items || []).forEach(it => {
        const skuCode = (it.matchedSku || 'ไม่ระบุ').toUpperCase();
        if (!skuAgg.has(skuCode)) {
          const foundMaster = skuMaster.find(m => m.model.toUpperCase() === skuCode);
          skuAgg.set(skuCode, {
            sku: skuCode,
            name: foundMaster ? foundMaster.name : skuCode,
            units: 0,
            wage: 0
          });
        }
        const st = skuAgg.get(skuCode);
        st.units += (it.qty || 1);
        st.wage += (it.lineTotal || 0);
      });
    });

    // Update KPI 1: Total Wage & MoM
    const elTotalWage = document.getElementById('dash-kpi-total-wage');
    const elMomBadge = document.getElementById('dash-kpi-mom-badge');
    if (elTotalWage) elTotalWage.textContent = `${focusTotalWage.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;

    if (elMomBadge) {
      let targetMonthObj = null;
      let prevMonthObj = null;
      if (activeFocusMonth !== 'ALL') {
        const idx = sortedMonths.findIndex(m => m.ym === activeFocusMonth);
        if (idx >= 0) targetMonthObj = sortedMonths[idx];
        if (idx > 0) prevMonthObj = sortedMonths[idx - 1];
      } else if (sortedMonths.length >= 2) {
        targetMonthObj = sortedMonths[sortedMonths.length - 1];
        prevMonthObj = sortedMonths[sortedMonths.length - 2];
      }

      if (targetMonthObj && prevMonthObj && prevMonthObj.totalWage > 0) {
        const diffPct = ((targetMonthObj.totalWage - prevMonthObj.totalWage) / prevMonthObj.totalWage) * 100;
        const sign = diffPct >= 0 ? '▲ +' : '▼ ';
        elMomBadge.className = `text-[10px] font-black block ${diffPct >= 0 ? 'text-amber-300' : 'text-emerald-300'}`;
        elMomBadge.textContent = `${sign}${diffPct.toFixed(1)}% เทียบ ${formatMonthKeyLabel(prevMonthObj.ym)}`;
      } else {
        elMomBadge.className = 'text-[10px] font-bold text-slate-300 block';
        elMomBadge.textContent = `รวมจาก ${focusSheets.length} ใบงาน`;
      }
    }

    // Update KPI 2: P1 vs P2
    document.getElementById('dash-kpi-p1-wage').textContent = `${focusP1Wage.toLocaleString('th-TH')} ฿`;
    document.getElementById('dash-kpi-p2-wage').textContent = `${focusP2Wage.toLocaleString('th-TH')} ฿`;
    const p1Pct = focusTotalWage > 0 ? Math.round((focusP1Wage / focusTotalWage) * 100) : 0;
    const p2Pct = focusTotalWage > 0 ? 100 - p1Pct : 0;
    document.getElementById('dash-kpi-p1p2-ratio').textContent = `สัดส่วน วิก 1 (${p1Pct}%) : วิก 2 (${p2Pct}%)`;

    // Update KPI 3: Total Units & Avg Cost/Unit
    document.getElementById('dash-kpi-total-units').textContent = `${focusUnits.toLocaleString('th-TH')} ชิ้น`;
    const avgCost = focusUnits > 0 ? focusTotalWage / focusUnits : 0;
    document.getElementById('dash-kpi-avg-cost').textContent = `ต้นทุนค่าแรงเฉลี่ย ${avgCost.toFixed(2)} บาท/ชิ้น`;

    // Update KPI 4: Upholstery vs Sewing Split
    document.getElementById('dash-kpi-uph-wage').textContent = `${focusUphWage.toLocaleString('th-TH')} ฿`;
    document.getElementById('dash-kpi-sew-wage').textContent = `${focusSewWage.toLocaleString('th-TH')} ฿`;
    const uphPct = focusTotalWage > 0 ? Math.round((focusUphWage / focusTotalWage) * 100) : 0;
    const sewPct = focusTotalWage > 0 ? 100 - uphPct : 0;
    document.getElementById('dash-kpi-dept-ratio').textContent = `สัดส่วน หุ้ม ${uphPct}% | เย็บ ${sewPct}%`;

    // Update KPI 5: Top Worker MVP
    const sortedWorkers = Array.from(workerAgg.values()).sort((a, b) => b.wage - a.wage);
    const topW = sortedWorkers[0];
    if (topW) {
      document.getElementById('dash-kpi-top-worker').textContent = `${topW.name} (${topW.code} - ${topW.dept})`;
      document.getElementById('dash-kpi-top-worker-sub').textContent = `${topW.units.toLocaleString()} ชิ้น | ${topW.wage.toLocaleString('th-TH')} บาท`;
    } else {
      document.getElementById('dash-kpi-top-worker').textContent = '-';
      document.getElementById('dash-kpi-top-worker-sub').textContent = 'ยังไม่มีข้อมูล';
    }

    // Update KPI 6: Late Submission Alert
    document.getElementById('dash-kpi-late-sheets').textContent = `${focusLateCount} ใบ`;
    document.getElementById('dash-kpi-late-sub').textContent = `จากใบงานทั้งหมด ${focusSheets.length} ใบ`;

    // Render 4 Charts
    renderMonthlyTrendChart(sortedMonths, deptFilteredSheets, trendMode);
    renderSkuMixChart(Array.from(skuAgg.values()));
    renderWorkerRankChart(sortedWorkers.slice(0, 12));
    renderDailyRhythmChart(dailyUnits, dailyWages);

    // Render Historical Monthly Comparison Table
    renderMonthlyComparisonTable(sortedMonths);
  }

  function renderMonthlyTrendChart(sortedMonths, deptFilteredSheets, trendMode) {
    const canvas = document.getElementById('chart-monthly-trend');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartMonthlyTrend) {
      chartMonthlyTrend.destroy();
      chartMonthlyTrend = null;
    }

    let labels = [];
    let uphData = [];
    let sewData = [];
    let unitsData = [];

    if (trendMode === 'PERIOD') {
      // Group by Bi-Monthly Period (YYYY-MM-P1, YYYY-MM-P2)
      const periodMap = new Map();
      deptFilteredSheets.forEach(s => {
        const pk = s.payrollPeriodKey || '2026-06-P1';
        if (!periodMap.has(pk)) {
          periodMap.set(pk, { pk, uph: 0, sew: 0, units: 0 });
        }
        const entry = periodMap.get(pk);
        if (s.workerDept === 'เย็บ') entry.sew += (s.totalWage || 0);
        else entry.uph += (s.totalWage || 0);
        entry.units += (s.totalUnits || 0);
      });
      const sortedPeriods = Array.from(periodMap.values()).sort((a, b) => a.pk.localeCompare(b.pk));
      labels = sortedPeriods.map(p => {
        const ym = p.pk.slice(0, 7);
        const half = p.pk.endsWith('-P1') ? 'วิก1 (1-15)' : 'วิก2 (16-สิ้น)';
        return `${formatMonthKeyLabel(ym)} ${half}`;
      });
      uphData = sortedPeriods.map(p => p.uph);
      sewData = sortedPeriods.map(p => p.sew);
      unitsData = sortedPeriods.map(p => p.units);
    } else {
      labels = sortedMonths.map(m => formatMonthKeyLabel(m.ym, true));
      uphData = sortedMonths.map(m => m.uphWage);
      sewData = sortedMonths.map(m => m.sewWage);
      unitsData = sortedMonths.map(m => m.totalUnits);
    }

    chartMonthlyTrend = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '🔨 ค่าแรงช่างหุ้ม (บาท)',
            data: uphData,
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderColor: 'rgb(217, 119, 6)',
            borderWidth: 1,
            borderRadius: 6,
            stack: 'wageStack',
            yAxisID: 'y'
          },
          {
            label: '🧵 ค่าแรงช่างเย็บ (บาท)',
            data: sewData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: 'rgb(5, 150, 105)',
            borderWidth: 1,
            borderRadius: 6,
            stack: 'wageStack',
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: '🛋️ จำนวนชิ้นงานรวม (ชิ้น)',
            data: unitsData,
            borderColor: 'rgb(124, 58, 237)',
            backgroundColor: 'rgba(124, 58, 237, 0.15)',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: 'rgb(124, 58, 237)',
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } }
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            position: 'left',
            title: { display: true, text: 'ยอดค่าแรง (บาท)' }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'จำนวนชิ้นงาน (ชิ้น)' }
          }
        }
      }
    });
  }

  function renderSkuMixChart(skuList) {
    const canvas = document.getElementById('chart-sku-mix');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartSkuMix) {
      chartSkuMix.destroy();
      chartSkuMix = null;
    }

    const sorted = skuList.sort((a, b) => b.wage - a.wage);
    const top8 = sorted.slice(0, 8);
    const labels = top8.map(s => `${s.sku} (${s.units} ชิ้น)`);
    const data = top8.map(s => s.wage);

    const palette = [
      '#10b981', '#6366f1', '#f59e0b', '#ec4899',
      '#06b6d4', '#8b5cf6', '#ef4444', '#64748b'
    ];

    chartSkuMix = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['ยังไม่มีข้อมูล'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: data.length ? palette.slice(0, data.length) : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11, weight: 'bold' } } }
        }
      }
    });
  }

  function renderWorkerRankChart(topWorkers) {
    const canvas = document.getElementById('chart-worker-rank');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartWorkerRank) {
      chartWorkerRank.destroy();
      chartWorkerRank = null;
    }

    const labels = topWorkers.map(w => `${w.name} (${w.code})`);
    const wages = topWorkers.map(w => w.wage);
    const colors = topWorkers.map(w => w.dept === 'เย็บ' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.85)');

    chartWorkerRank = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'ยอดค่าแรงรวม (บาท) [สีส้ม=ช่างหุ้ม, สีเขียว=ช่างเย็บ]',
          data: wages,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } }
        },
        scales: {
          x: { title: { display: true, text: 'ยอดค่าแรงสุทธิ (บาท)' } }
        }
      }
    });
  }

  function renderDailyRhythmChart(dailyUnits, dailyWages) {
    const canvas = document.getElementById('chart-daily-rhythm');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartDailyRhythm) {
      chartDailyRhythm.destroy();
      chartDailyRhythm = null;
    }

    const labels = Array.from({ length: 31 }, (_, i) => `${i + 1}`);
    const barColors = labels.map((_, i) => {
      const day = i + 1;
      // Highlight cut-off days (14-15 and 29-31)
      if (day === 15 || day >= 30) return 'rgba(225, 29, 72, 0.85)';
      return 'rgba(79, 70, 229, 0.75)';
    });

    chartDailyRhythm = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'จำนวนชิ้นงานรายวัน (สีแดง = วันตัดวิก 15 & สิ้นเดือน)',
            data: dailyUnits,
            backgroundColor: barColors,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'ยอดค่าแรงรายวัน (บาท)',
            data: dailyWages,
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.25,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } }
        },
        scales: {
          x: { title: { display: true, text: 'วันที่ในเดือน (1 - 31)' } },
          y: { position: 'left', title: { display: true, text: 'จำนวนชิ้น' } },
          y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'บาท' } }
        }
      }
    });
  }

  function renderMonthlyComparisonTable(sortedMonths) {
    const tbody = document.getElementById('tbody-monthly-comparison');
    if (!tbody) return;

    if (sortedMonths.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="py-8 text-center text-slate-400">
            ยังไม่มีข้อมูลใบงานสะสม (กดปุ่ม <strong>"🧪 จำลองข้อมูล 3 เดือนเพื่อดูกราฟ"</strong> ด้านบนเพื่อดูตัวอย่างตารางและกราฟเปรียบเทียบได้ทันทีครับ)
          </td>
        </tr>
      `;
      return;
    }

    // Show newest month on top, but compute MoM against previous chronological month
    const rowsHtml = sortedMonths.map((m, idx) => {
      const prev = idx > 0 ? sortedMonths[idx - 1] : null;
      let momHtml = `<span class="text-slate-400">-</span>`;
      if (prev && prev.totalWage > 0) {
        const pct = ((m.totalWage - prev.totalWage) / prev.totalWage) * 100;
        if (pct > 0) {
          momHtml = `<span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800">▲ +${pct.toFixed(1)}%</span>`;
        } else if (pct < 0) {
          momHtml = `<span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">▼ ${pct.toFixed(1)}%</span>`;
        } else {
          momHtml = `<span class="text-slate-500 font-bold">0.0%</span>`;
        }
      }

      const avg = m.totalUnits > 0 ? m.totalWage / m.totalUnits : 0;

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3 px-3 font-black text-slate-900">📅 ${formatMonthKeyLabel(m.ym, true)}</td>
          <td class="py-3 px-3 text-center font-mono font-bold text-slate-700">${m.sheetCount} ใบ</td>
          <td class="py-3 px-3 text-center font-mono font-black text-indigo-700">${m.totalUnits.toLocaleString()} ชิ้น</td>
          <td class="py-3 px-3 text-right font-mono font-bold text-cyan-700">${m.p1Wage.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          <td class="py-3 px-3 text-right font-mono font-bold text-amber-700">${m.p2Wage.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-700">${m.uphWage.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-700">${m.sewWage.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          <td class="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">${m.totalWage.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</td>
          <td class="py-3 px-3 text-right font-mono text-slate-600">${avg.toFixed(2)} ฿</td>
          <td class="py-3 px-3 text-center">${momHtml}</td>
        </tr>
      `;
    }).reverse().join('');

    tbody.innerHTML = rowsHtml;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
