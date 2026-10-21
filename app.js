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

    refreshAllViews();
  });

  function refreshAllViews() {
    renderSkuMappingTable();
    renderWorkerMappingTable();
    renderQueueList();
    renderReviewSelectorAndWorkspace();
    renderPayrollDashboard();
    updateHeaderBadges();
  }

  function updateHeaderBadges() {
    const cfg = PayrollDB.getConfig();
    const apiBadge = document.getElementById('badge-api-status');
    if (apiBadge) {
      if (cfg.geminiApiKey) {
        apiBadge.className = 'px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
        apiBadge.textContent = `🟢 Gemini AI พร้อมใช้งาน (${cfg.geminiModel || 'gemini-2.5-flash'})`;
      } else {
        apiBadge.className = 'px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300';
        apiBadge.textContent = '🔑 รอตั้งค่า Gemini API Key';
      }
    }

    const qCount = document.getElementById('badge-queue-count');
    if (qCount) qCount.textContent = String(captureQueue.length);

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

    if (inputKey) inputKey.value = cfg.geminiApiKey || '';
    if (selectModel && cfg.geminiModel) selectModel.value = cfg.geminiModel;

    if (cfg.geminiApiKey && pill) {
      pill.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40';
      pill.textContent = 'บันทึกคีย์แล้ว';
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
      btnClearFinished.addEventListener('click', () => {
        captureQueue = captureQueue.filter(q => q.status !== 'DONE');
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

    const maxDim = 1600;
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

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const item = {
      id: 'Q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      name: `ภาพถ่ายใบงาน #${captureQueue.length + 1} (${new Date().toLocaleTimeString('th-TH')})`,
      imageDataUrl: dataUrl,
      status: 'PENDING',
      errorMsg: '',
      sheetId: null
    };
    captureQueue.unshift(item);
    renderQueueList();
    updateHeaderBadges();

    const autoScan = document.getElementById('chk-auto-ai-scan')?.checked;
    if (autoScan) {
      processQueueItem(item.id);
    }
  }

  function enqueueImageFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resizeImageDataUrl(e.target.result, 1600, 0.85).then(resizedUrl => {
          const item = {
            id: 'Q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            name: file.name,
            imageDataUrl: resizedUrl,
            status: 'PENDING',
            errorMsg: '',
            sheetId: null
          };
          captureQueue.unshift(item);
          renderQueueList();
          updateHeaderBadges();

          const autoScan = document.getElementById('chk-auto-ai-scan')?.checked;
          if (autoScan && PayrollDB.getConfig().geminiApiKey) {
            processQueueItem(item.id);
          }
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function resizeImageDataUrl(dataUrl, maxDim = 1600, quality = 0.85) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w <= maxDim && h <= maxDim) {
          resolve(dataUrl);
          return;
        }
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
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

  async function processQueueItem(queueId) {
    const item = captureQueue.find(q => q.id === queueId);
    if (!item || item.status === 'PROCESSING') return;

    item.status = 'PROCESSING';
    item.errorMsg = '';
    renderQueueList();

    try {
      const parsedSheet = await PayrollDB.analyzeJobSheetWithGemini(item.imageDataUrl);
      const saved = PayrollDB.upsertSheet(parsedSheet);
      item.status = 'DONE';
      item.sheetId = saved.id;
      activeSheetId = saved.id;
      refreshAllViews();
    } catch (err) {
      item.status = 'ERROR';
      item.errorMsg = err.message || 'เกิดข้อผิดพลาดในการอ่านรูปใบงาน';
      renderQueueList();
    }
  }

  async function processAllPendingQueue() {
    const pending = captureQueue.filter(q => q.status === 'PENDING' || q.status === 'ERROR');
    if (pending.length === 0) {
      alert('ไม่มีรายการที่รออ่านในคิว');
      return;
    }
    for (const item of pending) {
      await processQueueItem(item.id);
    }
  }

  function renderQueueList() {
    const container = document.getElementById('queue-list-container');
    if (!container) return;

    if (captureQueue.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          ยังไม่มีใบงานในคิว กดถ่ายรูปหรือลากไฟล์รูปมาวางได้เลยครับ
        </div>
      `;
      return;
    }

    container.innerHTML = captureQueue.map(q => {
      let badgeHtml = '';
      if (q.status === 'PENDING') {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">รออ่าน</span>`;
      } else if (q.status === 'PROCESSING') {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">⏳ AI กำลังอ่าน...</span>`;
      } else if (q.status === 'DONE') {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">✅ อ่านสำเร็จ</span>`;
      } else {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">❌ ไม่สำเร็จ</span>`;
      }

      return `
        <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
          <div class="flex items-center gap-2.5 min-w-0">
            <img src="${q.imageDataUrl}" class="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0">
            <div class="min-w-0">
              <div class="font-bold text-slate-800 truncate">${escapeHtml(q.name)}</div>
              <div class="text-[10px] text-rose-600 truncate">${escapeHtml(q.errorMsg || '')}</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${badgeHtml}
            ${q.status === 'DONE' && q.sheetId ? `<button type="button" class="btn-open-done-sheet px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px]" data-sheet-id="${q.sheetId}">ดูผลลัพธ์</button>` : ''}
            ${(q.status === 'PENDING' || q.status === 'ERROR') ? `<button type="button" class="btn-retry-queue px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px]" data-qid="${q.id}">อ่านด้วย AI</button>` : ''}
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
        if (!sheet || !sheet.imageDataUrl) {
          alert('ใบงานนี้ไม่มีรูปภาพต้นฉบับสำหรับสแกนใหม่');
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

    // Add Row & Save Verified Sheet
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

    // Image
    const imgEl = document.getElementById('review-sheet-image');
    if (imgEl) {
      imgEl.src = sheet.imageDataUrl || 'sample_jobsheet.jpg';
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
      tbody.innerHTML = (sheet.items || []).map((item, idx) => {
        const skuOptions = [
          `<option value="">-- เลือก SKU --</option>`,
          ...skuList.map(s => {
            const rate = sheet.workerDept === 'เย็บ' ? s.sewingWage : s.upholsteryWage;
            return `<option value="${escapeHtml(s.model)}" ${s.model.toLowerCase() === String(item.matchedSku || '').toLowerCase() ? 'selected' : ''}>${s.model.toUpperCase()} - ${escapeHtml(s.name.slice(0, 26))} (${rate}฿)</option>`;
          })
        ].join('');

        return `
          <tr class="${item.matchedSku ? 'hover:bg-slate-50' : 'bg-amber-50'}" data-item-idx="${idx}">
            <td class="py-1.5 px-2 text-center font-mono font-bold text-slate-500">${idx + 1}</td>
            <td class="py-1.5 px-2">
              <div class="flex items-center gap-1">
                <input type="text" class="rev-item-raw w-full px-2 py-1 font-mono font-bold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg text-xs" value="${escapeHtml(item.rawModel || '')}">
                <button type="button" class="btn-learn-item-sku px-1.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold shrink-0" data-idx="${idx}" title="จำคำในใบงานนี้ให้ตรงกับ SKU ที่เลือก">📌จำ</button>
              </div>
            </td>
            <td class="py-1.5 px-2">
              <select class="rev-item-sku w-full px-2 py-1 font-bold rounded-lg border text-xs ${item.matchedSku ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950' : 'border-amber-400 bg-amber-100 text-amber-950'}">
                ${skuOptions}
              </select>
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
              <button type="button" class="btn-del-rev-item text-rose-500 hover:text-rose-700 font-bold" data-idx="${idx}">✕</button>
            </td>
          </tr>
        `;
      }).join('');

      // Live recalculate when SKU or Qty changes
      tbody.querySelectorAll('.rev-item-sku, .rev-item-qty').forEach(el => {
        el.addEventListener('change', () => {
          syncReviewTableToSheetObject(sheet);
          PayrollDB.upsertSheet(sheet);
          renderReviewSelectorAndWorkspace();
        });
      });

      // Learn SKU alias button
      tbody.querySelectorAll('.btn-learn-item-sku').forEach(btn => {
        btn.addEventListener('click', () => {
          syncReviewTableToSheetObject(sheet);
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          const targetItem = sheet.items[idx];
          if (!targetItem || !targetItem.rawModel || !targetItem.matchedSku) {
            alert('กรุณาพิมพ์คำในใบงานและเลือกรหัส SKU โรงงานก่อนกดจำ');
            return;
          }
          PayrollDB.learnSkuAlias(targetItem.rawModel, targetItem.matchedSku);
          renderSkuMappingTable();
          alert(`📌 จำคำว่า "${targetItem.rawModel}" ➔ SKU "${targetItem.matchedSku.toUpperCase()}" เข้าตารางจับคู่เรียบร้อยแล้ว!`);
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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
