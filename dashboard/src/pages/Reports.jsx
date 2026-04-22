import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Reports() {
  const [report, setReport] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  const load = (d) =>
    api.get(`/api/v1/admin/lumps/daily-report?date=${d}`).then(r => setReport(r.rows || [])).catch(e => setError(e.message));

  useEffect(() => { load(date); }, [date]);

  return (
    <div className="page">
      <h2>Daily Report</h2>
      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Source</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr>
        </thead>
        <tbody>
          {report.map(r => (
            <tr key={r.source_id}>
              <td>{r.title ?? r.source_id}</td>
              <td>{r.impressions?.toLocaleString()}</td>
              <td>{r.clicks?.toLocaleString()}</td>
              <td>{r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(2) + '%' : '—'}</td>
            </tr>
          ))}
          {report.length === 0 && <tr><td colSpan={4} className="muted">No data for this date.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
