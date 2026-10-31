import React, { useState, useEffect } from 'react';
import {
  Repeat, Receipt, Wallet, ArrowUpRight, Download, CreditCard,
  AlertCircle, CheckCircle2, Shield, Calendar, ArrowRightLeft,
} from 'lucide-react';
import api, { downloadInvoicePdf } from '../api';
import PageHead from '../components/PageHead';
import Stat from '../components/Stat';
import Status from '../components/Status';
import Modal from '../components/Modal';
import Field from '../components/Field';
import GatewayModal from '../components/GatewayModal';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const dateFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CustomerPortal({ user }) {
  const [profile, setProfile] = useState(null);
  const [subs, setSubs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Modals
  const [upgradeSub, setUpgradeSub] = useState(null);
  const [selectedNewPlan, setSelectedNewPlan] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [cancelSub, setCancelSub] = useState(null);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [profRes, subsRes, invsRes, plansRes] = await Promise.all([
        api.get('/portal/me'),
        api.get('/portal/subscriptions'),
        api.get('/portal/invoices'),
        api.get('/portal/available-plans'),
      ]);
      setProfile(profRes.data);
      setSubs(Array.isArray(subsRes.data) ? subsRes.data : []);
      setInvoices(Array.isArray(invsRes.data) ? invsRes.data : []);
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
    } catch (err) {
      setMsg('Failed to load customer portal data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handlePlanChange(e) {
    e.preventDefault();
    if (!upgradeSub || !selectedNewPlan) return;
    setBusy(true);
    try {
      const res = await api.post(`/subscriptions/${upgradeSub.id}/change-plan`, {
        new_plan_id: Number(selectedNewPlan),
        prorate: true,
      });
      setUpgradeSub(null);
      setSelectedNewPlan('');
      setMsg(`Subscription successfully changed to ${res.data.plan_name}.`);
      loadData();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to change plan.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSubscription(e) {
    e.preventDefault();
    if (!cancelSub) return;
    setBusy(true);
    try {
      await api.post(`/subscriptions/${cancelSub.id}/cancel`, {
        immediately: cancelImmediately,
        reason: 'Customer cancelled from self-service portal',
      });
      setCancelSub(null);
      setMsg(cancelImmediately ? 'Subscription cancelled immediately.' : 'Subscription will cancel at period end.');
      loadData();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to cancel subscription.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="CUSTOMER SELF-SERVICE PORTAL"
        title={`Welcome back, ${user?.name || 'Customer'}`}
        desc="Manage your active subscriptions, change plans, view billing statements, and make payments."
      />

      {msg && (
        <div className="notice">
          {msg}
          <button onClick={() => setMsg('')}>×</button>
        </div>
      )}

      {/* KPI Overview */}
      <div className="stats-grid">
        <Stat
          label="Active contracts"
          value={profile?.active_subscriptions ?? 0}
          change="Account status"
          sub="live subscriptions"
          Icon={Repeat}
          tone="green"
        />
        <Stat
          label="Total invoices"
          value={profile?.total_invoices ?? 0}
          change="History"
          sub="billing statements"
          Icon={Receipt}
        />
        <Stat
          label="Unpaid invoices"
          value={profile?.unpaid_invoices ?? 0}
          change={profile?.unpaid_invoices > 0 ? 'Payment due' : 'All clear'}
          sub="pending settlement"
          Icon={AlertCircle}
          tone={profile?.unpaid_invoices > 0 ? 'orange' : 'green'}
        />
        <Stat
          label="Company profile"
          value={profile?.company || 'Personal'}
          change="Verified"
          sub={profile?.email || ''}
          Icon={Shield}
        />
      </div>

      {/* Active Subscriptions Section */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-head">
          <div>
            <h3>Your subscriptions</h3>
            <p>Active services, renewal dates and plan configuration</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginTop: '16px' }}>
          {subs.map(sub => (
            <div key={sub.id} className="product-card" style={{ border: '1px solid #e2e8f0', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="product-type">{sub.number}</span>
                <Status value={sub.status} />
              </div>
              <h3 style={{ margin: '8px 0 4px' }}>{sub.product_name || 'Software Subscription'}</h3>
              <div className="product-price" style={{ margin: '10px 0' }}>
                {money(sub.unit_price)} <small>/ {sub.plan_interval}</small>
              </div>

              <div className="variant-list">
                <span>Plan <b>{sub.plan_name}</b></span>
                <span>Next billing date <b>{dateFmt(sub.next_billing_date)}</b></span>
                <span>Quantity <b>{sub.quantity}</b></span>
              </div>

              {sub.status === 'Active' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    className="outline"
                    style={{ flex: 1, fontSize: '10px' }}
                    onClick={() => {
                      setUpgradeSub(sub);
                      setSelectedNewPlan(plans.find(p => p.id !== sub.plan_id)?.id || '');
                    }}
                  >
                    <ArrowRightLeft size={13} /> Change plan
                  </button>
                  <button
                    className="outline"
                    style={{ fontSize: '10px', color: '#e16c68' }}
                    onClick={() => setCancelSub(sub)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && subs.length === 0 && (
            <div className="empty-card">You have no subscription contracts on file.</div>
          )}
        </div>
      </div>

      {/* Invoices & Billing History Section */}
      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>Billing history & invoices</h3>
            <p>Download PDF tax invoices or make immediate payments</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>INVOICE</th>
                <th>BILLING DATE</th>
                <th>DUE DATE</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <b>{inv.number}</b>
                    <small>{inv.subscription_number}</small>
                  </td>
                  <td>{dateFmt(inv.billing_date)}</td>
                  <td>{dateFmt(inv.due_date)}</td>
                  <td><b>{money(inv.total)}</b></td>
                  <td><Status value={inv.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                        <button
                          className="primary"
                          style={{ padding: '6px 10px', fontSize: '10px' }}
                          onClick={() => setPayingInvoice(inv)}
                        >
                          <CreditCard size={13} /> Pay now
                        </button>
                      )}
                      <button
                        className="row-action"
                        title="Download PDF statement"
                        onClick={() => downloadInvoicePdf(inv.id, inv.number)}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">No invoice statements found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Plan Modal */}
      {upgradeSub && (
        <Modal title={`Change plan for ${upgradeSub.number}`} close={() => setUpgradeSub(null)}>
          <form className="form-grid" onSubmit={handlePlanChange}>
            <Field label="Current plan" wide>
              <input readOnly value={`${upgradeSub.plan_name} (${money(upgradeSub.unit_price)} / ${upgradeSub.plan_interval})`} />
            </Field>

            <Field label="Select target plan" required wide>
              <select
                required
                value={selectedNewPlan}
                onChange={e => setSelectedNewPlan(e.target.value)}
              >
                <option value="">Choose plan...</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === upgradeSub.plan_id}>
                    {p.name} — {money(p.price)} / {p.interval} {p.id === upgradeSub.plan_id ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
              Proration will automatically calculate unused days on your current cycle and generate a prorated difference.
            </div>

            <div className="form-actions">
              <button type="button" className="outline" onClick={() => setUpgradeSub(null)} disabled={busy}>
                Cancel
              </button>
              <button className="primary" disabled={busy || !selectedNewPlan}>
                {busy ? 'Processing…' : 'Confirm plan change'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Modal */}
      {cancelSub && (
        <Modal title="Cancel subscription" close={() => setCancelSub(null)}>
          <form className="form-grid" onSubmit={handleCancelSubscription}>
            <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#475569' }}>
              Are you sure you want to cancel subscription <b>{cancelSub.number}</b> ({cancelSub.plan_name})?
            </div>

            <Field label="Cancellation timing" wide>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px' }}>
                <input
                  type="checkbox"
                  checked={cancelImmediately}
                  onChange={e => setCancelImmediately(e.target.checked)}
                />
                Cancel immediately (revokes access immediately)
              </label>
              <small style={{ color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                If unchecked, your subscription remains active until the end of the billing period ({dateFmt(cancelSub.next_billing_date)}).
              </small>
            </Field>

            <div className="form-actions">
              <button type="button" className="outline" onClick={() => setCancelSub(null)} disabled={busy}>
                Keep subscription
              </button>
              <button className="primary" style={{ background: '#e16c68', borderColor: '#e16c68' }} disabled={busy}>
                {busy ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Gateway Checkout Modal */}
      {payingInvoice && (
        <GatewayModal
          invoice={payingInvoice}
          close={() => setPayingInvoice(null)}
          onPaymentSuccess={() => {
            loadData();
          }}
        />
      )}
    </>
  );
}

