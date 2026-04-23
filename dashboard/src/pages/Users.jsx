import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [resetTarget, setResetTarget] = useState(null); // { id, email }
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = (q = '') =>
    api.get(`/api/v1/admin/users?q=${encodeURIComponent(q)}`).then(d => { debug.page('Users', d); setUsers(d.users || []); }).catch(e => { debug.error('Users load', e); setError(e.message); });

  useEffect(() => { debug.page('Users mount'); load(); }, []);

  const startReset = (u) => {
    setResetTarget({ id: u.id, email: u.email });
    setNewPassword('');
    setError('');
    setMsg('');
  };

  const cancelReset = () => { setResetTarget(null); setNewPassword(''); };

  const submitReset = async () => {
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setResetting(true);
    try {
      await api.post(`/api/v1/admin/users/${resetTarget.id}/password`, { password: newPassword });
      setMsg(`Password updated for ${resetTarget.email}.`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      debug.error('Reset password', err);
      setError(err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="page">
      <h2>Users</h2>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      {resetTarget && (
        <div className="card" style={{marginBottom:'16px'}}>
          <h3>Reset password for {resetTarget.email}</h3>
          <div className="inline-form" style={{marginBottom:0}}>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitReset()}
              autoFocus
            />
            <button onClick={submitReset} disabled={resetting}>
              {resetting ? 'Saving…' : 'Set Password'}
            </button>
            <button className="btn-sm" onClick={cancelReset}>Cancel</button>
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          placeholder="Search users…"
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }}
        />
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Admin</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{[u.firstname, u.lastname].filter(Boolean).join(' ') || '—'}</td>
              <td>{u.email}</td>
              <td>{u.admin ? <span className="badge green">admin</span> : <span className="badge">user</span>}</td>
              <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
              <td>
                <button className="btn-sm" onClick={() => startReset(u)}>Reset PW</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
