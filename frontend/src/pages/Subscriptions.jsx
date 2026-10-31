import React, { useState, useMemo } from 'react';
import { Plus, Search, History, X, ChevronRight } from 'lucide-react';
import api from '../api';
import { useRows } from '../hooks/useRows';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Status from '../components/Status';

const TRANSITIONS = {
  Draft: ['Quotation', 'Confirmed', 'Closed'],
  Quotation: ['Confirmed', 'Closed'],
  Confirmed: ['Active', 'Closed'],
  Active: ['Paused', 'Closed'],
  Paused: ['Active', 'Closed'],
  Closed: [],
};

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const dateFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const dtFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Subscriptions() {
  const s = useRows('/subscriptions');
  const c = useRows('/customers');
  const p = useRows('/products');
  const pl = useRows('/plans');
  const d = useRows('/discounts');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [openModal, setOpenModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(null); // { sub, records }
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    product_id: '',
    plan_id: '',
    quantity: 1,
    tax_rate: 18,
    discount_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    payment_terms: 'Due on receipt',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredRows = useMemo(() => {
    let rows = s.rows;
    if (filterStatus !== 'ALL') rows = rows.filter(x => x.status === filterStatus);
    if (search.trim()) {
      const t = search.toLowerCase();
      rows = rows.filter(x =>
        x.number?.toLowerCase().includes(t) ||
        x.customer_name?.toLowerCase().includes(t) ||
        x.product_name?.toLowerCase().includes(t) ||
        x.plan_name?.toLowerCase().includes(t)
      );
    }
    return rows;
  }, [s.rows, filterStatus, search]);

  function openCreate() {
    setForm({
      customer_id: '',
      product_id: '',
      plan_id: '',
      quantity: 1,
      tax_rate: 18,
      discount_id: '',
      start_date: new Date().toISOString().slice(0, 10),
      expiry_date: '',
      payment_terms: 'Due on receipt',
    });
    setOpenModal(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await api.post('/subscriptions', {
        customer_id: Number(form.customer_id),
        product_id: Number(form.product_id),
        plan_id: Number(form.plan_id),
        quantity: Number(form.quantity) || 1,
        tax_rate: Number(form.tax_rate) || 0,
        discount_id: form.discount_id ? Number(form.discount_id) : null,
        start_date: form.start_date,
        expiry_date: form.expiry_date || null,
        payment_terms: form.payment_terms,
      });
      setOpenModal(false);
      s.load();
      setMsg('Subscription created in Draft status.');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Unable to create subscription.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(sub, newStatus) {
    if (!TRANSITIONS[sub.status]?.includes(newStatus)) {
      setMsg(`Cannot move from '${sub.status}' to '${newStatus}'.`);
      return;
    }
    try {
      await api.patch(`/subscriptions/${sub.id}/status`, { status: newStatus });
      s.load();
      setMsg(`Subscription ${sub.number} moved to ${newStatus}.`);
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to update subscription status.');
    }
  }

  async function openHistory(sub) {
    setHistoryLoading(true);
    setHistoryModal({ sub, records: [] });
    try {
      const res = await api.get(`/subscriptions/${sub.id}/history`);
      setHistoryModal({ sub, records: Array.isArray(res.data) ? res.data : [] });
    } catch {
      setHistoryModal({ sub, records: [] });
    } finally {
      setHistoryLoading(false);
    }
  }

  const statusCounts = useMemo(() => {
    const map = {};
    s.rows.forEach(x => { map[x.status] = (map[x.status] || 0) + 1; });
    return map;
  }, [s.rows]);

  return (
    <>
      <PageHead
        eyebrow="RECURRING CONTRACTS"
        title="Subscriptions"
        desc="Track every customer contract lifecycle from quotation to active renewals."
        action={
          <button className="primary" onClick={openCreate}>
            <Plus size={16} /> New subscription
          </button>
        }
      />

      {msg && (
        <div className="notice">
          {msg}
          <button onClick={() => setMsg('')}>×</button>
        </div>
      )}

      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>
              All subscriptions <span className="count">{filteredRows.length}</span>
            </h3>
            <p>Lifecycle state, recurring billing schedule, and assignment</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select
              className="select-lite"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {['Active', 'Draft', 'Quotation', 'Confirmed', 'Paused', 'Closed'].map(st => (
                <option key={st} value={st}>{st} {statusCounts[st] ? `(${statusCounts[st]})` : ''}</option>
              ))}
            </select>
            <div className="searchbox compact">
              <Search size={15} />
              <input
                placeholder="Search subscription, customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SUBSCRIPTION</th>
                <th>CUSTOMER</th>
                <th>PRODUCT / PLAN</th>
                <th>START DATE</th>
                <th>NEXT BILLING</th>
                <th>STATUS</th>
                <th>MOVE TO</th>
                <th style={{ textAlign: 'center' }}>LOG</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(sub => {
                const allowed = TRANSITIONS[sub.status] || [];
                return (
                  <tr key={sub.id}>
                    <td>
                      <b>{sub.number}</b>
                      <small>Qty {sub.quantity} · Tax {sub.tax_rate}%</small>
                    </td>
                    <td>
                      <b>{sub.customer_name || `Customer #${sub.customer_id}`}</b>
                      <small>{sub.customer_email || ''}</small>
                    </td>
                    <td>
                      <b>{sub.product_name || `Product #${sub.product_id}`}</b>
                      <small>{sub.plan_name ? `${sub.plan_name} (${sub.plan_interval})` : `Plan #${sub.plan_id}`}</small>
                    </td>
                    <td>{dateFmt(sub.start_date)}</td>
                    <td>{dateFmt(sub.next_billing_date)}</td>
                    <td>
                      <Status value={sub.status} />
                      {sub.cancel_at_period_end && (
                        <small style={{ color: '#e16c68', display: 'block', marginTop: 2 }}>Cancels at period end</small>
                      )}
                    </td>
                    <td>
                      {allowed.length > 0 ? (
                        <select
                          className="mini-select"
                          value=""
                          onChange={e => { if (e.target.value) handleStatusChange(sub, e.target.value); }}
                        >
                          <option value="">Move to…</option>
                          {allowed.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 9, color: '#a0a9b7' }}>Terminal</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="row-action"
                        title="View history"
                        onClick={() => openHistory(sub)}
                      >
                        <History size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!s.loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty">
                    {search || filterStatus !== 'ALL'
                      ? 'No matching subscriptions found.'
                      : 'No subscriptions found. Create your first contract above.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Subscription Modal */}
      {openModal && (
        <Modal title="Create subscription contract" close={() => setOpenModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <Field label="Customer" required wide>
              <select
                required
                value={form.customer_id}
                onChange={e => setForm({ ...form, customer_id: e.target.value })}
              >
                <option value="">Select customer</option>
                {c.rows.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.email}) {x.company ? `— ${x.company}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Product" required>
              <select
                required
                value={form.product_id}
                onChange={e => setForm({ ...form, product_id: e.target.value })}
              >
                <option value="">Select product</option>
                {p.rows.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({money(x.sales_price)})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Billing plan" required>
              <select
                required
                value={form.plan_id}
                onChange={e => setForm({ ...form, plan_id: e.target.value })}
              >
                <option value="">Select plan</option>
                {pl.rows.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({money(x.price)} / {x.interval})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Quantity" required>
              <input
                type="number"
                min="1"
                required
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>

            <Field label="Tax rate (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.tax_rate}
                onChange={e => setForm({ ...form, tax_rate: e.target.value })}
              />
            </Field>

            <Field label="Discount offer">
              <select
                value={form.discount_id}
                onChange={e => setForm({ ...form, discount_id: e.target.value })}
              >
                <option value="">None (Standard price)</option>
                {d.rows.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.kind === 'percentage' ? `${x.value}% off` : `${money(x.value)} off`})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Payment terms">
              <select
                value={form.payment_terms}
                onChange={e => setForm({ ...form, payment_terms: e.target.value })}
              >
                <option value="Due on receipt">Due on receipt</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
              </select>
            </Field>

            <Field label="Start date" required>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
            </Field>

            <Field label="Expiry date (optional)">
              <input
                type="date"
                value={form.expiry_date}
                onChange={e => setForm({ ...form, expiry_date: e.target.value })}
              />
            </Field>

            <div className="form-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setOpenModal(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create subscription'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Subscription History Modal */}
      {historyModal && (
        <Modal
          title={`History — ${historyModal.sub.number}`}
          close={() => setHistoryModal(null)}
        >
          <div style={{ minHeight: 160 }}>
            {historyLoading ? (
              <div className="empty">Loading history…</div>
            ) : historyModal.records.length === 0 ? (
              <div className="empty">No history records found.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {historyModal.records.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 12px',
                      background: i === 0 ? '#f0f7ff' : '#fafbfd',
                      borderRadius: 7,
                      border: '1px solid #edf1f7',
                    }}
                  >
                    <div style={{
                      width: 8, minWidth: 8, background: i === 0 ? '#536fe0' : '#d0d6e0',
                      borderRadius: 4, marginTop: 2,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2c3a51' }}>{r.event}</div>
                      {r.notes && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{r.notes}</div>}
                      {r.prorated_amount > 0 && (
                        <div style={{ fontSize: 10, color: '#536fe0', marginTop: 2 }}>
                          Prorated: ₹{r.prorated_amount.toLocaleString('en-IN')}
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: '#a0aab8', marginTop: 4 }}>{dtFmt(r.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="outline" onClick={() => setHistoryModal(null)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}
