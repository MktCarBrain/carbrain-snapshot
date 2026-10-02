const { useState, useEffect } = React;

const fmtNum = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const fmtMoney = (n) => (n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 1000 ? 2 : 0 })}`);
const fmtMoneyK = (n) => {
  if (n == null) return '—';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtPct = (n, d = 2) => (n == null ? '—' : `${n.toFixed(d)}%`);
const fmtDelta = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);
const pctDelta = (a, b) => (!a ? null : ((b - a) / a) * 100);

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
      {sub && <div className="k-thru">{sub}</div>}
    </div>
  );
}

function DeltaCell({ value }) {
  if (value == null) return <td>—</td>;
  const cls = value > 0 ? 'up' : value < 0 ? 'down' : '';
  return <td className={cls}>{fmtDelta(value)}</td>;
}

function SegTable({ title, prev, curr, prevLabel, currLabel, pctDelta, dark }) {
  const rows = [
    ['Total', prev.total, curr.total],
    ['SP', prev.sp, curr.sp],
    ['Parts', prev.parts, curr.parts],
    ['Priority', prev.priority, curr.priority],
    ['Premium', prev.premium, curr.premium],
  ];
  return (
    <table className="wow">
      <thead><tr><th>{title}</th><th>{prevLabel}</th><th>{currLabel}</th><th>Δ</th></tr></thead>
      <tbody>
        {rows.map(([label, a, b]) => (
          <tr key={label}>
            <td className="metric">{label}</td>
            <td>{fmtNum(a)}</td>
            <td>{fmtNum(b)}</td>
            <DeltaCell value={pctDelta(a, b)} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bar({ label, value, maxScale }) {
  const width = value == null ? 0 : Math.min(100, (value / maxScale) * 100);
  return (
    <div className="bar-row">
      <div className="bar-label"><span>{label}</span><span>{fmtPct(value)}</span></div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${width}%` }} /></div>
    </div>
  );
}

