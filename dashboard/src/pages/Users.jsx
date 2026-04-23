import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

const EDITABLE = ['firstname', 'lastname', 'email', 'username', 'displayname', 'slogan', 'bio', 'mobile'];

function Field({ label, value, onChange }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:'3px', marginBottom:'10px' }}>
      <span style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
      <input value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export default function Users() {
  const [users, setUsers]           = useState([]);
  const [search, setSearch]         = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail]         = useState(null);
  const [form, setForm]             = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [resettingTeams, setResettingTeams] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw]           = useState('');
  const [savingPw, setSavingPw]     = useState(false);
  const [error, setError]           = useState('');
  const [msg, setMsg]               = useState('');

  const load = useCallback((q = '') =>
    api.get(`/api/v1/admin/users?q=${encodeURIComponent(q)}`)
      .then(d => { debug.page('Users', d); setUsers(d.users || []); })
      .catch(e => { debug.error('Users load', e); setError(e.message); }),
  []);

  useEffect(() => { debug.page('Users mount'); load(); }, [load]);

  const selectUser = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setForm({});
    setError('');
    setMsg('');
    setShowPwForm(false);
    setNewPw('');
    setDetailLoading(true);
    try {
      const d = await api.get(`/api/v1/admin/users/${id}?type=full`);
      debug.page('User detail', d);
      setDetail(d.user);
      setForm(d.user);
    } catch (e) {
      debug.error('User detail', e);
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const saveChanges = async () => {
    setError(''); setMsg('');
    const patch = {};
    for (const k of [...EDITABLE, 'admin', 'active']) {
      if (form[k] !== detail[k]) patch[k] = form[k];
    }
    if (!Object.keys(patch).length) { setMsg('No changes to save.'); return; }
    setSaving(true);
    try {
      const d = await api.patch(`/api/v1/admin/users/${selectedId}`, patch);
      setDetail(d.user); setForm(d.user);
      setMsg('Saved.');
      setUsers(prev => prev.map(u => u.id === selectedId ? { ...u, ...d.user } : u));
    } catch (e) {
      debug.error('Save user', e); setError(e.message);
    } finally { setSaving(false); }
  };

  const resetTeams = async () => {
    if (!window.confirm(`Remove all team follows for ${detail.email}?\nOnly their favorite team (${detail.favorite_name || 'none'}) will be kept.`)) return;
    setResettingTeams(true); setError(''); setMsg('');
    try {
      const d = await api.post(`/api/v1/admin/users/${selectedId}/reset-teams`, {});
      setMsg(d.message);
      const fresh = await api.get(`/api/v1/admin/users/${selectedId}?type=full`);
      setDetail(fresh.user); setForm(fresh.user);
    } catch (e) {
      debug.error('Reset teams', e); setError(e.message);
    } finally { setResettingTeams(false); }
  };

  const submitPw = async () => {
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSavingPw(true); setError('');
    try {
      await api.post(`/api/v1/admin/users/${selectedId}/password`, { password: newPw });
      setMsg(`Password updated for ${detail.email}.`);
      setShowPwForm(false); setNewPw('');
    } catch (e) {
      debug.error('Reset password', e); setError(e.message);
    } finally { setSavingPw(false); }
  };

  return (
    <div className="two-col" style={{ alignItems:'flex-start' }}>

      {/* ── Left: user list ── */}
      <div className="col-left">
        <h2 style={{ color:'var(--heading)', fontSize:'20px', marginBottom:'16px' }}>Users</h2>
        <div className="search-bar">
          <input
            placeholder="Search users…"
            value={search}
            onChange={e => { setSearch(e.target.value); load(e.target.value); }}
          />
        </div>
        <ul className="item-list">
          {users.map(u => (
            <li key={u.id} className={selectedId === u.id ? 'selected' : ''} onClick={() => selectUser(u.id)}>
              <span>{[u.firstname, u.lastname].filter(Boolean).join(' ') || u.email}</span>
              {u.admin && <span className="badge green">admin</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Right: detail panel ── */}
      <div className="col-right">
        {!selectedId && <p className="muted">Select a user to view their profile.</p>}
        {selectedId && detailLoading && <p className="muted">Loading…</p>}

        {selectedId && !detailLoading && detail && (
          <>
            <h3>{[detail.firstname, detail.lastname].filter(Boolean).join(' ') || detail.email}</h3>
            <p className="muted" style={{ marginBottom:'16px', fontSize:'12px' }}>
              ID {detail.id} · joined {detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '—'}
            </p>

            {error && <p className="error">{error}</p>}
            {msg   && <p className="success">{msg}</p>}

            {/* Profile fields */}
            <h4>Profile</h4>
            <Field label="First name"    value={form.firstname}   onChange={set('firstname')} />
            <Field label="Last name"     value={form.lastname}    onChange={set('lastname')} />
            <Field label="Email"         value={form.email}       onChange={set('email')} />
            <Field label="Username"      value={form.username}    onChange={set('username')} />
            <Field label="Display name"  value={form.displayname} onChange={set('displayname')} />
            <Field label="Slogan"        value={form.slogan}      onChange={set('slogan')} />
            <Field label="Bio"           value={form.bio}         onChange={set('bio')} />
            <Field label="Mobile"        value={form.mobile}      onChange={set('mobile')} />

            {/* Account flags */}
            <h4>Account</h4>
            <div style={{ display:'flex', gap:'20px', marginBottom:'16px' }}>
              <label style={{ display:'flex', gap:'6px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}>
                <input type="checkbox" checked={!!form.admin}  onChange={e => setForm(f => ({ ...f, admin:  e.target.checked }))} />
                Admin
              </label>
              <label style={{ display:'flex', gap:'6px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}>
                <input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
            </div>

            <button onClick={saveChanges} disabled={saving} style={{ marginBottom:'24px' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {/* Teams */}
            <h4>Teams</h4>
            <p className="muted" style={{ marginBottom:'6px' }}>
              Following {detail.team_count ?? '?'} team{detail.team_count !== 1 ? 's' : ''} · Favorite: <strong style={{ color:'var(--text)' }}>{detail.favorite_name || '—'}</strong>
            </p>
            <button className="btn-danger" onClick={resetTeams} disabled={resettingTeams} style={{ marginBottom:'24px' }}>
              {resettingTeams ? 'Resetting…' : 'Reset Teams'}
            </button>

            {/* Password */}
            <h4>Password</h4>
            {!showPwForm && (
              <button className="btn-sm" onClick={() => { setShowPwForm(true); setError(''); setMsg(''); }}>
                Set Password
              </button>
            )}
            {showPwForm && (
              <div className="inline-form" style={{ marginBottom:0 }}>
                <input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitPw()}
                  autoFocus
                />
                <button onClick={submitPw} disabled={savingPw}>
                  {savingPw ? 'Saving…' : 'Set Password'}
                </button>
                <button className="btn-sm" onClick={() => { setShowPwForm(false); setNewPw(''); }}>Cancel</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
