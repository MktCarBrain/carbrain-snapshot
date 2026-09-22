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

function Dashboard() {
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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

      <main>
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
