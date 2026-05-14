import { useState } from 'react';
import { api } from '../api.js';
import { debug } from '../debug.js';

export default function Push() {
  const [title, setTitle]   = useState('');
  const [body, setBody]     = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { sent, errors }
  const [error, setError]   = useState('');

  const send = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!window.confirm(`Send push notification to all active users?\n\nTitle: ${title}${body ? `\nBody: ${body}` : ''}`)) return;
    setSending(true); setError(''); setResult(null);
    try {
      const d = await api.post('/api/v1/admin/push/trending', {
        title: title.trim(),
        body:  body.trim() || undefined,
      });
      debug.page('Push result', d);
      setResult(d);
      setTitle('');
      setBody('');
    } catch (e) {
      debug.error('Push send', e);
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <h2>Push Notifications</h2>
      <p className="muted" style={{ marginBottom:'24px' }}>Sends to all active users with registered device tokens.</p>

      {error  && <p className="error">{error}</p>}
      {result && (
        <div className="card" style={{ marginBottom:'16px', borderColor:'rgba(74,222,128,0.3)' }}>
          <p style={{ fontSize:'14px', color:'var(--green)', fontWeight:600, marginBottom:'4px' }}>Notification sent</p>
          <p className="muted">
            {result.sent} device{result.sent !== 1 ? 's' : ''} reached
            {result.errors > 0 && <span style={{ color:'var(--red)', marginLeft:'8px' }}>{result.errors} error{result.errors !== 1 ? 's' : ''}</span>}
          </p>
        </div>
      )}

      <div className="col-left" style={{ width:'100%', maxWidth:'480px' }}>
        <label style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'14px' }}>
          <span style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Title *</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Notification title…"
            maxLength={100}
          />
        </label>

        <label style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'20px' }}>
          <span style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Body (optional)</span>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Notification body…"
            maxLength={200}
            rows={3}
            style={{ resize:'vertical', font:'inherit', borderRadius:'6px', border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', padding:'7px 11px' }}
          />
        </label>

        <button onClick={send} disabled={sending || !title.trim()}>
          {sending ? 'Sending…' : 'Send to All Users'}
        </button>
      </div>
    </div>
  );
}
