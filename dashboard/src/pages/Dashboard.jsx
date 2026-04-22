import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    debug.page('Dashboard');
    api.get('/api/v1/admin/health')
      .then(d => { debug.page('Dashboard', { health: d }); setHealth(d.echo ?? d); })
      .catch(err => { debug.error('Dashboard health', err); setHealth({ status: 'error' }); });
    api.get('/api/v1/admin/lumps/problems')
      .then(d => { debug.page('Dashboard problems', d); setProblems(d.report?.sources || []); })
      .catch(e => { debug.error('Dashboard problems', e); setError(e.message); });
  }, []);

  return (
    <div className="page">
      <h2>Dashboard</h2>

      <section className="card">
        <h3>API Health</h3>
        {health
          ? <p className={`status-dot ${health.status === 'ok' ? 'green' : 'red'}`}>{health.status}</p>
          : <p>Loading…</p>}
      </section>

      <section className="card">
        <h3>Problem Sources</h3>
        {error && <p className="error">{error}</p>}
        {problems.length === 0
          ? <p className="muted">No problem sources.</p>
          : (
            <table>
              <thead><tr><th>Source</th><th>Yesterday</th><th>7-day avg</th><th>Flags</th></tr></thead>
              <tbody>
                {problems.map(s => (
                  <tr key={s.source_id}>
                    <td>{s.source_title ?? s.source_id}</td>
                    <td>{s.counts?.d1 ?? '—'}</td>
                    <td>{s.counts?.avg_7d != null ? Number(s.counts.avg_7d).toFixed(1) : '—'}</td>
                    <td>
                      {s.flags?.low_1d && <span className="badge" style={{background:'rgba(248,113,113,0.15)',color:'#f87171'}}>low_1d</span>}
                      {s.flags?.low_7d_avg && <span className="badge" style={{background:'rgba(251,191,36,0.15)',color:'#fbbf24',marginLeft:4}}>low_7d</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
    </div>
  );
}
