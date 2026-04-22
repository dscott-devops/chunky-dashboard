import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/v1/health').then(setHealth).catch(() => setHealth({ status: 'error' }));
    api.get('/api/v1/admin/lumps/problems').then(d => setProblems(d.sources || [])).catch(e => setError(e.message));
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
              <thead><tr><th>Source</th><th>Issue</th></tr></thead>
              <tbody>
                {problems.map(s => (
                  <tr key={s.source_id}>
                    <td>{s.title ?? s.source_id}</td>
                    <td>{s.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
    </div>
  );
}
