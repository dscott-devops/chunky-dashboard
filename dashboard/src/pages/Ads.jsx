import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Ads() {
  const [ads, setAds] = useState([]);
  const [form, setForm] = useState({ name: '', kind: 'native', target_url: '' });
  const [error, setError] = useState('');

  const load = () => api.get('/api/v1/admin/ads').then(d => setAds(d.ads || [])).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    try { await api.post('/api/v1/admin/ads', form); setForm({ name: '', kind: 'native', target_url: '' }); load(); }
    catch (err) { setError(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this ad?')) return;
    await api.delete(`/api/v1/admin/ads/${id}`);
    load();
  };

  return (
    <div className="page">
      <h2>Ads</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={create} className="inline-form">
        <input placeholder="Ad name" value={form.name} onChange={set('name')} required />
        <select value={form.kind} onChange={set('kind')}>
          <option value="native">Native</option>
          <option value="carousel">Carousel</option>
          <option value="affiliate">Affiliate</option>
        </select>
        <input placeholder="Target URL" value={form.target_url} onChange={set('target_url')} />
        <button type="submit">Add</button>
      </form>

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Kind</th><th>Target URL</th><th></th></tr>
        </thead>
        <tbody>
          {ads.map(a => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td><span className="badge">{a.kind}</span></td>
              <td className="truncate">{a.target_url}</td>
              <td><button className="btn-danger sm" onClick={() => remove(a.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
