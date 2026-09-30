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
              <div className="note">Last complete Mon–Wed vs the same three days one week earlier — catches conversions that lag past the full-week cutoff above.</div>
              <div style={{ marginTop: 8 }}><SegTable title="Offer Accepted" prev={snap.monWedComparison.oa.prev} curr={snap.monWedComparison.oa.curr} prevLabel={snap.monWedComparison.label.prev} currLabel={snap.monWedComparison.label.curr} pctDelta={pctDelta} /></div>
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

  const segCols = [
    { label: 'Segment', get: ([n]) => n },
    { label: '# Purchased', get: ([, k]) => fmtNum(k.nPurchased) },
    { label: 'Avg Cost', get: ([, k]) => fmtMoney(k.avgCost) },
    { label: '# Sold', get: ([, k]) => fmtNum(k.nSold) },
    { label: 'Avg Sale', get: ([, k]) => fmtMoney(k.avgSale) },
    { label: 'Gross Margin', get: ([, k]) => (k.margin != null ? fmtPct(k.margin, 1) : '—') },
  ];

  return (
    <>
      {!data.isLive && (
        <div className="alert-box" style={{ marginBottom: 18 }}>
          <b>Manual, per-report refresh:</b> populated from {data.sourceNote} As of {data.asOf}. Update <code>purchase-sales-data.jsx</code> when the next report lands — same pattern as GA4/Google Ads today.
        </div>
      )}

      <div className="section-label"><span className="dot" />PURCHASE &amp; SALES<span className="range"> — Parts + Priority + Premium, {data.asOf}</span></div>

      <div className="tiles">
        <StatCard label="# Purchased" value={fmtNum(o.nPurchased)} sub={data.asOf} />
        <StatCard label="Average Cost" value={fmtMoney(o.avgCost)} sub="per vehicle" />
        <StatCard label="High Price" value={fmtMoney(o.highPrice)} sub="single purchase" />
        <StatCard label="Low Price" value={fmtMoney(o.lowPrice)} sub="single purchase" />
      </div>
      <div className="tiles" style={{ marginTop: 10 }}>
        <StatCard label="# Sold" value={fmtNum(o.nSold)} sub={`${fmtPct((o.nSold / o.nPurchased) * 100, 0)} of purchased`} />
        <StatCard label="Average Sale Price" value={fmtMoney(o.avgSale)} sub="per vehicle" />
        <StatCard label="High Sale" value={fmtMoney(o.highSale)} sub="single sale" />
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
