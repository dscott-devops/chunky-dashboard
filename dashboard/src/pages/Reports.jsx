import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

export default function Reports() {
  const [report, setReport] = useState(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState('');

  const load = (d) =>
    api.get(`/api/v1/admin/lumps/daily-report?days=${d}`)
      .then(r => { debug.page('Reports', r); setReport(r.report ?? null); })
      .catch(e => { debug.error('Reports load', e); setError(e.message); });

  useEffect(() => { debug.page('Reports mount', { days }); load(days); }, [days]);

  const sources = report?.sources || [];

  return (
    <div className="page">
      <h2>Daily Report</h2>
      {error && <p className="error">{error}</p>}

      <div className="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 13 }}>
          Window:&nbsp;
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={1}>Yesterday</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        {report?.window && (
          <span className="muted">{report.window.start_day} → {report.window.end_day}</span>
        )}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Category</th>
            <th>Yesterday</th>
            <th>7-day</th>
            <th>Window</th>
            <th>Flags</th>
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
                {s.flags?.low_1d && <span className="badge" style={{background:'rgba(248,113,113,0.15)',color:'#f87171'}}>low_1d</span>}
                {s.flags?.low_7d_avg && <span className="badge" style={{background:'rgba(251,191,36,0.15)',color:'#fbbf24',marginLeft:4}}>low_7d</span>}
              </td>
            </tr>
          ))}
          {sources.length === 0 && (
            <tr><td colSpan={6} className="muted">No data for this window.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
