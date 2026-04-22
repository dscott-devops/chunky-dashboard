import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = (q = '') =>
    api.get(`/api/v1/admin/users?q=${encodeURIComponent(q)}`).then(d => setUsers(d.users || [])).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

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

      <table className="data-table">
        <thead>
          <tr><th>Email</th><th>Role</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td><span className="badge">{u.role}</span></td>
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