// ─── Tab navigation ───────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  return (
    <div className="tab-nav">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`tab-btn${active === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── CSV export (no dependency — build the string by hand) ──
function toCsv(rows) {
  return rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
function downloadCsv(filename, rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DownloadButton({ label, rows, filename }) {
  return (
    <button className="dl-btn" onClick={() => downloadCsv(filename, rows)}>
      ⬇ {label}
    </button>
  );
}

// ─── Overview tab (the original single-view content) ──────
function OverviewTab({ snap }) {
  const asOfLabel = `${snap.asOf.month} ${snap.asOf.day}, ${snap.asOf.year}`;
  return (
    <>
      <div className="section-label"><span className="dot" />YEAR-TO-DATE {snap.asOf.year}<span className="range"> — Jan 1 through {asOfLabel}</span></div>
      <div className="tiles">
        <Tile label="Total Leads" value={fmtNum(snap.ytd.leads)} sub={`thru ${snap.asOf.month} ${snap.asOf.day}`} />
        <Tile label="APCs" value={fmtNum(snap.ytd.apcs)} sub="segment-verified" />
        <Tile label="Purchase Rate" value={fmtPct(snap.ytd.purchaseRate)} sub="APC / Lead, blended" />
        <Tile label="Working Ad Spend" value={fmtMoneyK(snap.ytd.spend)} sub={`thru ${snap.asOf.month} ${snap.asOf.day}`} />
        <Tile label="Cost / Lead" value={fmtMoney(snap.ytd.costPerLead)} sub="blended" />
        <Tile label="Cost / APC" value={fmtMoney(snap.ytd.costPerAPC)} sub="blended" />
        <Tile label="Revenue" value={fmtMoneyK(snap.ytd.revenue)} sub={snap.ytd.revenueThruMonth ? `thru ${snap.ytd.revenueThruMonth} only — lag*` : 'pending'} />
        <Tile label="ROAS" value={snap.ytd.roas != null ? snap.ytd.roas.toFixed(2) : '—'} sub={snap.ytd.revenueThruMonth ? `thru ${snap.ytd.revenueThruMonth} only*` : 'pending'} />
      </div>

      <div className="section-label"><span className="dot" />{snap.asOf.month.toUpperCase()} MTD<span className="range"> — 1–{snap.asOf.day}</span></div>
      <div className="tiles">
        <Tile label="Leads" value={fmtNum(snap.mtd.leads)} sub={`1–${snap.asOf.day}`} />
        <Tile label="APCs" value={fmtNum(snap.mtd.apcs)} sub={`1–${snap.asOf.day}`} />
        <Tile label="Purchase Rate" value={fmtPct(snap.mtd.purchaseRate)} sub="still closing" />
        <Tile label="Ad Spend" value={fmtMoneyK(snap.mtd.spend)} sub={`1–${snap.asOf.day}`} />
      </div>

      <div className="section-label"><span className="dot" />MONTH OVER MONTH — PROGRESSIVE<span className="range"> — {snap.momProgressive.label} (same day-of-month window)</span></div>
      <div className="panels">
        <div className="panel"><div className="panel-head">Leads</div><div className="panel-body">
          <SegTable title="Segment" prev={snap.momProgressive.lead.prev} curr={snap.momProgressive.lead.curr} prevLabel="Prev mo." currLabel="This mo." pctDelta={pctDelta} />
        </div></div>
        <div className="panel"><div className="panel-head">Offer Accepted</div><div className="panel-body">
          <SegTable title="Segment" prev={snap.momProgressive.oa.prev} curr={snap.momProgressive.oa.curr} prevLabel="Prev mo." currLabel="This mo." pctDelta={pctDelta} />
        </div></div>
        <div className="panel" style={{ gridColumn: '1 / -1' }}><div className="panel-head">APC</div><div className="panel-body">
          <SegTable title="Segment" prev={snap.momProgressive.apc.prev} curr={snap.momProgressive.apc.curr} prevLabel="Prev mo." currLabel="This mo." pctDelta={pctDelta} />
        </div></div>
      </div>

      <div className="section-label"><span className="dot" />WEEK OVER WEEK<span className="range"> — fiscal week {snap.wow.weekLabel.prev} vs {snap.wow.weekLabel.curr}</span></div>
      <div className="panels">
        <div className="panel panel-dark"><div className="panel-head">Leads → OA → APC</div><div className="panel-body">
          <SegTable title="Leads" prev={snap.wow.lead.prev} curr={snap.wow.lead.curr} prevLabel="Last wk" currLabel="This wk" pctDelta={pctDelta} />
          <div style={{ marginTop: 12 }}><SegTable title="Offer Accepted" prev={snap.wow.oa.prev} curr={snap.wow.oa.curr} prevLabel="Last wk" currLabel="This wk" pctDelta={pctDelta} /></div>
          <div style={{ marginTop: 12 }}><SegTable title="APC" prev={snap.wow.apc.prev} curr={snap.wow.apc.curr} prevLabel="Last wk" currLabel="This wk" pctDelta={pctDelta} /></div>
        </div></div>
        <div className="panel panel-dark"><div className="panel-head">Mon–Wed Check: Lag Sanity Read</div><div className="panel-body">
          {snap.monWedComparison ? (
            <>
              <div className="note">Same three weekdays, one week apart — catches conversions that lag past the full-week cutoff above.</div>
              <div style={{ marginTop: 8 }}><SegTable title="Offer Accepted" prev={snap.monWedComparison.oa.prev} curr={snap.monWedComparison.oa.curr} prevLabel="Last wk" currLabel="This wk" pctDelta={pctDelta} /></div>
            </>
          ) : <div className="note">Not enough recent data to compute this yet.</div>}
        </div></div>
      </div>

      <div className="section-label"><span className="dot" />PURCHASE RATE BY SEGMENT<span className="range"> — YTD and {snap.asOf.month} MTD</span></div>
      <div className="panels">
        <div className="panel"><div className="panel-head" style={{ color: 'var(--cb-deep-blue)', borderBottomColor: 'var(--cb-light-blue)' }}>YTD {snap.asOf.year}</div><div className="panel-body">
          <Bar label="SP" value={snap.ytd.purchaseRateBySegment.sp} maxScale={12} />
          <Bar label="Premium" value={snap.ytd.purchaseRateBySegment.premium} maxScale={12} />
          <Bar label="Priority" value={snap.ytd.purchaseRateBySegment.priority} maxScale={12} />
          <Bar label="Parts" value={snap.ytd.purchaseRateBySegment.parts} maxScale={12} />
        </div></div>
        <div className="panel"><div className="panel-head" style={{ color: 'var(--cb-deep-blue)', borderBottomColor: 'var(--cb-light-blue)' }}>{snap.asOf.month} MTD</div><div className="panel-body">
          <Bar label="SP" value={snap.mtd.purchaseRateBySegment.sp} maxScale={12} />
          <Bar label="Premium" value={snap.mtd.purchaseRateBySegment.premium} maxScale={12} />
          <Bar label="Priority" value={snap.mtd.purchaseRateBySegment.priority} maxScale={12} />
          <Bar label="Parts" value={snap.mtd.purchaseRateBySegment.parts} maxScale={12} />
        </div></div>
      </div>

      <div className="section-label"><span className="dot" />NW SHARE TREND<span className="range"> — % of leads that are Normal Wear / low-damage</span></div>
      <div className="panels">
        <div className="panel" style={{ gridColumn: '1 / -1' }}><div className="panel-body">
          <table className="wow">
            <thead><tr>{snap.nwTrend.map(m => <th key={m.month}>{m.month}</th>)}</tr></thead>
            <tbody><tr>{snap.nwTrend.map(m => <td key={m.month} style={{ textAlign: 'center', fontWeight: 800 }}>{fmtPct(m.pct, 1)}</td>)}</tr></tbody>
          </table>
        </div></div>
      </div>

      <div className="section-label"><span className="dot" />FUNNEL — LEADS → OFFER ACCEPTED → APC<span className="range"> — {snap.funnelPrevMonth.label} (last full month)</span></div>
      <div className="panels">
        <div className="panel" style={{ gridColumn: '1 / -1' }}><div className="panel-body">
          <div className="funnel-stage"><div className="funnel-label">Leads</div><div className="funnel-bar" style={{ width: '100%' }}>{fmtNum(snap.funnelPrevMonth.lead)}</div></div>
          <div className="funnel-conv">↓ {fmtPct(snap.funnelPrevMonth.lead ? (snap.funnelPrevMonth.oa / snap.funnelPrevMonth.lead) * 100 : null, 1)} became Offer Accepted</div>
          <div className="funnel-stage"><div className="funnel-label">OA</div><div className="funnel-bar" style={{ width: `${snap.funnelPrevMonth.lead ? (snap.funnelPrevMonth.oa / snap.funnelPrevMonth.lead) * 100 : 5}%` }}>{fmtNum(snap.funnelPrevMonth.oa)}</div></div>
          <div className="funnel-conv">↓ {fmtPct(snap.funnelPrevMonth.oa ? (snap.funnelPrevMonth.apc / snap.funnelPrevMonth.oa) * 100 : null, 1)} of OA became APC</div>
          <div className="funnel-stage"><div className="funnel-label">APC</div><div className="funnel-bar" style={{ width: `${snap.funnelPrevMonth.lead ? (snap.funnelPrevMonth.apc / snap.funnelPrevMonth.lead) * 100 : 3}%` }}>{fmtNum(snap.funnelPrevMonth.apc)}</div></div>
          <div className="alert-box" style={{ marginTop: 6 }}>
            <b>Aggregate monthly volume, not a linked cohort:</b> OA and APC counts reflect conversions during this month, which include leads created earlier — not necessarily this month's own leads. Reasonable at a full-month window; don't read a weekly cut this way.
          </div>
        </div></div>
      </div>
    </>
  );
}

// ─── Purchase & Sales tab (new — matches the reference KPI scorecard pattern) ──
function StatCard({ label, value, sub }) {
  return (
    <div className="tile">
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
      {sub && <div className="k-thru">{sub}</div>}
    </div>
  );
}

function DetailTable({ title, rows, columns, filename, firstColLabel }) {
  const cols = [{ ...columns[0], label: firstColLabel || columns[0].label }, ...columns.slice(1)];
  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{title}</span>
        <DownloadButton label="Download CSV" filename={filename} rows={[cols.map(c => c.label), ...rows.map(r => cols.map(c => c.get(r)))]} />
      </div>
      <div className="panel-body">
        <table className="wow">
          <thead><tr>{cols.map(c => <th key={c.label}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map(([name, k]) => (
              <tr key={name}>
                {cols.map((c, i) => i === 0
                  ? <td className="metric" key={c.label}>{name}</td>
                  : <td key={c.label}>{c.get([name, k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseSalesTab() {
  const data = window.CarBrainPurchaseSalesData;
  if (!data) return <div className="note">Purchase & Sales data module not loaded.</div>;

  const o = data.overall;
  const sp = data.spSummary;
  const gt = data.grandTotal;

  const segCols = [
    { label: 'Segment', get: ([n]) => n },
    { label: '# Purchased', get: ([, k]) => fmtNum(k.nPurchased) },
    { label: 'Avg Cost', get: ([, k]) => fmtMoney(k.avgCost) },
    { label: '# Sold', get: ([, k]) => fmtNum(k.nSold) },
    { label: 'Avg Sale', get: ([, k]) => fmtMoney(k.avgSale) },
    { label: 'Avg Profit', get: ([, k]) => (k.avgProfit != null ? fmtMoney(k.avgProfit) : '—') },
    { label: 'Gross Margin', get: ([, k]) => (k.margin != null ? fmtPct(k.margin, 1) : '—') },
  ];

  return (
    <>
      {!data.isLive && (
        <div className="alert-box" style={{ marginBottom: 18 }}>
          <b>Manual, per-report refresh:</b> populated from {data.sourceNote} As of {data.asOf}. Update <code>purchase-sales-data.jsx</code> when the next report lands — same pattern as GA4/Google Ads today.
        </div>
      )}

      <div className="section-label"><span className="dot" />TOTAL PURCHASES — ALL SEGMENTS<span className="range"> — every APC, {data.asOf}</span></div>
      <div className="panels">
        <div className="panel panel-dark" style={{ gridColumn: '1 / -1' }}><div className="panel-body">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-secondary)', fontWeight: 900, fontSize: 34, color: 'var(--cb-white)' }}>{fmtNum(gt.nPurchased)}</span>
            <span style={{ fontSize: 13, color: 'var(--cb-light-blue-200)' }}>total vehicles purchased, every segment</span>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatCard label="SP" value={fmtNum(gt.bySegmentCount.SP)} sub={fmtPct((gt.bySegmentCount.SP / gt.nPurchased) * 100, 0)} />
            <StatCard label="Parts" value={fmtNum(gt.bySegmentCount.Parts)} sub={fmtPct((gt.bySegmentCount.Parts / gt.nPurchased) * 100, 0)} />
            <StatCard label="Priority" value={fmtNum(gt.bySegmentCount.Priority)} sub={fmtPct((gt.bySegmentCount.Priority / gt.nPurchased) * 100, 0)} />
            <StatCard label="Premium" value={fmtNum(gt.bySegmentCount.Premium)} sub={fmtPct((gt.bySegmentCount.Premium / gt.nPurchased) * 100, 0)} />
          </div>
        </div></div>
      </div>

      <div className="section-label"><span className="dot" />AUCTION ECONOMICS — PARTS + PRIORITY + PREMIUM<span className="range"> — the {fmtNum(o.nPurchased)} of those {fmtNum(gt.nPurchased)} that go through Copart/IAA, {data.asOf}</span></div>

      <div className="tiles">
        <StatCard label="# Purchased" value={fmtNum(o.nPurchased)} sub={data.asOf} />
        <StatCard label="Average Cost" value={fmtMoney(o.avgCost)} sub="per vehicle" />
        <StatCard label="High Price" value={fmtMoney(o.highPrice)} sub="single purchase" />
        <StatCard label="Low Price" value={fmtMoney(o.lowPrice)} sub="single purchase" />
      </div>
      <div className="tiles" style={{ marginTop: 10 }}>
        <StatCard label="# Sold" value={fmtNum(o.nSold)} sub={`${fmtPct((o.nSold / o.nPurchased) * 100, 0)} of purchased`} />
        <StatCard label="Average Sale Price" value={fmtMoney(o.avgSale)} sub="per vehicle" />
        <StatCard label="Average Profit" value={o.avgProfit != null ? fmtMoney(o.avgProfit) : '—'} sub="per vehicle sold" />
        <StatCard label="Gross Margin" value={fmtPct(o.margin, 1)} sub={`${fmtMoneyK(o.totalProfit)} GP / ${fmtMoneyK(o.totalSale)} sales`} />
      </div>

      <div className="section-label"><span className="dot" />SP — NO AUCTION STEP<span className="range"> — fee paid directly by CarBrain, same transaction is the revenue</span></div>
      <div className="panels">
        <div className="panel panel-dark" style={{ gridColumn: '1 / -1' }}><div className="panel-body">
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatCard label="# Transactions" value={fmtNum(sp.nTransactions)} sub={data.asOf} />
            <StatCard label="Average Fee" value={fmtMoney(sp.avgAmount)} sub="Amount Due CarBrain.com" />
            <StatCard label="Total Revenue" value={fmtMoneyK(sp.totalAmount)} sub="= profit, 100% margin" />
            <StatCard label="High / Low" value={`${fmtMoney(sp.highAmount)} / ${fmtMoney(sp.lowAmount)}`} sub="single transaction" />
          </div>
        </div></div>
      </div>

      <div className="section-label"><span className="dot" />BY SEGMENT</div>
      <div className="panels">
        <DetailTable title="Parts / Priority / Premium" rows={Object.entries(data.bySegment)} columns={segCols} firstColLabel="Segment" filename="carbrain_purchase_sales_by_segment.csv" />
      </div>

      <div className="section-label"><span className="dot" />BY ATTRIBUTION CHANNEL</div>
      <div className="panels">
        <DetailTable title="Channel" rows={Object.entries(data.byChannel).sort((a, b) => b[1].nPurchased - a[1].nPurchased)} columns={segCols} firstColLabel="Channel" filename="carbrain_purchase_sales_by_channel.csv" />
      </div>

      <div className="section-label"><span className="dot" />BY SEARCH THEME<span className="range"> — paid search only; Direct/Referral/Affiliate/Social fall in "Other/Unmapped"</span></div>
      <div className="panels">
        <DetailTable title="Theme" rows={Object.entries(data.byTheme).sort((a, b) => b[1].nPurchased - a[1].nPurchased)} columns={segCols} firstColLabel="Theme" filename="carbrain_purchase_sales_by_theme.csv" />
      </div>
    </>
  );
}

// ─── Scenario Predictor tab (expanded — Total Leads base, unit/profit
// predictions, and real Channel + Theme bars against a dynamic threshold) ──
const SEG_REFERENCE = {
  SP:          { profitUnit: 112.47,  color: '#6B7A8F' },
  Parts:       { profitUnit: 281.99,  color: '#0F9D58' },
  Priority:    { profitUnit: 929.36,  color: '#00BBEA' },
  Premium:     { profitUnit: 2275.62, color: '#002147' },
  'No Offers': { profitUnit: 0,       color: '#C7CDD4' },
};
const TODAY_SHARES = { SP: 42.4, Parts: 34.4, Priority: 13.4, Premium: 5.7, 'No Offers': 4.1 };
const TODAY_PRS = { SP: 7.94, Parts: 3.63, Priority: 6.56, Premium: 6.93 };
const EFFICIENCY_RATIO = 2.49;
const TODAY_TOTAL_LEADS = 325564; // Jan-Aug 2026 actual, for the "Today" reset

// Real, validated figures from this conversation's analysis (APC 2025-2026 CRM,
// Attribution Channel × Vehicle Type; Search Theme Yield). Not on a live feed —
// update by hand alongside purchase-sales-data.jsx.
const CHANNEL_REALITY = [
  { name: 'Direct',      ppPct: 28.6, apcShare: 1806 / 19389 },
  { name: 'SEO',         ppPct: 27.3, apcShare: 3014 / 19389 },
  { name: 'PPC Search',  ppPct: 24.2, apcShare: 5283 / 19389 },
  { name: 'PMax',        ppPct: 22.8, apcShare: 4160 / 19389 },
  { name: 'Affiliate',   ppPct: 16.8, apcShare: 713 / 19389 },
  { name: 'Paid Social', ppPct: 16.4, apcShare: 1400 / 19389 },
  { name: 'Referral',    ppPct: 13.6, apcShare: 3013 / 19389 },
];
const THEME_REALITY = [
  { name: 'PMax Priority', ppPct: 48.8, apcShare: 1364 / 7297 },
  { name: 'Non-Running',   ppPct: 34.0, apcShare: 94 / 7297 },
  { name: 'Brand',         ppPct: 26.4, apcShare: 1869 / 7297 },
  { name: 'Engine',        ppPct: 25.6, apcShare: 1346 / 7297 },
  { name: 'Damaged',       ppPct: 21.4, apcShare: 939 / 7297 },
  { name: 'Accident',      ppPct: 14.7, apcShare: 590 / 7297 },
  { name: 'Junk',          ppPct: 13.4, apcShare: 231 / 7297 },
  { name: 'PMax General',  ppPct: 8.0,  apcShare: 864 / 7297 },
];

function Slider({ label, value, onChange, min, max, step, unit, disabled }) {
  return (
    <div className="slider-row">
      <div className="slider-label"><span>{label}</span><span className="slider-value">{disabled ? '—' : `${value.toFixed(step < 1 ? 1 : 0)}${unit}`}</span></div>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="range-slider"
      />
    </div>
  );
}

// ─── Per-channel / per-theme projection ──────────────────
// Each channel carries its own lead volume, segment mix (share of leads) and
// per-segment PR. Units = leads × share × PR; profit = units × Profit/Unit.
// So a richer P+P mix raises both profit and the CPL/CPA it can afford.
const SEGMENTS = ['SP', 'Parts', 'Priority', 'Premium', 'No Offers'];
const PR_SEGMENTS = ['SP', 'Parts', 'Priority', 'Premium'];
const THEME_LEAD_BASE = 7297 / 19389; // paid-search themes' share of all APCs, used as their default share of leads

// The real P+P% we have per channel is a share of its APCs. Convert it to a
// share-of-leads mix: split each side using today's APC proportions, then
// divide by each segment's PR (APC share / PR ∝ lead share). At today's
// blended P+P% this returns TODAY_SHARES.
function mixFromPP(ppPct) {
  const apc = s => TODAY_SHARES[s] * TODAY_PRS[s];
  const ppAPC = apc('Priority') + apc('Premium');
  const nonAPC = apc('SP') + apc('Parts');
  const p = ppPct / 100;
  const apcMix = {
    Priority: p * apc('Priority') / ppAPC,
    Premium: p * apc('Premium') / ppAPC,
    SP: (1 - p) * apc('SP') / nonAPC,
    Parts: (1 - p) * apc('Parts') / nonAPC,
  };
  const raw = {};
  PR_SEGMENTS.forEach(s => { raw[s] = apcMix[s] / TODAY_PRS[s]; });
  const sum = PR_SEGMENTS.reduce((a, s) => a + raw[s], 0);
  const noOffers = TODAY_SHARES['No Offers'];
  const shares = { 'No Offers': noOffers };
  PR_SEGMENTS.forEach(s => { shares[s] = Math.round((raw[s] / sum) * (100 - noOffers) * 10) / 10; });
  return shares;
}

function projectMix({ leads, shares, prs }) {
  const bySeg = SEGMENTS.map(seg => {
    const pr = seg === 'No Offers' ? 0 : prs[seg];
    const units = leads * (shares[seg] / 100) * (pr / 100);
    return { seg, units, profit: units * SEG_REFERENCE[seg].profitUnit };
  });
  const units = bySeg.reduce((a, d) => a + d.units, 0);
  const profit = bySeg.reduce((a, d) => a + d.profit, 0);
  const ppUnits = bySeg.filter(d => d.seg === 'Priority' || d.seg === 'Premium').reduce((a, d) => a + d.units, 0);
  const breakevenCPL = leads > 0 ? profit / leads : 0;
  const breakevenCPA = units > 0 ? profit / units : null;
  return {
    bySeg, units, profit,
    pr: leads > 0 ? (units / leads) * 100 : 0,
    ppLeadShare: shares.Priority + shares.Premium,
    ppAPCShare: units > 0 ? (ppUnits / units) * 100 : 0,
    breakevenCPL, breakevenCPA,
    maintainCPL: breakevenCPL / EFFICIENCY_RATIO,
    maintainCPA: breakevenCPA != null ? breakevenCPA / EFFICIENCY_RATIO : null,
  };
}

// Default config per row: mix from its real P+P%, PRs from the global sliders,
// and leads split from baseLeads in proportion to APC share / blended PR.
function buildDefaults(rows, baseLeads, prs) {
  const pre = rows.map(r => {
    const shares = mixFromPP(r.ppPct);
    const pr = projectMix({ leads: 1, shares, prs }).pr || TODAY_PRS.SP;
    return { r, shares, weight: r.apcShare / pr };
  });
  const totalW = pre.reduce((a, x) => a + x.weight, 0) || 1;
  const out = {};
  pre.forEach(({ r, shares, weight }) => {
    out[r.name] = { leads: Math.round(baseLeads * weight / totalW), shares, prs: { ...prs } };
  });
  return out;
}

function MixBar({ shares }) {
  return (
    <div className="mix-bar">
      {SEGMENTS.map(seg => shares[seg] > 0 && (
        <div key={seg} style={{ width: `${shares[seg]}%`, background: SEG_REFERENCE[seg].color }} title={`${seg}: ${shares[seg].toFixed(1)}% of leads`} />
      ))}
    </div>
  );
}

function ChannelCard({ name, realPP, cfg, isEdited, onChange, onReset, targetCPL }) {
  const [open, setOpen] = useState(false);
  const p = projectMix(cfg);
  const clears = p.breakevenCPL >= targetCPL;
  const scale = Math.max(targetCPL * 2, p.breakevenCPL * 1.3, 10);
  const fillPct = Math.min(100, (p.breakevenCPL / scale) * 100);
  const markerPct = Math.min(100, (targetCPL / scale) * 100);
  const maintainPct = Math.min(100, (p.maintainCPL / scale) * 100);
  const shareTotal = SEGMENTS.reduce((a, s) => a + cfg.shares[s], 0);
  const setShare = (seg, v) => onChange({ ...cfg, shares: { ...cfg.shares, [seg]: v } });
  const setPR = (seg, v) => onChange({ ...cfg, prs: { ...cfg.prs, [seg]: v } });

  return (
    <div className="channel-card">
      <div className="channel-card-top">
        <div className="channel-card-name">{name}{isEdited && <span className="edited-chip">edited</span>}</div>
        <div className="channel-card-mix" title={`Real data: ${realPP.toFixed(1)}% of this channel's APCs are P+P`}>
          P+P {fmtPct(p.ppLeadShare, 1)} of leads · {fmtPct(p.ppAPCShare, 1)} of APCs
        </div>
      </div>
      <MixBar shares={cfg.shares} />

      <div className="chan-metrics">
        <div><span>Leads</span><b>{fmtNum(cfg.leads)}</b></div>
        <div><span>Units (PR {fmtPct(p.pr, 2)})</span><b>{fmtNum(p.units)}</b></div>
        <div><span>Gross Profit</span><b>{fmtMoneyK(p.profit)}</b></div>
        <div><span>Breakeven CPL</span><b>{fmtMoney(p.breakevenCPL)}</b></div>
        <div><span>Maintain CPL</span><b>{fmtMoney(p.maintainCPL)}</b></div>
        <div><span>Breakeven CPA</span><b>{p.breakevenCPA != null ? fmtMoney(p.breakevenCPA) : '—'}</b></div>
        <div><span>Maintain CPA</span><b>{p.maintainCPA != null ? fmtMoney(p.maintainCPA) : '—'}</b></div>
      </div>

      <div className="threshold-track">
        <div className={`threshold-fill ${clears ? 'clears' : 'below'}`} style={{ width: `${fillPct}%` }} />
        <div className="threshold-maintain" style={{ left: `${maintainPct}%` }} title={`Maintain-efficiency CPL: ${fmtMoney(p.maintainCPL)}`} />
        <div className="threshold-marker" style={{ left: `${markerPct}%` }} title={`Target CPL: $${targetCPL.toFixed(2)}`} />
      </div>
      <div className="channel-card-bottom">
        <span className={`threshold-value ${clears ? 'clears' : 'below'}`}>
          Can pay up to {fmtMoney(p.breakevenCPL)}/lead {clears ? '✓ clears' : '✗ below'} ${targetCPL.toFixed(2)} target
        </span>
        <span>
          <button className="dl-btn" onClick={() => setOpen(o => !o)}>{open ? '▴ Hide mix' : '▾ Edit leads, mix & PR'}</button>
          {isEdited && <button className="dl-btn" style={{ marginLeft: 6 }} onClick={onReset}>↺ Reset</button>}
        </span>
      </div>

      {open && (
        <div className="chan-edit">
          <div className="chan-edit-leads">
            <label>Leads for {name}</label>
            <input type="number" className="number-input" value={cfg.leads} step={500}
              onChange={e => onChange({ ...cfg, leads: Math.max(0, parseInt(e.target.value) || 0) })} />
          </div>
          <div className="chan-edit-grid">
            {SEGMENTS.map(seg => {
              const d = p.bySeg.find(x => x.seg === seg);
              return (
                <div key={seg} className="scenario-seg-card" style={{ borderLeftColor: SEG_REFERENCE[seg].color }}>
                  <div className="scenario-seg-name">{seg}</div>
                  <Slider label="Share of Leads" value={cfg.shares[seg]} onChange={v => setShare(seg, v)} min={0} max={100} step={0.5} unit="%" />
                  <Slider label="Purchase Rate" value={seg === 'No Offers' ? 0 : cfg.prs[seg]} onChange={v => setPR(seg, v)} min={0} max={15} step={0.1} unit="%" disabled={seg === 'No Offers'} />
                  <div className="scenario-predicted">
                    <div><span>Units</span><b>{fmtNum(d.units)}</b></div>
                    <div><span>Profit</span><b>{fmtMoneyK(d.profit)}</b></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`total-share-indicator ${Math.abs(shareTotal - 100) < 0.3 ? 'ok' : 'warn'}`}>
            Mix total: <b>{shareTotal.toFixed(1)}%</b> {Math.abs(shareTotal - 100) < 0.3 ? '✓' : '— should sum to 100%'}
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelPlan({ title, range, rows, defaults, overrides, setOverrides, targetCPL, note }) {
  const cfgFor = name => ({ ...defaults[name], ...(overrides[name] || {}) });
  const totals = rows.reduce((acc, r) => {
    const cfg = cfgFor(r.name);
    const p = projectMix(cfg);
    acc.leads += cfg.leads; acc.units += p.units; acc.profit += p.profit;
    return acc;
  }, { leads: 0, units: 0, profit: 0 });
  const sorted = [...rows].sort((a, b) => projectMix(cfgFor(b.name)).breakevenCPL - projectMix(cfgFor(a.name)).breakevenCPL);

  return (
    <>
      <div className="section-label"><span className="dot" />{title}<span className="range"> — {range}</span></div>
      <div className="tiles">
        <StatCard label="Leads in plan" value={fmtNum(totals.leads)} sub="sum of the cards below" />
        <StatCard label="Units (APC)" value={fmtNum(totals.units)} sub={`${fmtPct(totals.leads ? (totals.units / totals.leads) * 100 : 0, 2)} blended PR`} />
        <StatCard label="Gross Profit" value={fmtMoneyK(totals.profit)} sub="sum of the cards below" />
        <StatCard label="Blended Breakeven CPL" value={fmtMoney(totals.leads ? totals.profit / totals.leads : 0)} sub={`CPA ${totals.units ? fmtMoney(totals.profit / totals.units) : '—'}`} />
      </div>
      <div className="panels">
        <div className="panel" style={{ gridColumn: '1 / -1' }}><div className="panel-body">
          {sorted.map(r => (
            <ChannelCard key={r.name} name={r.name} realPP={r.ppPct} cfg={cfgFor(r.name)} targetCPL={targetCPL}
              isEdited={!!overrides[r.name]}
              onChange={cfg => setOverrides(o => ({ ...o, [r.name]: cfg }))}
              onReset={() => setOverrides(o => { const n = { ...o }; delete n[r.name]; return n; })} />
          ))}
          <div className="mix-legend">
            {SEGMENTS.map(seg => <span key={seg}><i style={{ background: SEG_REFERENCE[seg].color }} />{seg}</span>)}
            <span><i className="legend-target" />Target CPL</span>
            <span><i className="legend-maintain" />Maintain-efficiency CPL</span>
          </div>
          {note && <div className="note" style={{ marginTop: 10 }}>{note}</div>}
        </div></div>
      </div>
    </>
  );
}

function ScenarioPredictorTab() {
  const [totalLeads, setTotalLeads] = useState(467000);
  const [shares, setShares] = useState({ ...TODAY_SHARES });
  const [prs, setPrs] = useState({ ...TODAY_PRS });
  const [targetCPL, setTargetCPL] = useState(25);
  const [channelOverrides, setChannelOverrides] = useState({});
  const [themeOverrides, setThemeOverrides] = useState({});

  const segments = ['SP', 'Parts', 'Priority', 'Premium', 'No Offers'];
  const totalShare = segments.reduce((a, s) => a + shares[s], 0);

  // Per-segment unit + profit predictions, driven by Total Leads
  const segmentDetail = segments.map(seg => {
    const pr = seg === 'No Offers' ? 0 : prs[seg];
    const units = totalLeads * (shares[seg] / 100) * (pr / 100);
    const profit = units * SEG_REFERENCE[seg].profitUnit;
    return { seg, units, profit };
  });
  const totalUnits = segmentDetail.reduce((a, d) => a + d.units, 0);
  const totalProfit = segmentDetail.reduce((a, d) => a + d.profit, 0);

  const profitPerLead = totalLeads > 0 ? totalProfit / totalLeads : 0;
  const blendedPR = totalLeads > 0 ? totalUnits / totalLeads : 0;
  const profitPerAPC = totalUnits > 0 ? totalProfit / totalUnits : null;
  const breakevenCPL = profitPerLead;
  const breakevenCPA = profitPerAPC;
  const maintainCPL = profitPerLead / EFFICIENCY_RATIO;
  const maintainCPA = profitPerAPC != null ? profitPerAPC / EFFICIENCY_RATIO : null;

  const channelDefaults = buildDefaults(CHANNEL_REALITY, totalLeads, prs);
  const themeDefaults = buildDefaults(THEME_REALITY, Math.round(totalLeads * THEME_LEAD_BASE), prs);

  // Reverse: min P+P% needed for the target CPL, using today's Priority:Premium (70:30) and SP:Parts:NoOffers blend as the fixed internal split
  const ppProfitPerLeadUnit = 0.6995 * (TODAY_PRS.Priority / 100) * SEG_REFERENCE.Priority.profitUnit
    + 0.3005 * (TODAY_PRS.Premium / 100) * SEG_REFERENCE.Premium.profitUnit;
  const nonPPProfitPerLeadUnitReal = 0.5246 * (TODAY_PRS.SP / 100) * SEG_REFERENCE.SP.profitUnit
    + 0.4251 * (TODAY_PRS.Parts / 100) * SEG_REFERENCE.Parts.profitUnit
    + 0.0503 * 0;
  const minPPBreakeven = Math.max(0, ((targetCPL - nonPPProfitPerLeadUnitReal) / (ppProfitPerLeadUnit - nonPPProfitPerLeadUnitReal)) * 100);
  const minPPMaintain = ((targetCPL * EFFICIENCY_RATIO - nonPPProfitPerLeadUnitReal) / (ppProfitPerLeadUnit - nonPPProfitPerLeadUnitReal)) * 100;

  const updateShare = (seg, val) => setShares(s => ({ ...s, [seg]: val }));
  const updatePR = (seg, val) => setPrs(p => ({ ...p, [seg]: val }));
  const resetToday = () => { setTotalLeads(TODAY_TOTAL_LEADS); setShares({ ...TODAY_SHARES }); setPrs({ ...TODAY_PRS }); };
  const normalize = () => {
    if (totalShare === 0) return;
    const ns = {};
    segments.forEach(s => { ns[s] = Math.round((shares[s] / totalShare) * 1000) / 10; });
    setShares(ns);
  };
  const setPreset100PP = () => setShares({ SP: 0, Parts: 0, Priority: 70, Premium: 30, 'No Offers': 0 });

  const totalOk = Math.abs(totalShare - 100) < 0.3;

  return (
    <>
      <div className="alert-box" style={{ marginBottom: 18 }}>
        <b>Measurement + projection, in one tool.</b> Set a lead volume and mix to project units and profit. Below, every channel and theme gets its own leads, segment mix and PR, so each one projects its own units, gross profit and the CPL/CPA it can afford, checked against your Target CPL. P+P% per channel is real data; the rest of each mix and the PRs are today's blend until you edit a card.
      </div>

      <div className="section-label"><span className="dot" />TOTAL LEAD VOLUME<span className="range"> — the base everything else scales from</span></div>
      <div className="panels">
        <div className="panel" style={{ gridColumn: '1 / -1' }}><div className="panel-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ fontFamily: 'var(--font-secondary)', fontWeight: 700, color: 'var(--cb-deep-blue)', fontSize: 13 }}>Total Leads (e.g. a 2027 target)</label>
            <input
              type="number" value={totalLeads} step={1000}
              onChange={e => setTotalLeads(Math.max(0, parseInt(e.target.value) || 0))}
              className="number-input"
            />
            <button className="dl-btn" onClick={resetToday}>↺ Today's Volume &amp; Mix ({fmtNum(TODAY_TOTAL_LEADS)})</button>
            <button className="dl-btn" onClick={setPreset100PP}>⚡ 100% P+P (theoretical)</button>
          </div>
        </div></div>
      </div>

      <div className="section-label"><span className="dot" />SET YOUR MIX — UNITS &amp; PROFIT UPDATE LIVE</div>
      <div className="panels">
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-body">
            <div className="scenario-grid">
              {segments.map(seg => {
                const d = segmentDetail.find(x => x.seg === seg);
                return (
                  <div key={seg} className="scenario-seg-card" style={{ borderLeftColor: SEG_REFERENCE[seg].color }}>
                    <div className="scenario-seg-name">{seg}</div>
                    <Slider label="Share of Leads" value={shares[seg]} onChange={v => updateShare(seg, v)} min={0} max={100} step={0.5} unit="%" />
                    <Slider label="Purchase Rate" value={seg === 'No Offers' ? 0 : prs[seg]} onChange={v => updatePR(seg, v)} min={0} max={15} step={0.1} unit="%" disabled={seg === 'No Offers'} />
                    <div className="scenario-profit-ref">Profit/Unit: <b>{fmtMoney(SEG_REFERENCE[seg].profitUnit)}</b></div>
                    <div className="scenario-predicted">
                      <div><span>Units</span><b>{fmtNum(d.units)}</b></div>
                      <div><span>Profit</span><b>{fmtMoneyK(d.profit)}</b></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`total-share-indicator ${totalOk ? 'ok' : 'warn'}`}>
              Total Share: <b>{totalShare.toFixed(1)}%</b> {totalOk ? '✓' : '— should sum to 100%'}
              {!totalOk && <button className="dl-btn" style={{ marginLeft: 10 }} onClick={normalize}>Normalize to 100%</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="section-label"><span className="dot" />PREDICTED TOTALS AT {fmtNum(totalLeads)} LEADS</div>
      <div className="tiles">
        <StatCard label="Total Units (APC)" value={fmtNum(totalUnits)} sub={`${fmtPct(blendedPR * 100, 2)} blended PR`} />
        <StatCard label="Total Profit" value={fmtMoneyK(totalProfit)} sub="at this mix" />
        <StatCard label="Profit / Lead" value={fmtMoney(profitPerLead)} sub="blended" />
        <StatCard label="Profit / APC" value={profitPerAPC != null ? fmtMoney(profitPerAPC) : '—'} sub="blended" />
      </div>
      <div className="tiles" style={{ marginTop: 10 }}>
        <StatCard label="Breakeven CPL" value={fmtMoney(breakevenCPL)} sub="ROI = 1.0x" />
        <StatCard label="Breakeven CPA" value={breakevenCPA != null ? fmtMoney(breakevenCPA) : '—'} sub="ROI = 1.0x" />
        <StatCard label="Maintain-Efficiency CPL" value={fmtMoney(maintainCPL)} sub={`today's ${EFFICIENCY_RATIO}x ratio`} />
        <StatCard label="Maintain-Efficiency CPA" value={maintainCPA != null ? fmtMoney(maintainCPA) : '—'} sub={`today's ${EFFICIENCY_RATIO}x ratio`} />
      </div>

      <div className="section-label"><span className="dot" />SET A TARGET CPL → MINIMUM P+P% REQUIRED<span className="range"> — reference only; the channel/theme cards below use their own Profit/Lead, not this %</span></div>
      <div className="panels">
        <div className="panel" style={{ gridColumn: '1 / -1' }}><div className="panel-body">
          <Slider label="Target CPL" value={targetCPL} onChange={setTargetCPL} min={1} max={60} step={0.5} unit="" />
          <div className="tiles" style={{ marginTop: 14 }}>
            <StatCard label="Min. P+P% — Breakeven" value={fmtPct(minPPBreakeven, 1)} />
            <StatCard label="Min. P+P% — Maintain Efficiency" value={minPPMaintain > 100 ? 'Not achievable' : fmtPct(minPPMaintain, 1)} />
          </div>
        </div></div>
      </div>

      <ChannelPlan
        title="BY CHANNEL — EACH WITH ITS OWN LEADS, MIX & PR"
        range={`leads split from ${fmtNum(totalLeads)}; mix from each channel's real 2026 P+P%; PR from the segment sliders above until edited`}
        rows={CHANNEL_REALITY} defaults={channelDefaults} overrides={channelOverrides} setOverrides={setChannelOverrides}
        targetCPL={targetCPL}
        note="Default mix comes from each channel's real P+P share of APCs, converted to share of leads. SP/Parts and Priority/Premium splits and PRs per segment are today's blend until we have them per channel — open a card to set them. More P+P in the mix → more profit per lead → a higher CPL/CPA the channel can afford." />

      <ChannelPlan
        title="BY THEME — PAID SEARCH"
        range={`leads split from ~${fmtNum(totalLeads * THEME_LEAD_BASE)} paid-search leads; mix from each theme's real P+P%`}
        rows={THEME_REALITY} defaults={themeDefaults} overrides={themeOverrides} setOverrides={setThemeOverrides}
        targetCPL={targetCPL} />
    </>
  );
}

// ─── Root ────────────────────────────────────────────────
function Dashboard() {
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const cached = window.CarBrainSnapshotData.loadCache();
    if (cached) { setSnap(cached.data); setLoading(false); }
    window.CarBrainSnapshotData.fetchAll()
      .then(data => { setSnap(data); window.CarBrainSnapshotData.saveCache(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (error && !snap) {
    return <div className="error-state">Couldn't load live data: {error}</div>;
  }
  if (!snap) {
    return <div className="loading-state">Loading live snapshot…</div>;
  }

  const asOfLabel = `${snap.asOf.month} ${snap.asOf.day}, ${snap.asOf.year}`;

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'purchase-sales', label: 'Purchase & Sales' },
    { key: 'scenario-predictor', label: 'Scenario Predictor' },
  ];

  return (
    <div className="sheet">
      <header>
        <div className="eyebrow">CAS Automotive</div>
        <img src="logo.png" alt="CarBrain" className="logo-img" />
        <div className="header-row">
          <div className="header-sub">Marketing Snapshot</div>
          <div className="report-date">Live data as of<br /><strong>{asOfLabel}</strong></div>
        </div>
      </header>

      <TabNav tabs={TABS} active={tab} onChange={setTab} />

      <main>
        {tab === 'overview' && <OverviewTab snap={snap} />}
        {tab === 'purchase-sales' && <PurchaseSalesTab />}
        {tab === 'scenario-predictor' && <ScenarioPredictorTab />}
      </main>

      <footer>
        <p><b>Sources:</b> Leads, OA and APC from a live mirror of <i>Data Input _ 2026_CRM_connected.xlsx</i> (SharePoint, Automation site), synced to Google Sheets. Segment measured at moment of conversion, not lead-creation date. SP includes SP Pri. No HubSpot used anywhere in this snapshot.</p>
        <p>* Revenue/ROAS cut two months before the current month (Copart auction lag) — intentional, not missing data.</p>
        <p className="fetch-ts">Live-fetched at {new Date(snap.fetchedAt).toLocaleString('en-US')}. Refreshes every time this page loads.</p>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Dashboard />);
