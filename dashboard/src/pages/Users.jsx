import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = (q = '') =>
    api.get(`/api/v1/admin/users?q=${encodeURIComponent(q)}`).then(d => { debug.page('Users', d); setUsers(d.users || []); }).catch(e => { debug.error('Users load', e); setError(e.message); });

  useEffect(() => { debug.page('Users mount'); load(); }, []);

  const resetPassword = async (id) => {
    try {
      await api.post(`/api/v1/admin/users/${id}/reset-password`, {});
      setMsg('Password reset email sent.');
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="page">
      <h2>Users</h2>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="search-bar">
        <input
          placeholder="Search users…"
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }}
        />
      </div>

      <p className="muted" style={{marginBottom:'8px'}}>Loaded {users.length} user(s)</p>

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
                <button className="btn-sm" onClick={() => resetPassword(u.id)}>Reset PW</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
