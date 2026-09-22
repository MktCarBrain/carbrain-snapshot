// ───────────────────────────────────────────────────────────
// CarBrain Weekly Marketing Snapshot — live data layer
// Uses the gviz/tq JSON endpoint (public, CORS-friendly, no API key).
// Sheet must be: Share → "Anyone with the link can view".
// Source: a values-only mirror of Data Input _ 2026_CRM_connected.xlsx,
// kept in sync by sync_master_to_sheets.py.
// ───────────────────────────────────────────────────────────
console.log('%c[cb-snapshot] FILE VERSION: v6-actuals-text-month-fallback', 'background:#00BBEA;color:#002147;font-weight:bold;padding:2px 6px;');

const SHEET_ID = '1005P8SB3pRzdyO8KVENaBWR7sqnXBudCk_ITAvJ5jB4';
const CACHE_KEY = 'cb_snapshot_cache_v2';
const CACHE_TS_KEY = 'cb_snapshot_cache_ts_v2';

const TABS = {
  LEAD: 'By Type Lead (Detailed)',
  OA: 'By Type OA (Detailed)',
  APC: 'By Type APC (Detailed)',
  ACTUALS: '2026 Actuals',
};

// Columns A..AE cover: segment counts (A-N), NW breakdown (O-AD), WEEK (AE)
const DETAIL_RANGE = 'A1:BZ500';
const ACTUALS_RANGE = 'A1:Z70';

const gvizUrl = (sheetName, range) => {
  const params = new URLSearchParams({ sheet: sheetName, range, headers: '0', tqx: 'out:json' });
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`;
};

const parseGviz = (text) => {
  const match = text.match(/setResponse\(([\s\S]+)\)/);
  if (!match) throw new Error('Unexpected gviz response shape');
  return JSON.parse(match[1]);
};

const cellsFromGviz = (resp) => {
  if (!resp.table || !resp.table.rows) return [];
  return resp.table.rows.map(r =>
    (r.c || []).map(cell => (cell == null ? null : (cell.v != null ? cell.v : cell.f != null ? cell.f : null)))
  );
};

async function fetchRange(sheetName, range) {
  const res = await fetch(gvizUrl(sheetName, range));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${sheetName}`);
  const text = await res.text();
  const parsed = parseGviz(text);
  if (parsed.status === 'error') {
    throw new Error((parsed.errors || []).map(e => e.detailed_message || e.message).join('; '));
  }
  return cellsFromGviz(parsed);
}

const num = (v) => {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/[,%$\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};
const str = (v) => (v == null ? '' : String(v).trim());

// gviz returns Date-typed cells as "Date(YYYY,M,D)" (M is 0-indexed).
function parseGvizDate(v) {
  const s = str(v);
  const m = s.match(/Date\((\d+),(\d+),(\d+)\)/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), monthNum: parseInt(m[2], 10) + 1, date: parseInt(m[3], 10) };
}

const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 };
const MONTH_ORDER = Object.keys(MONTH_NUM);

// The source workbook has hidden/spacer columns whose exact count isn't reliable to
// hardcode (and the header row itself only carries text in the first few columns —
// the "SP", "Priority" etc. labels are not present as literal cell text in this mirror).
// So instead of matching by header name, we detect the DATE column dynamically per
// sheet (the only column whose values reliably parse as a gviz Date), then read every
// other field at a FIXED OFFSET relative to that date column. These offsets were
// empirically verified against known totals (e.g. SP + SP Pri. = SP total,
// SP(NW)+SP Pri.(NW)+Parts(NW)+Priority(NW)+Premium(NW)+No off.(NW) = Total NW).
const OFFSET = {
  SP: 1, SP_PRI: 2, PARTS: 3, PRIORITY: 4, PREMIUM: 5, NO_OFFERS: 6, TOTAL: 10,
  SP_NW: 12, SP_PRI_NW: 14, PARTS_NW: 16, PRIORITY_NW: 18, PREMIUM_NW: 20, TOTAL_NW: 24,
};

function findDateColIndex(rows) {
  // Scan the first several rows for the first column where most values parse as dates.
  const maxCol = Math.max(...rows.slice(0, 10).map(r => r.length));
  for (let c = 0; c < maxCol; c++) {
    let hits = 0, checked = 0;
    for (let i = 1; i < Math.min(rows.length, 10); i++) {
      if (rows[i][c] == null) continue;
      checked++;
      if (parseGvizDate(rows[i][c])) hits++;
    }
    if (checked >= 2 && hits === checked) return c;
  }
  return -1;
}

