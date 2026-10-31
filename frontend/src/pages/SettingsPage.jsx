import React, { useState, useEffect } from 'react';
import { Building2, ShieldCheck, UserPlus, CheckCircle2, Save, History, RefreshCw } from 'lucide-react';
import api from '../api';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import Field from '../components/Field';

const dateFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function SettingsPage({ user }) {
  const [openStaffModal, setOpenStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('workspace');

  // Business settings state
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    company_name: '',
    support_email: '',
    currency: 'INR',
    tax_id: '',
    invoice_prefix: 'INV',
    address: '',
    logo_url: '',
    website: '',
  });
  const [settingsBusy, setSettingsBusy] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      setSettingsForm({
        company_name: res.data.company_name || '',
        support_email: res.data.support_email || '',
        currency: res.data.currency || 'INR',
        tax_id: res.data.tax_id || '',
        invoice_prefix: res.data.invoice_prefix || 'INV',
        address: res.data.address || '',
        logo_url: res.data.logo_url || '',
        website: res.data.website || '',
      });
    } catch {
      // Settings might not be accessible to non-admin — silently skip
    }
  }

  async function loadAuditLogs() {
    setAuditLoading(true);
    try {
      const res = await api.get('/audit?limit=50');
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsBusy(true);
    setMsg('');
    setError('');
    try {
      await api.patch('/settings', settingsForm);
      setMsg('Business settings updated successfully.');
      loadSettings();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const res = await api.post('/auth/staff', staffForm);
      setMsg(`Staff account for ${res.data.name} created successfully.`);
      setOpenStaffModal(false);
      setStaffForm({ name: '', email: '', password: '' });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Failed to create staff account. Password must have uppercase, lowercase, special character and >8 chars.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="WORKSPACE PREFERENCES"
        title="Settings"
        desc="System configuration, business settings, team management, and audit log."
        action={
          user?.role === 'admin' ? (
            <button className="primary" onClick={() => setOpenStaffModal(true)}>
              <UserPlus size={16} /> Add staff member
            </button>
          ) : null
        }
      />

      {msg && (
        <div className="notice">
          {msg}
          <button onClick={() => setMsg('')}>×</button>
        </div>
      )}
      {error && (
        <div className="notice notice-error">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="tabs">
        <button className={activeTab === 'workspace' ? 'selected' : ''} onClick={() => setActiveTab('workspace')}>
          Workspace
        </button>
        {user?.role === 'admin' && (
          <button className={activeTab === 'business' ? 'selected' : ''} onClick={() => setActiveTab('business')}>
            Business settings
          </button>
        )}
        {user?.role === 'admin' && (
          <button className={activeTab === 'audit' ? 'selected' : ''} onClick={() => setActiveTab('audit')}>
            Audit log
          </button>
        )}
      </div>

      {activeTab === 'workspace' && (
        <div className="panel settings-panel">
          <div className="settings-icon">
            <Building2 />
          </div>
          <div>
            <h3>{settings?.company_name || 'Brightloop Software'}</h3>
            <p>Subscription business workspace</p>
          </div>

          <div className="setting-line">
            <span>Signed in as</span>
            <b>{user?.name} ({user?.email})</b>
          </div>
          <div className="setting-line">
            <span>System role</span>
            <b style={{ textTransform: 'uppercase', color: '#536fe0' }}>{user?.role}</b>
          </div>
          <div className="setting-line">
            <span>API connection endpoint</span>
            <b>{import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}</b>
          </div>
          <div className="setting-line">
            <span>Primary base currency</span>
            <b>{settings?.currency || 'INR'} · {settings?.currency === 'USD' ? 'US Dollar ($)' : settings?.currency === 'EUR' ? 'Euro (€)' : 'Indian Rupee (₹)'}</b>
          </div>
          <div className="setting-line">
            <span>Supported intervals</span>
            <b>Daily, Weekly, Monthly, Yearly</b>
          </div>
          <div className="setting-line">
            <span>Tax configuration</span>
            <b>Standard GST / VAT (configurable per subscription: default 18%)</b>
          </div>
          <div className="setting-line">
            <span>Invoice prefix</span>
            <b>{settings?.invoice_prefix || 'INV'}-YYYYMM-XXXXX</b>
          </div>
          <div className="setting-line">
            <span>Session expiration</span>
            <b>Automatic 401 interception & renewal prompt</b>
          </div>
          {settings?.support_email && (
            <div className="setting-line">
              <span>Support email</span>
              <b>{settings.support_email}</b>
            </div>
          )}
          {settings?.website && (
            <div className="setting-line">
              <span>Website</span>
              <b>{settings.website}</b>
            </div>
          )}
        </div>
      )}

      {activeTab === 'business' && user?.role === 'admin' && (
        <div className="panel" style={{ maxWidth: 680, padding: 24 }}>
          <h3 style={{ font: '700 14px Manrope', margin: '0 0 4px', color: '#243149' }}>Business configuration</h3>
          <p style={{ fontSize: 10, color: '#929daf', margin: '0 0 22px' }}>
            Configure your company profile, invoice branding, and default currency.
          </p>
          <form className="form-grid" onSubmit={handleSaveSettings}>
            <Field label="Company name" required wide>
              <input
                required
                value={settingsForm.company_name}
                onChange={e => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                placeholder="Brightloop Software"
              />
            </Field>
            <Field label="Support email" required wide>
              <input
                type="email"
                required
                value={settingsForm.support_email}
                onChange={e => setSettingsForm({ ...settingsForm, support_email: e.target.value })}
                placeholder="support@yourcompany.com"
              />
            </Field>
            <Field label="Currency">
              <select
                value={settingsForm.currency}
                onChange={e => setSettingsForm({ ...settingsForm, currency: e.target.value })}
              >
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="SGD">SGD — Singapore Dollar</option>
              </select>
            </Field>
            <Field label="Tax / GST ID">
              <input
                value={settingsForm.tax_id}
                onChange={e => setSettingsForm({ ...settingsForm, tax_id: e.target.value })}
                placeholder="e.g. 29ABCDE1234F1Z5"
              />
            </Field>
            <Field label="Invoice number prefix">
              <input
                value={settingsForm.invoice_prefix}
                onChange={e => setSettingsForm({ ...settingsForm, invoice_prefix: e.target.value })}
                placeholder="INV"
              />
            </Field>
            <Field label="Company website">
              <input
                value={settingsForm.website}
                onChange={e => setSettingsForm({ ...settingsForm, website: e.target.value })}
                placeholder="https://yourcompany.com"
              />
            </Field>
            <Field label="Business address" wide>
              <textarea
                value={settingsForm.address}
                onChange={e => setSettingsForm({ ...settingsForm, address: e.target.value })}
                placeholder="123 Business Park, Bengaluru, Karnataka 560001"
              />
            </Field>
            <div className="form-actions">
              <button type="button" className="outline" onClick={loadSettings} disabled={settingsBusy}>
                <RefreshCw size={13} /> Reset
              </button>
              <button className="primary" disabled={settingsBusy}>
                <Save size={13} /> {settingsBusy ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'audit' && user?.role === 'admin' && (
        <div className="panel table-panel">
          <div className="panel-head">
            <div>
              <h3>Audit log <span className="count">{auditLogs.length}</span></h3>
              <p>Immutable record of all significant system actions</p>
            </div>
            <button className="outline" onClick={loadAuditLogs} disabled={auditLoading}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>ACTION</th>
                  <th>ENTITY TYPE</th>
                  <th>ENTITY ID</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td>{dateFmt(log.created_at)}</td>
                    <td><b>{log.action}</b></td>
                    <td>{log.entity_type}</td>
                    <td>{log.entity_id || '—'}</td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.details || '—'}</td>
                  </tr>
                ))}
                {!auditLoading && auditLogs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty">No audit log entries found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openStaffModal && (
        <Modal title="Create operations staff member" close={() => setOpenStaffModal(false)}>
          <form className="form-grid" onSubmit={handleCreateStaff}>
            <Field label="Full name" required wide>
              <input
                required
                value={staffForm.name}
                onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                placeholder="e.g. Rahul Sharma"
              />
            </Field>
            <Field label="Staff email address" required wide>
              <input
                type="email"
                required
                value={staffForm.email}
                onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder="staff@brightloop.com"
              />
            </Field>
            <Field label="Initial password" required wide>
              <input
                type="password"
                required
                value={staffForm.password}
                onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                placeholder="Min 9 chars, uppercase, lowercase, symbol"
              />
            </Field>
            {error && (
              <div className="error" style={{ gridColumn: '1 / -1' }}>
                {error}
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="outline" onClick={() => setOpenStaffModal(false)} disabled={busy}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create staff account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
