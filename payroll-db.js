/**
 * QueenCosy AI Payroll & Job Sheet Scanner - Data, Mapping & Gemini Vision Service
 * Standalone module (100% isolated from traceability-web QR operations, shares read-only Master Wage/Worker sync)
 */
const PayrollDB = (function () {
  'use strict';

  const STORAGE_KEYS = {
    CONFIG: 'qc_payroll_config_v1',
    SKU_MAP: 'qc_payroll_sku_mapping_v1',
    WORKER_MAP: 'qc_payroll_worker_mapping_v1',
    SHEETS: 'qc_payroll_sheets_v1'
  };

  // Shared Supabase & Google Sheet Master sources (from QueenCosy system)
  const DEFAULT_SUPABASE_URL = 'https://yercmidyvfetvbbrewlf.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcmNtaWR5dmZldHZiYnJld2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTA4MzUsImV4cCI6MjEwNDE4NjgzNX0.7tGbXNoogdLh6UQOJBJe9MABmY7W5J1aixPLJSXGSGk';
  const DEFAULT_WAGE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1gllvDgFUmXSGtGEkbw_COHJC18_fFD9-icubSpzVvbU/export?format=csv&gid=0';
  const DEFAULT_WORKER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1GO6Xg2Nn0-rtk4YcrDaBmk3ncU-ANFpl4-EZJjwG5RM/export?format=csv&gid=0';

  // Default 18 Master SKU Models with Upholstery (ค่าหุ้ม) & Sewing (ค่าเย็บ) wages + Initial Handwritten Aliases
  const DEFAULT_SKU_MAPPINGS = [
    {
      model: 'mn',
      name: 'โซฟาตัวแอลมินิมอล (Mn/Mncf/Mnh/Mnn/Mnpy)',
      category: 'ตัวแอล',
      upholsteryWage: 170,
      sewingWage: 50,
      aliases: ['mn', 'mnh', 'mncf', 'mnn', 'mnpy', 'แอลมินิมอล', 'ตัวแอล', 'โซฟาแอล'],
      note: 'โซฟาตัวแอลมินิมอล ซ้าย/ขวา'
    },
    {
      model: 'ln3',
      name: 'โซฟา 3 ที่นั่งกระดุมวางแก้ว (ln3)',
      category: 'ตัวใหญ่',
      upholsteryWage: 140,
      sewingWage: 30,
      aliases: ['ln3', '3◊11', '3<>11', '3 ◊ 11', '3 ข้าวหลามตัด 11', '3ข้าวหลามตัด11', '3◊11(ln3)', '3011(ln3)'],
      note: 'ในใบงานเขียน 3 ข้าวหลามตัด 11 หรือมีวงเล็บ (LN3)'
    },
    {
      model: 'rcs',
      name: 'โซฟาเบดปรับนอนเรียบ (rcs)',
      category: 'โซฟาเบด',
      upholsteryWage: 130,
      sewingWage: 20,
      aliases: ['rcs', 'เบดเรียบ', 'ปรับนอนเรียบ'],
      note: 'โซฟาเบดปรับนอนแบบเรียบ'
    },
    {
      model: 'rc',
      name: 'โซฟาเบดปรับนอน (rc/rcII/rch/rcn/rcw)',
      category: 'โซฟาเบด',
      upholsteryWage: 130,
      sewingWage: 20,
      aliases: ['rc', 'rcii', 'rch', 'rcn', 'rcw', 'โซฟาเบด', 'เบดปรับนอน'],
      note: 'โซฟาเบดปรับนอนดึงกระดุม'
    },
    {
      model: 'bs3s',
      name: 'โซฟา 3 ที่นั่งเรียบมีแขน (bs3s)',
      category: 'ตัวใหญ่',
      upholsteryWage: 120,
      sewingWage: 35,
      aliases: ['bs3s', '3เรียบมีแขน', '311เรียบ'],
      note: 'โซฟา 3 ที่นั่งแบบเรียบมีแขน'
    },
    {
      model: 'bs3',
      name: 'โซฟา 3 ที่นั่งท้าวแขน (bs3)',
      category: 'ตัวใหญ่',
      upholsteryWage: 120,
      sewingWage: 35,
      aliases: ['bs3', '3 11 lit', '311 lit', '3 11 lit(bs3)', '311lit', '3◊3 lit', '3 ข้าวหลามตัด 3 lit'],
      note: 'ในใบงานเขียน 3 11 Lit หรือมีวงเล็บ (BS3)'
    },
    {
      model: 'rss',
      name: 'โซฟาเบดหัวกระดกเรียบ (rss)',
      category: 'โซฟาเบด',
      upholsteryWage: 120,
      sewingWage: 20,
      aliases: ['rss', 'หัวกระดกเรียบ', 'กระดกเรียบ'],
      note: 'โซฟาเบดหัวกระดกแบบเรียบ'
    },
    {
      model: 'rs',
      name: 'โซฟาเบดหัวกระดก (rs/rsII/rsh/rsn/rsw)',
      category: 'โซฟาเบด',
      upholsteryWage: 120,
      sewingWage: 20,
      aliases: ['rs', 'rsii', 'rsh', 'rsn', 'rsw', 'หัวกระดก'],
      note: 'โซฟาเบดหัวกระดก'
    },
    {
      model: 'lz',
      name: 'โซฟา 3 ที่นั่งเบาะกระดุมเล็ก (lz)',
      category: 'ตัวใหญ่',
      upholsteryWage: 120,
      sewingWage: 15,
      aliases: ['lz', 'กระดุมเล็ก', 'เบาะกระดุมเล็ก'],
      note: 'โซฟา 3 ที่นั่งเบาะกระดุมเล็ก'
    },
    {
      model: 'lu3',
      name: 'โซฟา 3 ที่นั่งวางแก้ว (lu3)',
      category: 'ตัวใหญ่',
      upholsteryWage: 110,
      sewingWage: 30,
      aliases: ['lu3', '3วางแก้วเรียบ', '3 วางแก้ว'],
      note: 'โซฟา 3 ที่นั่งวางแก้วแบบเรียบ'
    },
    {
      model: 'bs2',
      name: 'โซฟา 2 ที่นั่งท้าวแขน (bs2)',
      category: 'ตัวใหญ่',
      upholsteryWage: 90,
      sewingWage: 20,
      aliases: ['bs2', '3◊2 lit', '3<>2 lit', '3 ◊ 2 lit', '3 ข้าวหลามตัด 2 lit', '3ข้าวหลามตัด2lit', '2 lit', '2lit', '2 11 lit', '211 lit'],
      note: 'ในใบงานเขียน 3 เครื่องหมายข้าวหลามตัด 2 lit หรือ 2 lit'
    },
    {
      model: 'cs3',
      name: 'โซฟา 3 ที่นั่งเรียบเบาะใหญ่ (cs3)',
      category: 'ตัวเล็ก',
      upholsteryWage: 50,
      sewingWage: 13,
      aliases: ['cs3', '3เรียบเบาะใหญ่', 'เบาะใหญ่3'],
      note: 'โซฟา 3 ที่นั่งเรียบเบาะใหญ่'
    },
    {
      model: 'cs2',
      name: 'โซฟา 2 ที่นั่งเรียบเบาะใหญ่ (cs2)',
      category: 'ตัวเล็ก',
      upholsteryWage: 40,
      sewingWage: 10,
      aliases: ['cs2', '2เรียบเบาะใหญ่', 'เบาะใหญ่2'],
      note: 'โซฟา 2 ที่นั่งเรียบเบาะใหญ่'
    },
    {
      model: 'cu',
      name: 'เก้าอี้สตูลเหลี่ยม (cu)',
      category: 'สตูล',
      upholsteryWage: 20,
      sewingWage: 4,
      aliases: ['cu', 'st□', 'st □', 'st[]', 'st []', 'st สี่เหลี่ยม', 'stสี่เหลี่ยม', 'สตูลเหลี่ยม', 'สตูลสี่เหลี่ยม'],
      note: 'ในใบงานเขียน st สี่เหลี่ยม (st □)'
    },
    {
      model: 'cl',
      name: 'เก้าอี้สตูลกลม (cl)',
      category: 'สตูล',
      upholsteryWage: 20,
      sewingWage: 4,
      aliases: ['cl', 'st○', 'st ○', 'st()', 'st กลม', 'stกลม', 'สตูลกลม', 'st วงกลม'],
      note: 'เก้าอี้สตูลกลม (st ○)'
    },
    {
      model: 'rv3',
      name: 'ผ้าเปลี่ยนผิวโซฟา 3 ที่นั่ง (Rv3)',
      category: 'อุปกรณ์เสริม',
      upholsteryWage: 13,
      sewingWage: 13,
      aliases: ['rv3', 'ผ้าเปลี่ยน3', 'ผ้าคลุม3'],
      note: 'ผ้าเปลี่ยนผิวโซฟา 3 ที่นั่ง'
    },
    {
      model: 'rv2',
      name: 'ผ้าเปลี่ยนผิวโซฟา 2 ที่นั่ง (Rv2)',
      category: 'อุปกรณ์เสริม',
      upholsteryWage: 10,
      sewingWage: 10,
      aliases: ['rv2', 'ผ้าเปลี่ยน2', 'ผ้าคลุม2'],
      note: 'ผ้าเปลี่ยนผิวโซฟา 2 ที่นั่ง'
    },
    {
      model: 'pl',
      name: 'หมอนอิง (Pl/Plcf/Plh/Pln/Plpy)',
      category: 'สตูล',
      upholsteryWage: 3,
      sewingWage: 3,
      aliases: ['pl', 'plcf', 'plh', 'pln', 'plpy', 'หมอน', 'หมอนอิง'],
      note: 'หมอนอิงทุกสี/ทุกรุ่น'
    }
  ];

  // Default 23 Master Workers from QueenCosy System + Handwritten Aliases
  const DEFAULT_WORKER_MAPPINGS = [
    { code: 'cv1',  name: 'นาย',     dept: 'หุ้ม', aliases: ['นาย', 'cv1', 'nai'] },
    { code: 'cv2',  name: 'เอ',      dept: 'หุ้ม', aliases: ['เอ', 'cv2', 'a', 'ae'] },
    { code: 'cv3',  name: 'บายมอญ',  dept: 'หุ้ม', aliases: ['บายมอญ', 'cv3', 'blai morn', 'blai mon', 'blaimorn', 'blaimon', 'บายมอน', 'บานมอญ'] },
    { code: 'cv4',  name: 'พู',      dept: 'หุ้ม', aliases: ['พู', 'cv4', 'phu', 'poo'] },
    { code: 'cv5',  name: 'หลวย',    dept: 'หุ้ม', aliases: ['หลวย', 'cv5', 'luay'] },
    { code: 'cv6',  name: 'ตะไป',    dept: 'หุ้ม', aliases: ['ตะไป', 'cv6', 'tapai'] },
    { code: 'cv7',  name: 'โทน',     dept: 'หุ้ม', aliases: ['โทน', 'cv7', 'tone', 'thon'] },
    { code: 'cv8',  name: 'จอซียะ',  dept: 'หุ้ม', aliases: ['จอซียะ', 'cv8', 'jorsiya'] },
    { code: 'cv9',  name: 'ตู๋มิธ',   dept: 'หุ้ม', aliases: ['ตู๋มิธ', 'cv9', 'tumit'] },
    { code: 'cv10', name: 'วินเหวง',  dept: 'หุ้ม', aliases: ['วินเหวง', 'cv10', 'winweng', 'win'] },
    { code: 'cv11', name: 'ไซ',      dept: 'หุ้ม', aliases: ['ไซ', 'cv11', 'sai'] },
    { code: 'cv12', name: 'แทนไท',   dept: 'หุ้ม', aliases: ['แทนไท', 'cv12', 'thaenthai'] },
    { code: 'cv13', name: 'ศิริชัย',  dept: 'หุ้ม', aliases: ['ศิริชัย', 'cv13', 'sirichai'] },
    { code: 'cv14', name: 'ชา',      dept: 'หุ้ม', aliases: ['ชา', 'cv14', 'cha'] },
    { code: 'cv15', name: 'มิ้นท์',    dept: 'หุ้ม', aliases: ['มิ้นท์', 'มิ้น', 'cv15', 'mint'] },
    { code: 'cv16', name: 'ตู 2',    dept: 'หุ้ม', aliases: ['ตู 2', 'ตู2', 'cv16', 'tu 2', 'tu2'] },
    { code: 'cv17', name: 'เอโป',    dept: 'หุ้ม', aliases: ['เอโป', 'cv17', 'apo', 'a-po'] },
    { code: 'sew1', name: 'อ่อน',     dept: 'เย็บ', aliases: ['อ่อน', 'sew1', 'on', 'aon'] },
    { code: 'sew2', name: 'เนยู',     dept: 'เย็บ', aliases: ['เนยู', 'sew2', 'neyu'] },
    { code: 'sew3', name: 'บี',       dept: 'เย็บ', aliases: ['บี', 'sew3', 'bee', 'b'] },
    { code: 'sew4', name: 'มุ่ย',      dept: 'เย็บ', aliases: ['มุ่ย', 'sew4', 'mui'] },
    { code: 'sew5', name: 'แมว',      dept: 'เย็บ', aliases: ['แมว', 'sew5', 'maew', 'cat'] },
    { code: 'sew6', name: 'แจ๊ค',     dept: 'เย็บ', aliases: ['แจ๊ค', 'แจ็ค', 'sew6', 'jack'] }
  ];

  let supabaseClient = null;

  function getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}');
      return {
        geminiApiKey: saved.geminiApiKey || '',
        geminiModel: saved.geminiModel || 'gemini-2.5-flash',
        supabaseUrl: saved.supabaseUrl || DEFAULT_SUPABASE_URL,
        supabaseKey: saved.supabaseKey || DEFAULT_SUPABASE_KEY,
        autoScanOnCapture: saved.autoScanOnCapture !== undefined ? saved.autoScanOnCapture : true
      };
    } catch (e) {
      return {
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        supabaseUrl: DEFAULT_SUPABASE_URL,
        supabaseKey: DEFAULT_SUPABASE_KEY,
        autoScanOnCapture: true
      };
    }
  }

  function saveConfig(newCfg) {
    const merged = { ...getConfig(), ...newCfg };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(merged));
    initSupabase();
    return merged;
  }

  function initSupabase() {
    const cfg = getConfig();
    if (typeof window !== 'undefined' && window.supabase && cfg.supabaseUrl && cfg.supabaseKey) {
      try {
        supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
      } catch (e) {
        console.warn('Supabase init warning:', e);
      }
    }
  }

  // ===========================================================================
  // SKU & WORKER MAPPING MANAGEMENT
  // ===========================================================================
  function getSkuMappings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SKU_MAP);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_SKU_MAPPINGS));
  }

  function saveSkuMappings(list) {
    if (!Array.isArray(list)) return;
    localStorage.setItem(STORAGE_KEYS.SKU_MAP, JSON.stringify(list));
  }

  function getWorkerMappings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WORKER_MAP);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_WORKER_MAPPINGS));
  }

  function saveWorkerMappings(list) {
    if (!Array.isArray(list)) return;
    localStorage.setItem(STORAGE_KEYS.WORKER_MAP, JSON.stringify(list));
  }

  function resetMappingsToDefault() {
    localStorage.removeItem(STORAGE_KEYS.SKU_MAP);
    localStorage.removeItem(STORAGE_KEYS.WORKER_MAP);
  }

  // Add a single alias to a model and persist immediately ("จำคำนี้ไว้ใช้ครั้งหน้า")
  function learnSkuAlias(rawHandwriting, targetModel) {
    if (!rawHandwriting || !targetModel) return false;
    const cleanAlias = String(rawHandwriting).trim();
    const cleanModel = String(targetModel).trim().toLowerCase();
    const list = getSkuMappings();
    const found = list.find(m => m.model.toLowerCase() === cleanModel);
    if (!found) return false;
    if (!Array.isArray(found.aliases)) found.aliases = [];
    const exists = found.aliases.some(a => normalizeSymbolText(a) === normalizeSymbolText(cleanAlias));
    if (!exists) {
      found.aliases.push(cleanAlias);
      saveSkuMappings(list);
    }
    return true;
  }

  function learnWorkerAlias(rawWorkerText, targetWorkerCode) {
    if (!rawWorkerText || !targetWorkerCode) return false;
    const cleanAlias = String(rawWorkerText).trim();
    const cleanCode = String(targetWorkerCode).trim().toLowerCase();
    const list = getWorkerMappings();
    const found = list.find(w => w.code.toLowerCase() === cleanCode);
    if (!found) return false;
    if (!Array.isArray(found.aliases)) found.aliases = [];
    const exists = found.aliases.some(a => a.trim().toLowerCase() === cleanAlias.toLowerCase());
    if (!exists) {
      found.aliases.push(cleanAlias);
      saveWorkerMappings(list);
    }
    return true;
  }

  // ===========================================================================
  // SMART NORMALIZATION & MATCHING ENGINE (รองรับสัญลักษณ์ ข้าวหลามตัด ◊, สี่เหลี่ยม □)
  // ===========================================================================
  function normalizeSymbolText(str) {
    if (!str) return '';
    let s = String(str).toLowerCase().trim();
    // Normalize diamond symbols/words -> <>
    s = s.replace(/ข้าวหลามตัด|เครื่องหมายข้าวหลามตัด|เพชร|diamond|<diamond>|\[diamond\]/gi, '<>');
    s = s.replace(/[◊◇♦◆❖]/g, '<>');
    s = s.replace(/<\s*>/g, '<>');
    // Normalize square symbols/words -> []
    s = s.replace(/สี่เหลี่ยม|เหลี่ยม|square|<square>|\[square\]/gi, '[]');
    s = s.replace(/[□■▢▣]/g, '[]');
    s = s.replace(/\[\s*\]/g, '[]');
    // Normalize circle symbols/words -> ()
    s = s.replace(/วงกลม|กลม|circle|<circle>/gi, '()');
    s = s.replace(/[○◯●◎]/g, '()');
    // Remove spaces and punctuation except <>[]()
    s = s.replace(/\s+/g, '');
    return s;
  }

  function matchSkuFromText(rawText) {
    if (!rawText) return { matched: false, model: '', name: '', upholsteryWage: 0, sewingWage: 0, confidence: 'NONE' };
    const raw = String(rawText).trim();
    const skuList = getSkuMappings();

    // 1. Check if there's an explicit code inside parentheses or angle brackets, e.g., "3 ◊ 11 (LN3)" or "311 Lit <BS3>"
    const bracketMatch = raw.match(/[\(\[<]([a-zA-Z0-9]{2,6})[\)\]>]/);
    if (bracketMatch && bracketMatch[1]) {
      const codeCandidate = bracketMatch[1].toLowerCase().trim();
      const byBracket = skuList.find(m => m.model.toLowerCase() === codeCandidate);
      if (byBracket) {
        return {
          matched: true,
          model: byBracket.model,
          name: byBracket.name,
          upholsteryWage: Number(byBracket.upholsteryWage) || 0,
          sewingWage: Number(byBracket.sewingWage) || 0,
          confidence: 'EXACT_BRACKET'
        };
      }
    }

    const normInput = normalizeSymbolText(raw);
    const strippedInput = normInput.replace(/[\(\)<>\[\]]/g, '');

    // 2. Exact match on model code or normalized alias
    for (const item of skuList) {
      if (item.model.toLowerCase() === normInput || item.model.toLowerCase() === strippedInput) {
        return {
          matched: true,
          model: item.model,
          name: item.name,
          upholsteryWage: Number(item.upholsteryWage) || 0,
          sewingWage: Number(item.sewingWage) || 0,
          confidence: 'EXACT_MODEL'
        };
      }
      for (const alias of (item.aliases || [])) {
        const normAlias = normalizeSymbolText(alias);
        if (normAlias && (normAlias === normInput || normAlias === strippedInput)) {
          return {
            matched: true,
            model: item.model,
            name: item.name,
            upholsteryWage: Number(item.upholsteryWage) || 0,
            sewingWage: Number(item.sewingWage) || 0,
            confidence: 'EXACT_ALIAS'
          };
        }
      }
    }

    // 3. Substring / Partial match (longest alias first)
    const allAliasPairs = [];
    skuList.forEach(item => {
      (item.aliases || []).forEach(alias => {
        const na = normalizeSymbolText(alias);
        if (na.length >= 2) {
          allAliasPairs.push({ normAlias: na, item });
        }
      });
    });
    allAliasPairs.sort((a, b) => b.normAlias.length - a.normAlias.length);

    for (const pair of allAliasPairs) {
      if (normInput.includes(pair.normAlias)) {
        return {
          matched: true,
          model: pair.item.model,
          name: pair.item.name,
          upholsteryWage: Number(pair.item.upholsteryWage) || 0,
          sewingWage: Number(pair.item.sewingWage) || 0,
          confidence: 'PARTIAL_ALIAS'
        };
      }
    }

    // 4. Special heuristic rules for common handwriting patterns
    if (/3.*(<>|0).*2.*lit/i.test(normInput) || /2.*lit/i.test(normInput)) {
      const bs2 = skuList.find(m => m.model === 'bs2');
      if (bs2) return { matched: true, model: 'bs2', name: bs2.name, upholsteryWage: bs2.upholsteryWage, sewingWage: bs2.sewingWage, confidence: 'HEURISTIC' };
    }
    if (/3.*11.*lit/i.test(normInput)) {
      const bs3 = skuList.find(m => m.model === 'bs3');
      if (bs3) return { matched: true, model: 'bs3', name: bs3.name, upholsteryWage: bs3.upholsteryWage, sewingWage: bs3.sewingWage, confidence: 'HEURISTIC' };
    }
    if (/3.*(<>|0).*11/i.test(normInput)) {
      const ln3 = skuList.find(m => m.model === 'ln3');
      if (ln3) return { matched: true, model: 'ln3', name: ln3.name, upholsteryWage: ln3.upholsteryWage, sewingWage: ln3.sewingWage, confidence: 'HEURISTIC' };
    }
    if (/st.*\[\]/i.test(normInput)) {
      const cu = skuList.find(m => m.model === 'cu');
      if (cu) return { matched: true, model: 'cu', name: cu.name, upholsteryWage: cu.upholsteryWage, sewingWage: cu.sewingWage, confidence: 'HEURISTIC' };
    }

    return { matched: false, model: '', name: 'ยังไม่จับคู่ SKU', upholsteryWage: 0, sewingWage: 0, confidence: 'NONE' };
  }

  function matchWorkerFromText(rawName) {
    if (!rawName) return { matched: false, code: '', name: '', dept: 'หุ้ม' };
    const clean = String(rawName).trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
    const compact = clean.replace(/\s+/g, '');
    const workers = getWorkerMappings();

    // 1. Exact match on code, name, or aliases
    for (const w of workers) {
      if (w.code.toLowerCase() === compact || w.name.toLowerCase() === clean) {
        return { matched: true, code: w.code, name: w.name, dept: w.dept };
      }
      for (const alias of (w.aliases || [])) {
        const aClean = String(alias).trim().toLowerCase().replace(/\./g, '');
        const aCompact = aClean.replace(/\s+/g, '');
        if (aClean && (aClean === clean || aCompact === compact)) {
          return { matched: true, code: w.code, name: w.name, dept: w.dept };
        }
      }
    }

    // 2. Partial match
    for (const w of workers) {
      for (const alias of (w.aliases || [])) {
        const aCompact = String(alias).trim().toLowerCase().replace(/[\.\s]+/g, '');
        if (aCompact.length >= 3 && (compact.includes(aCompact) || aCompact.includes(compact))) {
          return { matched: true, code: w.code, name: w.name, dept: w.dept };
        }
      }
    }

    return { matched: false, code: '', name: rawName.trim(), dept: 'หุ้ม' };
  }

  // ===========================================================================
  // EXCEL TEMPLATE DOWNLOAD & IMPORT (SheetJS)
  // ===========================================================================
  function downloadMappingTemplateExcel() {
    if (typeof XLSX === 'undefined') {
      alert('ไม่พบไลบรารีสร้างไฟล์ Excel (XLSX) กรุณารีเฟรชหน้าเว็บ');
      return;
    }

    const skuMappings = getSkuMappings();
    const workerMappings = getWorkerMappings();

    // Sheet 1: SKU Mapping
    const skuRows = skuMappings.map((item, idx) => {
      const aliases = item.aliases || [];
      // Filter out the base model code itself so the alias columns show the handwritten examples clearly
      const customAliases = aliases.filter(a => a.toLowerCase() !== item.model.toLowerCase());
      return {
        'ลำดับ': idx + 1,
        'รหัสโมเดลในระบบ (SKU Model)': item.model,
        'ชื่อรุ่นสินค้าในระบบ': item.name,
        'หมวดหมู่': item.category || '',
        'ค่าแรงช่างหุ้ม (บาท/ชิ้น)': Number(item.upholsteryWage) || 0,
        'ค่าแรงช่างเย็บ (บาท/ชิ้น)': Number(item.sewingWage) || 0,
        'ชื่อในใบงาน_1 (ตัวอย่างหลัก)': customAliases[0] || '',
        'ชื่อในใบงาน_2': customAliases[1] || '',
        'ชื่อในใบงาน_3': customAliases[2] || '',
        'ชื่อในใบงาน_อื่นๆ (คั่นด้วยลูกน้ำ ,)': customAliases.slice(3).join(', '),
        'หมายเหตุ / ลักษณะการเขียน': item.note || ''
      };
    });

    // Sheet 2: Worker Mapping
    const workerRows = workerMappings.map((w, idx) => {
      const aliases = (w.aliases || []).filter(a => a.toLowerCase() !== w.code.toLowerCase() && a !== w.name);
      return {
        'ลำดับ': idx + 1,
        'รหัสช่างในระบบ (Worker Code)': w.code,
        'ชื่อช่างจริงในระบบ': w.name,
        'แผนก (หุ้ม / เย็บ)': w.dept,
        'ชื่อที่เขียนในใบงาน_1 (เช่น ภาษาอังกฤษ/ชื่อเล่น)': aliases[0] || '',
        'ชื่อที่เขียนในใบงาน_2': aliases[1] || '',
        'ชื่อที่เขียนในใบงาน_อื่นๆ (คั่นด้วยลูกน้ำ ,)': aliases.slice(2).join(', ')
      };
    });

    // Sheet 3: Instructions for Staff
    const guideRows = [
      { 'หัวข้อ': '1. วิธีกรอกชีต "1_จับคู่รหัสสินค้า_SKU"', 'คำอธิบายสำหรับเจ้าหน้าที่': 'ให้กรอกคำหรือรหัสที่ช่างเขียนในใบงานลงในคอลัมน์ "ชื่อในใบงาน_1", "ชื่อในใบงาน_2", "ชื่อในใบงาน_3" หรือคอลัมน์อื่นๆ (คั่นด้วยเครื่องหมายลูกน้ำ ,) ให้ตรงกับแถวรหัสโมเดลของโรงงาน' },
      { 'หัวข้อ': '2. วิธีพิมพ์สัญลักษณ์พิเศษ (ข้าวหลามตัด / สี่เหลี่ยม / กลม)', 'คำอธิบายสำหรับเจ้าหน้าที่': 'หากในใบงานเป็นรูปวาด ให้พิมพ์แทนได้ดังนี้:\n- เครื่องหมายข้าวหลามตัด (◊) พิมพ์เป็น <> หรือคำว่า ข้าวหลามตัด ได้เลย (เช่น 3<>11 หรือ 3 ข้าวหลามตัด 2 lit)\n- เครื่องหมายสี่เหลี่ยม (□) พิมพ์เป็น [] หรือคำว่า สี่เหลี่ยม ได้เลย (เช่น st [] หรือ st สี่เหลี่ยม)\n- เครื่องหมายวงกลม (○) พิมพ์เป็น () หรือคำว่า กลม ได้เลย (เช่น st () หรือ st กลม)' },
      { 'หัวข้อ': '3. กรณีมีรหัสโมเดลสินค้าใหม่เพิ่มเติม', 'คำอธิบายสำหรับเจ้าหน้าที่': 'สามารถพิมพ์เพิ่มแถวต่อท้ายในชีตที่ 1 ได้เลย โดยระบุ รหัสโมเดลในระบบ, ชื่อรุ่น, ค่าแรงช่างหุ้ม, ค่าแรงช่างเย็บ และคำที่ช่างเขียนในใบงาน' },
      { 'หัวข้อ': '4. วิธีกรอกชีต "2_จับคู่รายชื่อช่าง_Worker"', 'คำอธิบายสำหรับเจ้าหน้าที่': 'ให้กรอกชื่อที่ช่างชอบเซ็นหรือเขียนบนหัวใบงาน (เช่น Blai Morn, Blai Mon, ชื่อภาษาอังกฤษ หรือชื่อเล่นที่สะกดต่างกัน) ลงในคอลัมน์ "ชื่อที่เขียนในใบงาน" ให้ตรงกับชื่อช่างจริงในระบบ' },
      { 'หัวข้อ': '5. เมื่อกรอกเสร็จแล้วต้องทำอย่างไร', 'คำอธิบายสำหรับเจ้าหน้าที่': 'กดบันทึกไฟล์ Excel นี้ แล้วนำไปกดปุ่ม "📤 นำเข้าไฟล์ Excel จับคู่" บนหน้าเว็บ ระบบจะจำคำศัพท์ทั้งหมดและพร้อมสแกนใบงานคิดเงินทันที!' }
    ];

    const wb = XLSX.utils.book_new();

    const wsSku = XLSX.utils.json_to_sheet(skuRows);
    wsSku['!cols'] = [
      { wch: 7 },  // ลำดับ
      { wch: 24 }, // รหัสโมเดล
      { wch: 42 }, // ชื่อรุ่น
      { wch: 14 }, // หมวดหมู่
      { wch: 20 }, // ค่าแรงหุ้ม
      { wch: 20 }, // ค่าแรงเย็บ
      { wch: 26 }, // ชื่อในใบงาน 1
      { wch: 24 }, // ชื่อในใบงาน 2
      { wch: 24 }, // ชื่อในใบงาน 3
      { wch: 36 }, // ชื่อในใบงาน อื่นๆ
      { wch: 36 }  // หมายเหตุ
    ];

    const wsWorker = XLSX.utils.json_to_sheet(workerRows);
    wsWorker['!cols'] = [
      { wch: 7 },  // ลำดับ
      { wch: 26 }, // รหัสช่าง
      { wch: 22 }, // ชื่อช่างจริง
      { wch: 18 }, // แผนก
      { wch: 36 }, // ชื่อในใบงาน 1
      { wch: 26 }, // ชื่อในใบงาน 2
      { wch: 36 }  // ชื่อในใบงาน อื่นๆ
    ];

    const wsGuide = XLSX.utils.json_to_sheet(guideRows);
    wsGuide['!cols'] = [
      { wch: 42 },
      { wch: 95 }
    ];

    XLSX.utils.book_append_sheet(wb, wsSku, '1_จับคู่รหัสสินค้า_SKU');
    XLSX.utils.book_append_sheet(wb, wsWorker, '2_จับคู่รายชื่อช่าง_Worker');
    XLSX.utils.book_append_sheet(wb, wsGuide, '3_วิธีกรอกข้อมูล');

    const fileName = `QueenCosy_Mapping_Template_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  async function importMappingFromExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });

          let updatedSkuCount = 0;
          let updatedWorkerCount = 0;

          // 1. Parse Sheet 1 (SKU Mapping)
          const skuSheetName = wb.SheetNames.find(n => n.includes('SKU') || n.includes('สินค้า') || n.startsWith('1')) || wb.SheetNames[0];
          if (skuSheetName) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[skuSheetName], { defval: '' });
            const newSkuList = [];

            rows.forEach(row => {
              const modelRaw = row['รหัสโมเดลในระบบ (SKU Model)'] || row['รหัสโมเดล'] || row['model'] || row['SKU'] || '';
              const model = String(modelRaw).trim().toLowerCase();
              if (!model) return;

              const name = String(row['ชื่อรุ่นสินค้าในระบบ'] || row['ชื่อรุ่น'] || row['name'] || model).trim();
              const category = String(row['หมวดหมู่'] || row['category'] || 'ทั่วไป').trim();
              const uphWage = parseFloat(row['ค่าแรงช่างหุ้ม (บาท/ชิ้น)'] !== undefined ? row['ค่าแรงช่างหุ้ม (บาท/ชิ้น)'] : row['upholsteryWage']) || 0;
              const sewWage = parseFloat(row['ค่าแรงช่างเย็บ (บาท/ชิ้น)'] !== undefined ? row['ค่าแรงช่างเย็บ (บาท/ชิ้น)'] : row['sewingWage']) || 0;
              const note = String(row['หมายเหตุ / ลักษณะการเขียน'] || row['หมายเหตุ'] || '').trim();

              const aliasSet = new Set([model]);
              const c1 = String(row['ชื่อในใบงาน_1 (ตัวอย่างหลัก)'] || row['ชื่อในใบงาน_1'] || '').trim();
              const c2 = String(row['ชื่อในใบงาน_2'] || '').trim();
              const c3 = String(row['ชื่อในใบงาน_3'] || '').trim();
              const cMore = String(row['ชื่อในใบงาน_อื่นๆ (คั่นด้วยลูกน้ำ ,)'] || row['ชื่อในใบงาน_อื่นๆ'] || '').trim();

              [c1, c2, c3].forEach(c => {
                if (c) aliasSet.add(c);
              });
              if (cMore) {
                cMore.split(',').map(s => s.trim()).filter(Boolean).forEach(a => aliasSet.add(a));
              }

              newSkuList.push({
                model,
                name,
                category,
                upholsteryWage: uphWage,
                sewingWage: sewWage,
                aliases: Array.from(aliasSet),
                note
              });
              updatedSkuCount++;
            });

            if (newSkuList.length > 0) {
              saveSkuMappings(newSkuList);
            }
          }

          // 2. Parse Sheet 2 (Worker Mapping)
          const workerSheetName = wb.SheetNames.find(n => n.includes('Worker') || n.includes('ช่าง') || n.startsWith('2'));
          if (workerSheetName) {
            const wRows = XLSX.utils.sheet_to_json(wb.Sheets[workerSheetName], { defval: '' });
            const newWorkerList = [];

            wRows.forEach(row => {
              const codeRaw = row['รหัสช่างในระบบ (Worker Code)'] || row['รหัสช่าง'] || row['code'] || '';
              const nameRaw = row['ชื่อช่างจริงในระบบ'] || row['ชื่อช่าง'] || row['name'] || '';
              const code = String(codeRaw).trim();
              const name = String(nameRaw).trim();
              if (!code && !name) return;

              const deptRaw = String(row['แผนก (หุ้ม / เย็บ)'] || row['แผนก'] || row['dept'] || 'หุ้ม').trim();
              const dept = deptRaw.includes('เย็บ') ? 'เย็บ' : 'หุ้ม';

              const aliasSet = new Set();
              if (name) aliasSet.add(name);
              if (code) aliasSet.add(code);

              const w1 = String(row['ชื่อที่เขียนในใบงาน_1 (เช่น ภาษาอังกฤษ/ชื่อเล่น)'] || row['ชื่อที่เขียนในใบงาน_1'] || '').trim();
              const w2 = String(row['ชื่อที่เขียนในใบงาน_2'] || '').trim();
              const wMore = String(row['ชื่อที่เขียนในใบงาน_อื่นๆ (คั่นด้วยลูกน้ำ ,)'] || row['ชื่อที่เขียนในใบงาน_อื่นๆ'] || '').trim();

              [w1, w2].forEach(w => {
                if (w) aliasSet.add(w);
              });
              if (wMore) {
                wMore.split(',').map(s => s.trim()).filter(Boolean).forEach(a => aliasSet.add(a));
              }

              newWorkerList.push({
                code: code || `w_${ newWorkerList.length + 1 }`,
                name: name || code,
                dept,
                aliases: Array.from(aliasSet)
              });
              updatedWorkerCount++;
            });

            if (newWorkerList.length > 0) {
              saveWorkerMappings(newWorkerList);
            }
          }

          resolve({
            success: true,
            skuCount: updatedSkuCount,
            workerCount: updatedWorkerCount
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ Excel ได้'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Sync latest piece rates & workers from QueenCosy Google Sheets / Supabase while preserving custom aliases
  async function syncMasterDataFromCloud() {
    let syncedWageCount = 0;
    let syncedWorkerCount = 0;

    // 1. Sync Piece Rates from Google Sheet or Supabase
    try {
      const res = await fetch(DEFAULT_WAGE_SHEET_URL);
      if (res.ok) {
        const csvText = await res.text();
        const lines = csvText.split(/\r?\n/);
        const currentSkus = getSkuMappings();
        const skuMap = new Map(currentSkus.map(s => [s.model.toLowerCase(), s]));

        lines.forEach((line, idx) => {
          if (!line || idx === 0) return;
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 3) {
            const skuExample = parts[0];
            const sewVal = parseFloat(parts[1]) || 0;
            const uphVal = parseFloat(parts[2]) || 0;
            if (skuExample) {
              const skuParts = skuExample.split('-');
              const modelCode = (skuParts.length >= 3 ? skuParts[2] : skuExample).trim().toLowerCase();
              const existing = skuMap.get(modelCode);
              if (existing) {
                existing.upholsteryWage = uphVal;
                existing.sewingWage = sewVal;
                syncedWageCount++;
              } else {
                skuMap.set(modelCode, {
                  model: modelCode,
                  name: skuParts[1] ? `${skuParts[1]} (${modelCode})` : skuExample,
                  category: 'Google Sheet',
                  upholsteryWage: uphVal,
                  sewingWage: sewVal,
                  aliases: [modelCode],
                  note: ''
                });
                syncedWageCount++;
              }
            }
          }
        });
        saveSkuMappings(Array.from(skuMap.values()));
      }
    } catch (e) {
      console.warn('Wage sheet sync warning:', e);
    }

    // 2. Sync Workers from Google Sheet
    try {
      const resW = await fetch(DEFAULT_WORKER_SHEET_URL);
      if (resW.ok) {
        const csvText = await resW.text();
        const lines = csvText.split(/\r?\n/);
        const currentWorkers = getWorkerMappings();
        const workerMap = new Map(currentWorkers.map(w => [w.code.toLowerCase(), w]));

        lines.forEach((line, idx) => {
          if (!line || idx === 0) return;
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 3) {
            const code = parts[0];
            const name = parts[1];
            const dept = parts[2] || (code.startsWith('sew') ? 'เย็บ' : 'หุ้ม');
            if (code && name) {
              const key = code.toLowerCase();
              const existing = workerMap.get(key);
              if (existing) {
                existing.name = name;
                existing.dept = dept;
                if (!existing.aliases.includes(name)) existing.aliases.push(name);
                syncedWorkerCount++;
              } else {
                workerMap.set(key, {
                  code,
                  name,
                  dept,
                  aliases: [name, code]
                });
                syncedWorkerCount++;
              }
            }
          }
        });
        saveWorkerMappings(Array.from(workerMap.values()));
      }
    } catch (e) {
      console.warn('Worker sheet sync warning:', e);
    }

    return { syncedWageCount, syncedWorkerCount };
  }

  // ===========================================================================
  // PAYROLL PERIOD CALCULATION (1-15 จ่าย 20 | 16-สิ้นเดือน จ่าย 5 เดือนถัดไป)
  // ===========================================================================
  function calculatePayrollPeriod(dateStr) {
    // dateStr format: YYYY-MM-DD
    const fallbackDate = new Date().toISOString().slice(0, 10);
    const cleanDate = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? dateStr : fallbackDate;
    const [yyyy, mm, dd] = cleanDate.split('-').map(Number);

    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thaiYearShort = String((yyyy + 543) % 100);
    const mName = thaiMonths[(mm - 1) % 12];

    if (dd <= 15) {
      const periodKey = `${yyyy}-${String(mm).padStart(2, '0')}-P1`;
      return {
        periodKey,
        periodLabel: `งวด 1–15 ${mName} ${thaiYearShort} (จ่าย 20 ${mName})`,
        payDateLabel: `20 ${mName} ${thaiYearShort}`,
        half: 1,
        year: yyyy,
        month: mm
      };
    } else {
      const nextMonth = mm === 12 ? 1 : mm + 1;
      const nextYear = mm === 12 ? yyyy + 1 : yyyy;
      const nextMName = thaiMonths[(nextMonth - 1) % 12];
      const nextThaiYearShort = String((nextYear + 543) % 100);
      const lastDay = new Date(yyyy, mm, 0).getDate();
      const periodKey = `${yyyy}-${String(mm).padStart(2, '0')}-P2`;
      return {
        periodKey,
        periodLabel: `งวด 16–${lastDay} ${mName} ${thaiYearShort} (จ่าย 5 ${nextMName})`,
        payDateLabel: `5 ${nextMName} ${nextThaiYearShort}`,
        half: 2,
        year: yyyy,
        month: mm
      };
    }
  }

  function getNextPayrollPeriodKey(periodKey) {
    if (!periodKey) return '';
    const match = periodKey.match(/^(\d{4})-(\d{2})-(P1|P2)$/);
    if (!match) return periodKey;
    const yyyy = Number(match[1]);
    const mm = Number(match[2]);
    const half = match[3];
    if (half === 'P1') {
      return `${yyyy}-${String(mm).padStart(2, '0')}-P2`;
    } else {
      const nextM = mm === 12 ? 1 : mm + 1;
      const nextY = mm === 12 ? yyyy + 1 : yyyy;
      return `${nextY}-${String(nextM).padStart(2, '0')}-P1`;
    }
  }

  function getPeriodMetaFromKey(periodKey) {
    const match = String(periodKey || '').match(/^(\d{4})-(\d{2})-(P1|P2)$/);
    if (!match) return calculatePayrollPeriod(new Date().toISOString().slice(0, 10));
    const day = match[3] === 'P1' ? '10' : '20';
    return calculatePayrollPeriod(`${match[1]}-${match[2]}-${day}`);
  }

  // ===========================================================================
  // GEMINI API KEY VERIFICATION & AI VISION OCR ENGINE
  // ===========================================================================
  async function fetchAvailableGeminiModels(key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-goog-api-key': key }
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) ? data.error.message : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const allModels = (data && Array.isArray(data.models)) ? data.models : [];
    return allModels
      .filter(m =>
        m.name &&
        m.name.includes('gemini') &&
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent') &&
        !m.name.includes('embedding') &&
        !m.name.includes('imagen') &&
        !m.name.includes('veo') &&
        !m.name.includes('tts') &&
        !m.name.includes('audio')
      )
      .map(m => m.name.replace(/^models\//, ''));
  }

  function pickBestGeminiModel(availableModels, preferredModel) {
    if (!Array.isArray(availableModels) || availableModels.length === 0) {
      return preferredModel || 'gemini-2.5-flash';
    }
    if (preferredModel && availableModels.includes(preferredModel)) {
      return preferredModel;
    }
    const priorityOrder = [
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-3-flash-preview',
      'gemini-2.5-flash-preview-09-2025',
      'gemini-2.5-pro',
      'gemini-pro-latest',
      'gemini-2.5-flash-lite'
    ];
    for (const p of priorityOrder) {
      if (availableModels.includes(p)) return p;
    }
    const anyFlash = availableModels.find(m => m.includes('flash'));
    return anyFlash || availableModels[0];
  }

  async function verifyGeminiApiKey(apiKeyInput, preferredModel = 'gemini-2.5-flash') {
    const key = String(apiKeyInput || getConfig().geminiApiKey || '').trim();
    if (!key) {
      return { ok: false, message: 'กรุณากรอก Gemini API Key ก่อนกดตรวจสอบ' };
    }

    try {
      // 1. Call ModelService.ListModels to validate the key and discover exact supported models
      const availableModels = await fetchAvailableGeminiModels(key);
      const chosenModel = pickBestGeminiModel(availableModels, preferredModel);

      // 2. Test generateContent WITHOUT restrictive maxOutputTokens (which breaks Gemini 2.5/3 thinking models)
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${encodeURIComponent(key)}`;
      const testRes = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'OK' }] }]
        })
      });

      const testData = await testRes.json();
      if (testRes.ok && testData && testData.candidates) {
        saveConfig({ geminiApiKey: key, geminiModel: chosenModel, availableModels });
        return {
          ok: true,
          model: chosenModel,
          availableModels,
          message: `เชื่อมต่อสำเร็จ! พร้อมอ่านใบงานด้วยโมเดล ${chosenModel}`
        };
      }

      // If ListModels succeeded, the API key is valid even if one specific model had a quota/preview issue
      if (availableModels.length > 0) {
        saveConfig({ geminiApiKey: key, geminiModel: chosenModel, availableModels });
        return {
          ok: true,
          model: chosenModel,
          availableModels,
          message: `ยืนยัน API Key สำเร็จ! (พบโมเดลที่รองรับ ${availableModels.length} รุ่น เลือกใช้: ${chosenModel})`
        };
      }

      const errMsg = (testData && testData.error && testData.error.message) ? testData.error.message : `HTTP ${testRes.status}`;
      return { ok: false, message: `ไม่สามารถเชื่อมต่อได้: ${errMsg}` };
    } catch (err) {
      return {
        ok: false,
        message: `ไม่สามารถเชื่อมต่อได้: ${err.message || 'Network Error'}`
      };
    }
  }

  async function analyzeJobSheetWithGemini(imageDataUrl) {
    const cfg = getConfig();
    const apiKey = (cfg.geminiApiKey || '').trim();
    if (!apiKey) {
      throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key (กรุณาไปที่แท็บ "1. ตารางจับคู่ & ตั้งค่า Gemini API" เพื่อใส่ API Key)');
    }

    const base64Match = String(imageDataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('รูปแบบไฟล์รูปภาพไม่ถูกต้อง');
    }
    const mimeType = base64Match[1];
    const base64Data = base64Match[2];

    const skuMappings = getSkuMappings();
    const workerMappings = getWorkerMappings();

    const skuContext = skuMappings.map(s => `- SKU "${s.model}" (${s.name}): คำในใบงานที่พบบ่อย = [${(s.aliases || []).join(', ')}]`).join('\n');
    const workerContext = workerMappings.map(w => `- รหัส "${w.code}" ชื่อจริง "${w.name}" (แผนก${w.dept}): ลายมือที่พบบ่อย = [${(w.aliases || []).join(', ')}]`).join('\n');

    const promptText = `คุณคือระบบ AI อ่านใบงานผลิตโรงงานโซฟา QueenCosy ("รายงานผลิตช่างเย็บ - ช่างหุ้ม")
กรุณาอ่านข้อมูลจากรูปภาพใบงานนี้และแปลงเป็น JSON ตามโครงสร้างที่กำหนดอย่างแม่นยำ:

กฎสำคัญในการอ่านสัญลักษณ์และลายมือ:
1. ในคอลัมน์ "รายการ(รุ่น)":
   - หากมีรูปทรงข้าวหลามตัด (◊ หรือ ◇ หรือเลข 0 เหลี่ยม) ให้แทนด้วยสัญลักษณ์ "<>" เช่น "3 ◊ 11" -> "3 <> 11" หรือ "3 ◊ 2 lit" -> "3 <> 2 lit"
   - หากมีรูปสี่เหลี่ยม (□) ให้แทนด้วย "[]" เช่น "st □" -> "st []"
   - หากมีตัวอักษรเขียนกำกับในวงเล็บ เช่น "(LN3)" หรือ "<BS3>" ให้ดึงมาใส่ใน rawModel ด้วย เช่น "3 <> 11 (LN3)" หรือ "311 Lit (BS3)"
   - จับคู่กับรหัส SKU จริงของโรงงานจากตารางอ้างอิงด้านล่างนี้:
${skuContext}

2. ชื่อช่าง (มุมบนซ้าย "ชื่อ..." หรือมุมล่างขวา "ลงชื่อผู้ผลิต..."):
   - อ่านชื่อตามลายมือที่เขียน เช่น "Blai Morn"
   - จับคู่กับรายชื่อช่างในระบบจากตารางอ้างอิงด้านล่างนี้:
${workerContext}

3. วันที่ (มุมบนขวา "วันที่..."):
   - ในใบงานมักเขียนเป็น วัน.เดือน.ปีพ.ศ.2หลัก เช่น "15.6.69" (ปี 69 คือ พ.ศ. 2569 = ค.ศ. 2026)
   - แปลงเป็นรูปแบบ YYYY-MM-DD (เช่น "2026-06-15")

4. หมายเหตุพิเศษกลางหน้ากระดาษ:
   - หากมีข้อความเขียนหมายเหตุในตาราง เช่น "เอาไปรวมยอด 16-30 มิ.ย. 69 เนื่องจากส่งใบงานล่าช้า" ให้ดึงมาใส่ในฟิลด์ specialNote และตั้งค่า isLateCarryOver = true

5. คอลัมน์ "พนง.แจกงาน":
   - หากมีการเขียนปีกกา "}" รวบหลายบรรทัดเข้าด้วยกัน (เช่น TikTok } 15/6) ให้กระจายค่าเดียวกันนั้นใส่ในทุกแถวที่อยู่ในปีกกา

ตอบกลับมาเป็น JSON เท่านั้น ตามโครงสร้างนี้:
{
  "rawWorkerName": "ข้อความชื่อช่างที่อ่านได้จากใบงาน",
  "matchedWorkerCode": "รหัสช่างที่ตรงที่สุด เช่น cv3 หรือเว้นว่างถ้าไม่แน่ใจ",
  "rawDate": "ข้อความวันที่ที่อ่านได้ เช่น 15.6.69",
  "isoDate": "YYYY-MM-DD เช่น 2026-06-15",
  "specialNote": "ข้อความหมายเหตุพิเศษถ้ามี เช่น เอาไปรวมยอด 16-30 มิ.ย. 69 เนื่องจากส่งใบงานล่าช้า",
  "isLateCarryOver": false,
  "items": [
    {
      "rowNo": 1,
      "rawModel": "ข้อความช่องรายการ(รุ่น) เช่น 3 <> 11 (LN3)",
      "matchedSku": "รหัส SKU ที่ตรง เช่น ln3",
      "color": "ข้อความช่องสี เช่น 337-22 หรือ CV หรือ Br หรือ Mc",
      "qty": 1,
      "channel": "ข้อความช่องพนง.แจกงาน เช่น Shopee 15/6 หรือ TikTok 15/6",
      "foamBy": "ข้อความช่องพนง.เบิกฟองน้ำถ้ามี",
      "stockReceiver": "ข้อความช่องพนง.รับเข้าสต๊อก/เวลาเซ็นต์ เช่น su 15.3 หรือ yok 20.11"
    }
  ]
}`;

    // Discover available models dynamically if needed
    let candidateModels = [cfg.geminiModel || 'gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro'];
    try {
      const discovered = await fetchAvailableGeminiModels(apiKey);
      if (discovered.length > 0) {
        const best = pickBestGeminiModel(discovered, cfg.geminiModel);
        candidateModels = [best, ...discovered];
      }
    } catch (e) {}
    const modelsToTry = candidateModels.filter((v, i, a) => v && a.indexOf(v) === i);

    let lastErr = null;

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error((resData && resData.error && resData.error.message) || `HTTP ${response.status}`);
        }

        const parts = resData?.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find(p => p.text && p.text.includes('{')) || parts[parts.length - 1] || {};
        const rawText = textPart.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanedJson);
        return normalizeParsedSheet(parsed, imageDataUrl);
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error('ไม่สามารถประมวลผลรูปภาพใบงานได้');
  }

  // Normalize AI output and enrich with our local SKU & Worker mapping dictionary
  function normalizeParsedSheet(aiData, imageDataUrl) {
    const rawWorker = aiData.rawWorkerName || '';
    let workerMatch = matchWorkerFromText(rawWorker);
    if (!workerMatch.matched && aiData.matchedWorkerCode) {
      workerMatch = matchWorkerFromText(aiData.matchedWorkerCode);
    }

    const isoDate = (aiData.isoDate && /^\d{4}-\d{2}-\d{2}$/.test(aiData.isoDate))
      ? aiData.isoDate
      : new Date().toISOString().slice(0, 10);

    const basePeriod = calculatePayrollPeriod(isoDate);
    const isLate = Boolean(aiData.isLateCarryOver) || /รวมยอด|ล่าช้า/.test(aiData.specialNote || '');
    const assignedPeriodKey = isLate ? getNextPayrollPeriodKey(basePeriod.periodKey) : basePeriod.periodKey;

    const dept = workerMatch.dept || 'หุ้ม';

    const items = (aiData.items || []).map((row, idx) => {
      const rawModel = String(row.rawModel || '').trim();
      let skuMatch = matchSkuFromText(rawModel);
      if (!skuMatch.matched && row.matchedSku) {
        skuMatch = matchSkuFromText(row.matchedSku);
      }

      const qty = Math.max(1, parseInt(row.qty, 10) || 1);
      const unitRate = dept === 'เย็บ' ? skuMatch.sewingWage : skuMatch.upholsteryWage;

      return {
        rowNo: row.rowNo || idx + 1,
        rawModel,
        matchedSku: skuMatch.model || '',
        skuName: skuMatch.name || '',
        isMatched: skuMatch.matched,
        color: String(row.color || '').trim(),
        qty,
        channel: String(row.channel || '').trim(),
        foamBy: String(row.foamBy || '').trim(),
        stockReceiver: String(row.stockReceiver || '').trim(),
        unitRate,
        lineTotal: qty * unitRate
      };
    });

    return {
      id: 'SH-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      createdAt: new Date().toISOString(),
      imageDataUrl: imageDataUrl || '',
      rawWorkerName: rawWorker,
      workerCode: workerMatch.code || '',
      workerName: workerMatch.name || rawWorker || 'ไม่ระบุช่าง',
      workerDept: dept,
      isWorkerMatched: workerMatch.matched,
      rawDate: aiData.rawDate || isoDate,
      sheetDate: isoDate,
      specialNote: aiData.specialNote || '',
      isLateCarryOver: isLate,
      payrollPeriodKey: assignedPeriodKey,
      status: 'VERIFIED', // 'PENDING_REVIEW' or 'VERIFIED'
      items
    };
  }

  // Pre-built sample sheet from the user's actual photo (Blai Morn 15.6.69)
  function createSampleBlaiMornSheet() {
    const parsed = {
      rawWorkerName: 'Blai Morn',
      matchedWorkerCode: 'cv3',
      rawDate: '15.6.69',
      isoDate: '2026-06-15',
      specialNote: 'เอาไปรวมยอด 16-30 มิ.ย. 69 เนื่องจากส่งใบงานล่าช้า',
      isLateCarryOver: true,
      items: [
        { rowNo: 1, rawModel: '3 ◊ 11 (LN3)', matchedSku: 'ln3', color: '337-22', qty: 1, channel: 'Shopee 15/6', foamBy: '', stockReceiver: 'su 15.3' },
        { rowNo: 2, rawModel: '3 ◊ 11 (LN3)', matchedSku: 'ln3', color: 'CV',     qty: 1, channel: 'Shopee 15/6', foamBy: '6.16', stockReceiver: 'su 11.25' },
        { rowNo: 3, rawModel: '3 ◊ 11 (LN3)', matchedSku: 'ln3', color: '337-29', qty: 1, channel: 'TikTok 15/6', foamBy: '', stockReceiver: 'su 16.40' },
        { rowNo: 4, rawModel: '311 Lit (BS3)', matchedSku: 'bs3', color: 'Br',    qty: 1, channel: 'TikTok 15/6', foamBy: '', stockReceiver: 'yok 20.11' },
        { rowNo: 5, rawModel: '311 Lit (BS3)', matchedSku: 'bs3', color: 'Mc',    qty: 1, channel: 'TikTok 15/6', foamBy: '', stockReceiver: 'su 18.15' },
        { rowNo: 6, rawModel: '311 Lit (BS3)', matchedSku: 'bs3', color: 'Mc',    qty: 1, channel: 'TikTok 15/6', foamBy: '', stockReceiver: 'yok 18.49' }
      ]
    };
    return normalizeParsedSheet(parsed, 'sample_jobsheet.jpg');
  }

  // ===========================================================================
  // SAVED JOB SHEETS STORAGE & PAYROLL AGGREGATION
  // ===========================================================================
  function getSavedSheets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SHEETS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveSheets(sheets) {
    if (!Array.isArray(sheets)) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(sheets));
    } catch (quotaErr) {
      // If localStorage hits 5MB due to many high-res photos, strip older base64 images while keeping all data
      const slimmed = sheets.map((s, idx) => {
        if (idx > 15 && s.imageDataUrl && s.imageDataUrl.startsWith('data:image')) {
          return { ...s, imageDataUrl: '' };
        }
        return s;
      });
      localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(slimmed));
    }
  }

  function upsertSheet(sheetObj) {
    if (!sheetObj || !sheetObj.id) return;
    // Recalculate totals before saving
    const skuList = getSkuMappings();
    const dept = sheetObj.workerDept || 'หุ้ม';
    let sheetTotalUnits = 0;
    let sheetTotalWage = 0;

    (sheetObj.items || []).forEach(item => {
      const skuInfo = skuList.find(s => s.model.toLowerCase() === String(item.matchedSku || '').toLowerCase());
      if (skuInfo) {
        item.skuName = skuInfo.name;
        item.unitRate = dept === 'เย็บ' ? Number(skuInfo.sewingWage) : Number(skuInfo.upholsteryWage);
        item.isMatched = true;
      } else {
        item.isMatched = Boolean(item.matchedSku);
        item.unitRate = Number(item.unitRate) || 0;
      }
      item.qty = Math.max(1, parseInt(item.qty, 10) || 1);
      item.lineTotal = item.qty * item.unitRate;
      sheetTotalUnits += item.qty;
      sheetTotalWage += item.lineTotal;
    });

    sheetObj.totalUnits = sheetTotalUnits;
    sheetObj.totalWage = sheetTotalWage;

    const all = getSavedSheets();
    const idx = all.findIndex(s => s.id === sheetObj.id);
    if (idx >= 0) {
      all[idx] = sheetObj;
    } else {
      all.unshift(sheetObj);
    }
    saveSheets(all);
    return sheetObj;
  }

  function deleteSheet(sheetId) {
    const all = getSavedSheets().filter(s => s.id !== sheetId);
    saveSheets(all);
  }

  // Generate 3 months (6 periods) of realistic demo data for testing Executive Charts
  function seedDemoMultiMonthData() {
    const existing = getSavedSheets().filter(s => !s.isDemo);
    const demoWorkers = [
      { code: 'cv1', name: 'นาย', dept: 'หุ้ม', raw: 'นาย' },
      { code: 'cv2', name: 'เอ', dept: 'หุ้ม', raw: 'Ae' },
      { code: 'cv3', name: 'บายมอญ', dept: 'หุ้ม', raw: 'Blai Morn' },
      { code: 'cv4', name: 'พู', dept: 'หุ้ม', raw: 'Phu' },
      { code: 'cv5', name: 'หลวย', dept: 'หุ้ม', raw: 'หลวย' },
      { code: 'sew1', name: 'อ่อน', dept: 'เย็บ', raw: 'อ่อน' },
      { code: 'sew2', name: 'เนยู', dept: 'เย็บ', raw: 'Neyu' },
      { code: 'sew3', name: 'บี', dept: 'เย็บ', raw: 'Bee' }
    ];
    const demoSkus = [
      { raw: '3 <> 11 (LN3)', sku: 'ln3', uph: 140, sew: 30 },
      { raw: '311 Lit (BS3)', sku: 'bs3', uph: 120, sew: 35 },
      { raw: 'แอลมินิมอล (MN)', sku: 'mn', uph: 170, sew: 50 },
      { raw: 'เบดปรับนอน (RC)', sku: 'rc', uph: 130, sew: 20 },
      { raw: '3 <> 2 lit (BS2)', sku: 'bs2', uph: 90, sew: 20 },
      { raw: 'st [] (CU)', sku: 'cu', uph: 20, sew: 4 }
    ];

    const datesToSeed = [
      // ส.ค. 69 (2026-08)
      { date: '2026-08-05', period: '2026-08-P1', mult: 1.0 },
      { date: '2026-08-12', period: '2026-08-P1', mult: 1.2 },
      { date: '2026-08-15', period: '2026-08-P1', mult: 1.4, late: false },
      { date: '2026-08-20', period: '2026-08-P2', mult: 1.1 },
      { date: '2026-08-28', period: '2026-08-P2', mult: 1.3 },
      // ก.ย. 69 (2026-09)
      { date: '2026-09-04', period: '2026-09-P1', mult: 1.1 },
      { date: '2026-09-11', period: '2026-09-P1', mult: 1.3 },
      { date: '2026-09-15', period: '2026-09-P2', mult: 1.2, late: true, note: 'เอาไปรวมยอด 16-30 ก.ย. 69 เนื่องจากส่งใบงานล่าช้า' },
      { date: '2026-09-22', period: '2026-09-P2', mult: 1.4 },
      { date: '2026-09-29', period: '2026-09-P2', mult: 1.5 },
      // ต.ค. 69 (2026-10)
      { date: '2026-10-05', period: '2026-10-P1', mult: 1.3 },
      { date: '2026-10-12', period: '2026-10-P1', mult: 1.5 },
      { date: '2026-10-15', period: '2026-10-P1', mult: 1.6 },
      { date: '2026-10-18', period: '2026-10-P2', mult: 1.4 },
      { date: '2026-10-21', period: '2026-10-P2', mult: 1.5 }
    ];

    const generated = [];
    let seq = 1;

    datesToSeed.forEach((dObj, dIdx) => {
      demoWorkers.forEach((w, wIdx) => {
        // Pick 3-5 items per sheet
        const items = [];
        let totalUnits = 0;
        let totalWage = 0;
        const itemCount = 3 + ((dIdx + wIdx) % 3);

        for (let i = 0; i < itemCount; i++) {
          const s = demoSkus[(dIdx + wIdx + i) % demoSkus.length];
          const qty = Math.max(1, Math.round((1 + ((i + wIdx) % 2)) * dObj.mult));
          const rate = w.dept === 'เย็บ' ? s.sew : s.uph;
          const lineTotal = qty * rate;
          totalUnits += qty;
          totalWage += lineTotal;
          items.push({
            rowNo: i + 1,
            rawModel: s.raw,
            matchedSku: s.sku,
            skuName: s.raw,
            isMatched: true,
            color: ['337-22', '337-29', 'Br', 'Mc', 'CV'][(i + dIdx) % 5],
            qty,
            channel: i % 2 === 0 ? 'Shopee' : 'TikTok',
            foamBy: '',
            stockReceiver: 'su 16.30',
            unitRate: rate,
            lineTotal
          });
        }

        generated.push({
          id: `SH-DEMO-${String(seq++).padStart(3, '0')}`,
          isDemo: true,
          createdAt: new Date().toISOString(),
          imageDataUrl: 'sample_jobsheet.jpg',
          rawWorkerName: w.raw,
          workerCode: w.code,
          workerName: w.name,
          workerDept: w.dept,
          isWorkerMatched: true,
          rawDate: dObj.date,
          sheetDate: dObj.date,
          specialNote: dObj.late && wIdx === 2 ? dObj.note : '',
          isLateCarryOver: Boolean(dObj.late && wIdx === 2),
          payrollPeriodKey: dObj.period,
          status: 'VERIFIED',
          totalUnits,
          totalWage,
          items
        });
      });
    });

    const combined = [...existing, ...generated];
    saveSheets(combined);
    return generated.length;
  }

  function clearDemoSheets() {
    const realOnly = getSavedSheets().filter(s => !s.isDemo);
    saveSheets(realOnly);
    return realOnly.length;
  }

  function exportHistoryBackupJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      skuMappings: getSkuMappings(),
      workerMappings: getWorkerMappings(),
      sheets: getSavedSheets().map(s => ({ ...s, imageDataUrl: s.imageDataUrl && s.imageDataUrl.length > 500 ? '' : s.imageDataUrl }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QueenCosy_Payroll_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importHistoryBackupJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (Array.isArray(data.skuMappings) && data.skuMappings.length > 0) {
            saveSkuMappings(data.skuMappings);
          }
          if (Array.isArray(data.workerMappings) && data.workerMappings.length > 0) {
            saveWorkerMappings(data.workerMappings);
          }
          if (Array.isArray(data.sheets)) {
            saveSheets(data.sheets);
          }
          resolve({ sheetsCount: (data.sheets || []).length });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์สำรองข้อมูลได้'));
      reader.readAsText(file);
    });
  }

  initSupabase();

  return {
    getConfig,
    saveConfig,
    getSkuMappings,
    saveSkuMappings,
    getWorkerMappings,
    saveWorkerMappings,
    resetMappingsToDefault,
    learnSkuAlias,
    learnWorkerAlias,
    normalizeSymbolText,
    matchSkuFromText,
    matchWorkerFromText,
    downloadMappingTemplateExcel,
    importMappingFromExcel,
    syncMasterDataFromCloud,
    calculatePayrollPeriod,
    getNextPayrollPeriodKey,
    getPeriodMetaFromKey,
    verifyGeminiApiKey,
    analyzeJobSheetWithGemini,
    createSampleBlaiMornSheet,
    getSavedSheets,
    saveSheets,
    upsertSheet,
    deleteSheet,
    seedDemoMultiMonthData,
    clearDemoSheets,
    exportHistoryBackupJson,
    importHistoryBackupJson
  };
})();

if (typeof window !== 'undefined') {
  window.PayrollDB = PayrollDB;
}
