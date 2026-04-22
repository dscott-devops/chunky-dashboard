import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '', totp_code: '', env: 'prod' });
  const [step, setStep] = useState('credentials'); // 'credentials' | 'totp' | 'enroll'
  const [enrollUri, setEnrollUri] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.action === 'enroll') {
        setEnrollUri(data.totp_uri);
        setStep('enroll');
        setLoading(false);
        return;
      }
      if (data.action === 'totp' || data.code === 'TOTP_REQUIRED') {
        setStep('totp');
        setLoading(false);
        return;
      }
      if (!data.ok) {
        setError(data.message || data.code || 'Login failed');
        setLoading(false);
        return;
      }

      login(data);
      navigate('/dashboard');
    } catch {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Chunky Sports Admin</h1>

        {step === 'enroll' && (
          <div className="enroll-info">
            <p>Scan this QR code in Google Authenticator, then enter the 6-digit code below.</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollUri)}`}
              alt="TOTP QR code"
              width={200}
              height={200}
            />
            <p className="uri-text">{enrollUri}</p>
          </div>
        )}

        <form onSubmit={submit}>
          {step === 'credentials' && (
            <>
              <label>
                Email
                <input type="email" value={form.email} onChange={set('email')} required autoFocus />
              </label>
              <label>
                Password
                <input type="password" value={form.password} onChange={set('password')} required />
              </label>
              <label>
                Environment
                <select value={form.env} onChange={set('env')}>
                  <option value="prod">Production</option>
                  <option value="dev">Development</option>
                </select>
              </label>
            </>
          )}

          {(step === 'totp' || step === 'enroll') && (
            <label>
              6-digit code
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={form.totp_code}
                onChange={set('totp_code')}
                required
                autoFocus
                placeholder="000000"
              />
            </label>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : step === 'credentials' ? 'Continue' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}