// Tue–Mon fiscal week numbering: week 1 runs from Jan 1 through the first Monday
// on/after Jan 1; each subsequent week is the following Tue–Mon span.
function fiscalWeek(year, monthNum, date) {
  const d = new Date(Date.UTC(year, monthNum - 1, date));
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Dow = jan1.getUTCDay(); // 0=Sun..6=Sat
  const daysToFirstMonday = (1 - jan1Dow + 7) % 7; // days from Jan1 to the first Monday
  const firstMonday = new Date(jan1); firstMonday.setUTCDate(1 + daysToFirstMonday);
  if (d <= firstMonday) return 1;
  const diffDays = Math.round((d - firstMonday) / 86400000);
  return 1 + Math.ceil(diffDays / 7);
}

function parseDetailRows(rows) {
  if (!rows.length) return [];
  const dateCol = findDateColIndex(rows);
  if (dateCol === -1) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const d = parseGvizDate(r[dateCol]);
    if (!d) continue;
    const at = (off) => num(r[dateCol + off]);
    const total = at(OFFSET.TOTAL);
    out.push({
      year: d.year, monthNum: d.monthNum, date: d.date,
      month: MONTH_ORDER[d.monthNum - 1],
      sp: at(OFFSET.SP) + at(OFFSET.SP_PRI),
      parts: at(OFFSET.PARTS),
      priority: at(OFFSET.PRIORITY),
      premium: at(OFFSET.PREMIUM),
      noOffers: at(OFFSET.NO_OFFERS),
      total,
      totalNW: at(OFFSET.TOTAL_NW),
      week: fiscalWeek(d.year, d.monthNum, d.date),
      dayOfWeek: null,
    });
  }
  const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for (const r of out) {
    r.dayOfWeek = DOW[new Date(Date.UTC(r.year, r.monthNum - 1, r.date)).getUTCDay()];
  }
  return out;
}

// "2026 Actuals" — Month is a real gviz Date cell for closed-out years (2022-2025), but
// the in-progress year's rows are typed into the sheet as plain month-name text
// ("January", or "November 2025"/"December 2025" for the two trailing-context rows)
// instead of real dates. gviz infers ONE type per column for the whole requested range;
// since the range is date-dominated, those text cells come back with a null value
// (dropped entirely, not even the formatted string survives) — which used to make the
// current year's spend/revenue vanish. Their OTHER columns (spend, leads, APCs...) come
// back fine though, so instead of trying to recover the label's text, we reconstruct it
// positionally: any run of null-date-but-has-data rows immediately following a real
// dated row is that year's next consecutive months. Capped at 12 so the trailing
// "Grand Total" / archived-year rows (which also have data, just no month) don't get
// misread as spillover months once a full year has been walked.
// Columns are fixed and confirmed directly against known values: Revenue Total(4),
// Total Spend(5), Working Marketing Spend(6), Leads From CRM(8), APCs(9).
function parseActualsRows(rows) {
  const out = [];
  const pushRow = (r, monthNum, year) => {
    out.push({
      month: MONTH_ORDER[monthNum - 1], monthNum, year,
      revenueTotal: num(r[4]),
      totalSpend: num(r[5]),
      workingSpend: num(r[6]),
      leads: num(r[8]),
      apcs: num(r[9]),
    });
  };
  let pendingMonth = null, pendingYear = null, advancedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const d = parseGvizDate(r[0]);
    if (d) {
      pushRow(r, d.monthNum, d.year);
      pendingMonth = d.monthNum; pendingYear = d.year; advancedCount = 0;
      continue;
    }
    if (pendingMonth == null || advancedCount >= 12) continue;
    const hasData = r.slice(1).some((c) => c != null && c !== '');
    if (!hasData) continue;
    pendingMonth += 1;
    if (pendingMonth > 12) { pendingMonth = 1; pendingYear += 1; }
    advancedCount += 1;
    pushRow(r, pendingMonth, pendingYear);
  }
  return out;
}

// ─── Aggregation helpers ───────────────────────────────────

function sumSeg(rows) {
  return rows.reduce((a, r) => ({
    sp: a.sp + r.sp, parts: a.parts + r.parts, priority: a.priority + r.priority,
    premium: a.premium + r.premium, total: a.total + r.total, totalNW: a.totalNW + r.totalNW,
  }), { sp: 0, parts: 0, priority: 0, premium: 0, total: 0, totalNW: 0 });
}

