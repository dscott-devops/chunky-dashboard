import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ads, setAds] = useState([]);
  const [targets, setTargets] = useState([]);
  const [allAds, setAllAds] = useState([]);
  const [sourceQ, setSourceQ] = useState('');
  const [sourceResults, setSourceResults] = useState([]);
  const [newCampaign, setNewCampaign] = useState({ name: '', mode: 'priority' });
  const [error, setError] = useState('');

  const load = () => api.get('/api/v1/admin/ads/campaigns').then(d => { debug.page('Campaigns', d); setCampaigns(d.campaigns || []); });
  useEffect(() => {
    debug.page('Campaigns mount');
    load();
    api.get('/api/v1/admin/ads').then(d => { debug.page('Campaigns allAds', d); setAllAds(d.ads || []); });
  }, []);

  const selectCampaign = async (c) => {
    setSelected(c);
    const [adsData, tgtsData] = await Promise.all([
      api.get(`/api/v1/admin/ads/campaigns/${c.id}/ads`),
      api.get(`/api/v1/admin/ads/campaigns/${c.id}/targets`),
    ]);
    setAds(adsData.ads || []);
    setTargets(tgtsData.targets || []);
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/admin/ads/campaigns', newCampaign);
      setNewCampaign({ name: '', mode: 'priority' });
      load();
    } catch (err) { setError(err.message); }
  };

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    await api.delete(`/api/v1/admin/ads/campaigns/${id}`);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const assignAd = async (adId) => {
    await api.post(`/api/v1/admin/ads/campaigns/${selected.id}/ads`, { ad_id: adId });
    selectCampaign(selected);
  };

  const removeAd = async (adId) => {
    await api.delete(`/api/v1/admin/ads/campaigns/${selected.id}/ads/${adId}`);
    selectCampaign(selected);
  };

  const toggleAdActive = async (adId, current) => {
    await api.patch(`/api/v1/admin/ads/campaigns/${selected.id}/ads/${adId}`, { active: !current });
    selectCampaign(selected);
  };

  const searchSources = async (q) => {
    setSourceQ(q);
    if (q.length < 2) { setSourceResults([]); return; }
    const d = await api.get(`/api/v1/admin/sources?q=${encodeURIComponent(q)}&limit=10`);
    setSourceResults(d.sources || []);
  };

  const addSourceTarget = async (sourceId) => {
    await api.post(`/api/v1/admin/ads/campaigns/${selected.id}/targets`, { source_id: sourceId });
    setSourceQ(''); setSourceResults([]);
    selectCampaign(selected);
  };

  const removeTarget = async (targetId) => {
    await api.delete(`/api/v1/admin/ads/campaigns/${selected.id}/targets/${targetId}`);
    selectCampaign(selected);
  };

  const assignedAdIds = new Set(ads.map(a => a.ad_id ?? a.id));

  return (
    <div className="page two-col">
      <div className="col-left">
        <h2>Campaigns</h2>
        {error && <p className="error">{error}</p>}

        <form onSubmit={createCampaign} className="inline-form">
          <input placeholder="Campaign name" value={newCampaign.name}
            onChange={e => setNewCampaign(f => ({ ...f, name: e.target.value }))} required />
          <select value={newCampaign.mode} onChange={e => setNewCampaign(f => ({ ...f, mode: e.target.value }))}>
            <option value="priority">Priority</option>
            <option value="round_robin">Round Robin</option>
          </select>
          <button type="submit">Add</button>
        </form>

        <ul className="item-list">
          {campaigns.map(c => (
            <li key={c.id} className={selected?.id === c.id ? 'selected' : ''} onClick={() => selectCampaign(c)}>
              <span>{c.name}</span>
              <span className="badge">{c.mode}</span>
              <button className="btn-danger sm" onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}>✕</button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="col-right">
          <h3>{selected.name}</h3>

          <section>
            <h4>Targets</h4>
            <div className="source-search">
              <input placeholder="Search sources…" value={sourceQ} onChange={e => searchSources(e.target.value)} />
              {sourceResults.length > 0 && (
                <ul className="dropdown">
                  {sourceResults.map(s => (
                    <li key={s.id} onClick={() => addSourceTarget(s.id)}>{s.title} <span className="badge">{s.category}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="item-list sm">
              {targets.map(t => (
                <li key={t.id}>
                  {t.source_id ? <span>Source: {t.source_id}</span> : <span>Category: {t.category}</span>}
                  <button className="btn-danger sm" onClick={() => removeTarget(t.id)}>✕</button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4>Assigned Ads</h4>
            <ul className="item-list sm">
              {ads.map(a => (
                <li key={a.ad_id ?? a.id}>
                  <span>{a.name ?? a.ad_id}</span>
                  <span className={`badge ${a.assignment_active ? 'green' : 'grey'}`}>
                    {a.assignment_active ? 'active' : 'inactive'}
                  </span>
                  <button className="btn-sm" onClick={() => toggleAdActive(a.ad_id ?? a.id, a.assignment_active)}>
                    Toggle
                  </button>
                  <button className="btn-danger sm" onClick={() => removeAd(a.ad_id ?? a.id)}>✕</button>
                </li>
              ))}
            </ul>

            <details>
              <summary>Assign ad</summary>
              <ul className="item-list sm">
                {allAds.filter(a => !assignedAdIds.has(a.id)).map(a => (
                  <li key={a.id}>
                    <span>{a.name}</span>
                    <span className="badge">{a.kind}</span>
                    <button className="btn-sm" onClick={() => assignAd(a.id)}>Assign</button>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </div>
      )}
    </div>
  );
}
