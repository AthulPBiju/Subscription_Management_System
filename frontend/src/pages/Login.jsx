import React, { useState } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(`${BASE_URL}/auth/register`, { name, email, password });
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Password must be 9+ chars with uppercase, lowercase, and a special character.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 68 }}>
            <div style={{
              width: 36, height: 36, background: '#6c83f5', borderRadius: 10,
              display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 22,
              fontFamily: 'Manrope', color: 'white',
            }}>b</div>
            <div>
              <b style={{ display: 'block', fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>brightloop</b>
              <small style={{ fontSize: 8, letterSpacing: '1.5px', color: '#8e99aa' }}>SUBSCRIPTION OS</small>
            </div>
          </div>
        </div>

        <div className="login-copy">
          <div className="eyebrow">{tab === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</div>
          <h1>{tab === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h1>
          <p>
            {tab === 'login'
              ? 'Enter your credentials to access the subscription management dashboard.'
              : 'Register as a customer to manage your subscriptions and invoices.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e5eaf1' }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            style={{
              border: 0, background: 'none', padding: '0 2px 12px', marginRight: 20,
              color: tab === 'login' ? '#4e68d5' : '#8994a6',
              fontSize: 11, cursor: 'pointer', fontWeight: tab === 'login' ? 700 : 400,
              borderBottom: tab === 'login' ? '2px solid #5c75e2' : '2px solid transparent',
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            style={{
              border: 0, background: 'none', padding: '0 2px 12px',
              color: tab === 'register' ? '#4e68d5' : '#8994a6',
              fontSize: 11, cursor: 'pointer', fontWeight: tab === 'register' ? 700 : 400,
              borderBottom: tab === 'register' ? '2px solid #5c75e2' : '2px solid transparent',
            }}
          >
            Register
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 9 }}>
            <label style={{ fontSize: 10, color: '#59677d', fontWeight: 600, marginTop: 5 }}>Email address</label>
            <input
              type="email"
              required
              placeholder="admin@brightloop.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ padding: 12 }}
            />
            <label style={{ fontSize: 10, color: '#59677d', fontWeight: 600, marginTop: 5 }}>Password</label>
            <input
              type="password"
              required
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ padding: 12 }}
            />
            {error && <div className="error">{error}</div>}
            <button className="primary full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to workspace'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'grid', gap: 9 }}>
            <label style={{ fontSize: 10, color: '#59677d', fontWeight: 600, marginTop: 5 }}>Full name</label>
            <input
              required
              placeholder="Your full name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ padding: 12 }}
            />
            <label style={{ fontSize: 10, color: '#59677d', fontWeight: 600, marginTop: 5 }}>Email address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ padding: 12 }}
            />
            <label style={{ fontSize: 10, color: '#59677d', fontWeight: 600, marginTop: 5 }}>Password</label>
            <input
              type="password"
              required
              placeholder="Min 9 chars, uppercase, lowercase, symbol"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ padding: 12 }}
            />
            {error && <div className="error">{error}</div>}
            <button className="primary full" disabled={busy}>
              {busy ? 'Creating account…' : 'Create customer account'}
            </button>
          </form>
        )}

        <div className="demo-hint" style={{ marginTop: 20 }}>
          Demo admin: admin@brightloop.com · Brightloop@123
        </div>
      </div>

      <div className="login-art">
        <div className="orb" />
        <div className="orb orb2" />
        <div className="art-card">
          <div className="eyebrow">SUBSCRIPTION INTELLIGENCE</div>
          <h2>Revenue. Renewals. Relationships.</h2>
          <p style={{ fontSize: 11, color: '#aab9db', marginTop: 6 }}>
            Brightloop unifies your entire recurring revenue stack — from first quote to renewal automation.
          </p>
          <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Manrope', color: '#7ce0b7' }}>₹2.4M</div>
              <div style={{ fontSize: 9, color: '#aab9db', marginTop: 2 }}>Annual Recurring Revenue</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Manrope', color: '#fff' }}>98.2%</div>
              <div style={{ fontSize: 9, color: '#aab9db', marginTop: 2 }}>Renewal Rate</div>
            </div>
          </div>
          <div className="fake-bars">
            <i style={{ height: '45%' }} />
            <i style={{ height: '65%' }} />
            <i style={{ height: '55%' }} />
            <i style={{ height: '80%' }} />
            <i style={{ height: '70%' }} />
            <i style={{ height: '95%' }} />
          </div>
        </div>
        <div className="art-caption">Trusted by subscription-first businesses.</div>
      </div>
    </div>
  );
}