function latestDataDate(leadRows) {
  // Last row with a non-zero Total, in chronological order.
  const withData = leadRows.filter(r => r.total > 0);
  if (!withData.length) return null;
  return withData.reduce((latest, r) => {
    const rv = r.year * 10000 + r.monthNum * 100 + r.date;
    const lv = latest.year * 10000 + latest.monthNum * 100 + latest.date;
    return rv > lv ? r : latest;
  });
}

function monthProgressive(rows, year, monthNum, throughDay) {
  return rows.filter(r => r.year === year && r.monthNum === monthNum && r.date <= throughDay);
}

function ytdThrough(rows, year, monthNum, day) {
  return rows.filter(r => r.year === year && (r.monthNum < monthNum || (r.monthNum === monthNum && r.date <= day)));
}

function monthFull(rows, year, monthNum) {
  return rows.filter(r => r.year === year && r.monthNum === monthNum);
}

function pctDelta(a, b) {
  if (!a) return null;
  return ((b - a) / a) * 100;
}

// ─── Master compute ────────────────────────────────────────

function computeSnapshot({ leadRows: leadRowsAll, oaRows: oaRowsAll, apcRows: apcRowsAll, actualsRows }) {
  const anchor = latestDataDate(leadRowsAll);
  if (!anchor) throw new Error('No lead data found — check sheet range/tab names');
  const { year, monthNum: mNum, date: day } = anchor;
  const monthName = MONTH_ORDER[mNum - 1];
  const anchorOrdinal = year * 10000 + mNum * 100 + day;
  const ordinalOf = (r) => r.year * 10000 + r.monthNum * 100 + r.date;
  // Drop any row past the anchor date — the sheet's date formatting can extend to
  // template rows for the rest of the year that have no real figures yet, which would
  // otherwise pollute week/month aggregates (e.g. showing "week 52" instead of "now").
  const leadRows = leadRowsAll.filter(r => ordinalOf(r) <= anchorOrdinal);
  const oaRows = oaRowsAll.filter(r => ordinalOf(r) <= anchorOrdinal);
  const apcRows = apcRowsAll.filter(r => ordinalOf(r) <= anchorOrdinal);

  // Previous month (for progressive MoM), handling January wraparound
  const prevMonthNum = mNum === 1 ? 12 : mNum - 1;
  const prevYear = mNum === 1 ? year - 1 : year;
  const prevMonthName = MONTH_ORDER[prevMonthNum - 1];

  // ── YTD / MTD (Leads + APC; OA only where it exists, i.e. from Apr 17 on) ──
  const ytdLead = sumSeg(ytdThrough(leadRows, year, mNum, day));
  const ytdAPC = sumSeg(ytdThrough(apcRows, year, mNum, day));
  const mtdLead = sumSeg(monthProgressive(leadRows, year, mNum, day));
  const mtdAPC = sumSeg(monthProgressive(apcRows, year, mNum, day));

  // ── MoM Progressive: same day-of-month window, this month vs last month ──
  const momLeadPrev = sumSeg(monthProgressive(leadRows, prevYear, prevMonthNum, day));
  const momLeadCurr = mtdLead;
  const momOAPrev = sumSeg(monthProgressive(oaRows, prevYear, prevMonthNum, day));
  const momOACurr = sumSeg(monthProgressive(oaRows, year, mNum, day));
  const momAPCPrev = sumSeg(monthProgressive(apcRows, prevYear, prevMonthNum, day));
  const momAPCCurr = mtdAPC;

  // ── Week over Week: use the sheet's own WEEK column (fiscal Tue–Mon weeks) ──
  const weeksPresent = [...new Set(leadRows.filter(r => r.week).map(r => r.week))];
  const numericWeeks = weeksPresent.map(w => parseInt(w, 10)).filter(Number.isFinite).sort((a, b) => a - b);
  const lastWeek = numericWeeks[numericWeeks.length - 1];
  const prevWeek = numericWeeks[numericWeeks.length - 2];
  const byWeek = (rows, wk) => sumSeg(rows.filter(r => parseInt(r.week, 10) === wk));
  const wowLeadPrev = byWeek(leadRows, prevWeek);
  const wowLeadCurr = byWeek(leadRows, lastWeek);
  const wowOAPrev = byWeek(oaRows, prevWeek);
  const wowOACurr = byWeek(oaRows, lastWeek);
  const wowAPCPrev = byWeek(apcRows, prevWeek);
  const wowAPCCurr = byWeek(apcRows, lastWeek);

  // ── Mon–Wed same-weekday comparison (lag sanity check) ──
  // Uses the most recent *complete* Mon–Wed (its Wednesday on or before the anchor date)
  // and the same three days 7 days earlier, so both sides always cover 3 full days.
  // Real Date arithmetic so windows spanning a month boundary stay intact.
  const ordinal = (r) => r.year * 10000 + r.monthNum * 100 + r.date;
  const dayMs = 86400000;
  const anchorDate = new Date(Date.UTC(year, mNum - 1, day));
  const daysBackToWed = (anchorDate.getUTCDay() - 3 + 7) % 7; // 0=Sun..6=Sat, Wed=3
  const lastWed = new Date(anchorDate.getTime() - daysBackToWed * dayMs);
  const windowOrds = (wed) => [2, 1, 0].map(back => {
    const d = new Date(wed.getTime() - back * dayMs);
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  });
  const fmtOrd = (o) => `${MONTH_ORDER[Math.floor(o / 100) % 100 - 1].slice(0, 3)} ${o % 100}`;
  const thisOrds = windowOrds(lastWed);
  const prevOrds = windowOrds(new Date(lastWed.getTime() - 7 * dayMs));
  function segFromOrds(rows, ords) { return sumSeg(rows.filter(r => ords.includes(ordinal(r)))); }
  let monWedComparison = null;
  const hasAllDays = (ords) => ords.every(o => leadRows.some(r => ordinal(r) === o));
  if (hasAllDays(thisOrds) && hasAllDays(prevOrds)) {
    monWedComparison = {
      label: {
        prev: `${fmtOrd(prevOrds[0])}–${fmtOrd(prevOrds[2])}`,
        curr: `${fmtOrd(thisOrds[0])}–${fmtOrd(thisOrds[2])}`,
      },
      lead: { prev: segFromOrds(leadRows, prevOrds), curr: segFromOrds(leadRows, thisOrds) },
      oa: { prev: segFromOrds(oaRows, prevOrds), curr: segFromOrds(oaRows, thisOrds) },
      apc: { prev: segFromOrds(apcRows, prevOrds), curr: segFromOrds(apcRows, thisOrds) },
    };
  }

  const funnelMonthRows = { lead: monthFull(leadRows, prevYear, prevMonthNum), oa: monthFull(oaRows, prevYear, prevMonthNum), apc: monthFull(apcRows, prevYear, prevMonthNum) };
  const funnelPrevMonth = {
    label: `${prevMonthName} ${prevYear}`,
    lead: sumSeg(funnelMonthRows.lead).total,
    oa: sumSeg(funnelMonthRows.oa).total,
    apc: sumSeg(funnelMonthRows.apc).total,
  };

  // ── NW share trend by month (Leads) ──
  const nwTrend = MONTH_ORDER.slice(0, mNum).map((name, i) => {
    const mn = i + 1;
    const rows = monthFull(leadRows, year, mn);
    const s = sumSeg(rows);
    return { month: name.slice(0, 3), pct: s.total ? (s.totalNW / s.total) * 100 : null };
  });

  // ── Purchase Rate by segment: YTD + MTD ──
  function purchaseRate(leadAgg, apcAgg) {
    const rate = (a, l) => (l ? (a / l) * 100 : null);
    return {
      sp: rate(apcAgg.sp, leadAgg.sp),
      parts: rate(apcAgg.parts, leadAgg.parts),
      priority: rate(apcAgg.priority, leadAgg.priority),
      premium: rate(apcAgg.premium, leadAgg.premium),
      total: rate(apcAgg.total, leadAgg.total),
    };
  }

  // ── Actuals-derived monthly figures (Spend/Revenue/ROAS) ──
  const actualsByMonth = {};
  actualsRows.filter(r => r.year === year).forEach(r => { actualsByMonth[r.monthNum] = r; });
  let ytdSpend = 0, ytdRevenueThruLastReliable = 0, ytdRevenueMonths = 0, lastReliableRevMonth = 0;
  for (let m = 1; m <= mNum; m++) {
    const a = actualsByMonth[m];
    if (!a) continue;
    ytdSpend += a.workingSpend;
  }
  // Revenue/ROAS: cut 2 months before the anchor month (Copart lag) — only count months with real revenue.
  const revenueCutoffMonth = Math.max(0, mNum - 2);
  let revSum = 0, spendForRevSum = 0;
  for (let m = 1; m <= revenueCutoffMonth; m++) {
    const a = actualsByMonth[m];
    if (!a) continue;
    revSum += a.revenueTotal;
    spendForRevSum += a.workingSpend;
  }
  const mtdActuals = actualsByMonth[mNum] || null;

  return {
    asOf: { year, month: monthName, day },
    ytd: {
      leads: ytdLead.total, apcs: ytdAPC.total,
      purchaseRate: ytdLead.total ? (ytdAPC.total / ytdLead.total) * 100 : null,
      spend: ytdSpend,
      costPerLead: ytdLead.total ? ytdSpend / ytdLead.total : null,
      costPerAPC: ytdAPC.total ? ytdSpend / ytdAPC.total : null,
      revenue: revSum, roas: spendForRevSum ? revSum / spendForRevSum : null,
      revenueThruMonth: revenueCutoffMonth > 0 ? MONTH_ORDER[revenueCutoffMonth - 1] : null,
      purchaseRateBySegment: purchaseRate(ytdLead, ytdAPC),
    },
    mtd: {
      leads: mtdLead.total, apcs: mtdAPC.total,
      purchaseRate: mtdLead.total ? (mtdAPC.total / mtdLead.total) * 100 : null,
      spend: mtdActuals ? mtdActuals.workingSpend : null,
      costPerLead: mtdActuals && mtdLead.total ? mtdActuals.workingSpend / mtdLead.total : null,
      purchaseRateBySegment: purchaseRate(mtdLead, mtdAPC),
    },
    momProgressive: {
      label: `${prevMonthName} 1–${day} vs ${monthName} 1–${day}`,
      lead: { prev: momLeadPrev, curr: momLeadCurr },
      oa: { prev: momOAPrev, curr: momOACurr },
      apc: { prev: momAPCPrev, curr: momAPCCurr },
    },
    wow: {
      weekLabel: { prev: prevWeek, curr: lastWeek },
      lead: { prev: wowLeadPrev, curr: wowLeadCurr },
      oa: { prev: wowOAPrev, curr: wowOACurr },
      apc: { prev: wowAPCPrev, curr: wowAPCCurr },
    },
    monWedComparison,
    nwTrend,
    funnelPrevMonth,
  };
}

