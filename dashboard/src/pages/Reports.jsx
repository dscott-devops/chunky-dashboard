import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

function StatBox({ label, value, sub }) {
  return (
    <div className="card" style={{ textAlign:'center', padding:'14px 10px', marginBottom:0 }}>
      <div style={{ fontSize:'22px', fontWeight:700, color:'var(--heading)' }}>{value ?? '—'}</div>
      <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>{label}</div>
      {sub && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{sub}</div>}
    </div>
  );
}

export default function Reports() {
  const [report, setReport]       = useState(null);
  const [days, setDays]           = useState(7);
  const [validation, setValidation] = useState(null);
  const [error, setError]         = useState('');

  const load = (d) =>
    api.get(`/api/v1/admin/lumps/daily-report?days=${d}`)
      .then(r => { debug.page('Reports', r); setReport(r.report ?? null); })
      .catch(e => { debug.error('Reports load', e); setError(e.message); });

  const loadValidation = () =>
    api.get('/api/v1/admin/lumps/validation-summary')
      .then(r => { debug.page('Validation', r); setValidation(r.report ?? null); })
      .catch(e => debug.error('Validation load', e));

  useEffect(() => { debug.page('Reports mount', { days }); load(days); loadValidation(); }, [days]);

  const sources = report?.sources || [];
  const ov = validation?.overview;

  return (
    <div className="page">
      <h2>Reports</h2>
      {error && <p className="error">{error}</p>}

      {/* ── Validation summary ── */}
      {validation && (
        <>
          <h3 style={{ color:'var(--heading)', fontSize:'16px', marginBottom:'12px' }}>Content Validation</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
            <StatBox label="Total Lumps"  value={ov?.total_lumps?.toLocaleString()} />
            <StatBox label="Validated"    value={ov?.total_validated?.toLocaleString()} sub={`${ov?.coverage_pct ?? 0}% coverage`} />
            <StatBox label="Suspect"      value={ov?.status_counts?.suspect?.toLocaleString()} sub={`${ov?.suspect_pct ?? 0}%`} />
            <StatBox label="Dead"         value={ov?.status_counts?.dead?.toLocaleString()} />
          </div>

          {/* Top failing domains */}
          {validation.top_failing_domains?.length > 0 && (
            <div className="card" style={{ marginBottom:'24px' }}>
              <h3>Top Failing Domains</h3>
              <table className="data-table">
                <thead>
                  <tr><th>Domain</th><th>Failures</th><th>Top Reason</th></tr>
                </thead>
                <tbody>
                  {validation.top_failing_domains.map(d => (
                    <tr key={d.domain}>
                      <td>{d.domain}</td>
                      <td>{d.failure_count}</td>
                      <td><span className="badge">{d.top_reason ?? '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Daily report ── */}
      <h3 style={{ color:'var(--heading)', fontSize:'16px', marginBottom:'12px' }}>Daily Source Report</h3>
      <div className="toolbar" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <label style={{ fontSize:13 }}>
          Window:&nbsp;
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ width:'auto' }}>
            <option value={1}>Yesterday</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        {report?.window && (
          <span className="muted">{report.window.start_day?.slice(0,10)} → {report.window.end_day?.slice(0,10)}</span>
        )}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Source</th><th>Category</th><th>Yesterday</th><th>7-day</th><th>Window</th><th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(s => (
            <tr key={s.source_id}>
              <td>{s.source_title ?? s.source_id}</td>
              <td><span className="badge">{s.category ?? s.league ?? '—'}</span></td>
              <td>{s.counts?.d1 ?? '—'}</td>
              <td>{s.counts?.d7 ?? '—'}</td>
              <td>{s.counts?.d_window ?? '—'}</td>
              <td>
                {s.flags?.low_1d     && <span className="badge" style={{ background:'rgba(248,113,113,0.15)', color:'var(--red)' }}>low_1d</span>}
                {s.flags?.low_7d_avg && <span className="badge" style={{ background:'rgba(251,191,36,0.15)', color:'var(--yellow)', marginLeft:4 }}>low_7d</span>}
              </td>
            </tr>
          ))}
          {sources.length === 0 && (
            <tr><td colSpan={6} className="muted" style={{ padding:'12px 10px' }}>No data for this window.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