// ─── Master fetch ──────────────────────────────────────────

async function fetchAll() {
  const [leadRaw, oaRaw, apcRaw, actualsRaw] = await Promise.all([
    fetchRange(TABS.LEAD, DETAIL_RANGE),
    fetchRange(TABS.OA, DETAIL_RANGE),
    fetchRange(TABS.APC, DETAIL_RANGE),
    fetchRange(TABS.ACTUALS, ACTUALS_RANGE),
  ]);

  if (typeof window !== 'undefined') {
    console.log('[cb-snapshot] raw row counts:', { lead: leadRaw.length, oa: oaRaw.length, apc: apcRaw.length, actuals: actualsRaw.length });
    window.__cbSnapshotRaw = { leadRaw, oaRaw, apcRaw, actualsRaw };
  }

  const leadRows = parseDetailRows(leadRaw);
  const oaRows = parseDetailRows(oaRaw);
  const apcRows = parseDetailRows(apcRaw);
  const actualsRows = parseActualsRows(actualsRaw);

  if (typeof window !== 'undefined') {
    console.log('[cb-snapshot] parsed row counts:', { lead: leadRows.length, oa: oaRows.length, apc: apcRows.length, actuals: actualsRows.length });
    console.log('[cb-snapshot] first 3 parsed lead rows:', leadRows.slice(0, 3));
  }

  const snapshot = computeSnapshot({ leadRows, oaRows, apcRows, actualsRows });
  snapshot.fetchedAt = new Date().toISOString();

  if (typeof window !== 'undefined') {
    window.__cbSnapshotDebug = { leadRows, oaRows, apcRows, actualsRows, snapshot };
  }
  return snapshot;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (!raw) return null;
    return { data: JSON.parse(raw), ts: ts || null };
  } catch (e) { return null; }
}
function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
  } catch (e) { /* quota — ignore */ }
}

window.CarBrainSnapshotData = { fetchAll, loadCache, saveCache, SHEET_ID };
