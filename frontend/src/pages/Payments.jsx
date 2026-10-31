import React, { useState } from 'react';
import { Plus, Wallet, FileText, CheckCircle2 } from 'lucide-react';
import api from '../api';
import { useRows } from '../hooks/useRows';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import Field from '../components/Field';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const dateFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Payments() {
  const { rows, load, loading } = useRows('/payments');
  const inv = useRows('/invoices');

  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({
    invoice_id: '',
    method: 'Bank transfer',
    amount: '',
    paid_on: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setForm({
      invoice_id: '',
      method: 'Bank transfer',
      amount: '',
      paid_on: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setOpenModal(true);
  }

  function handleInvoiceSelect(invoiceId) {
    const selected = inv.rows.find(x => x.id === Number(invoiceId));
    setForm({
      ...form,
      invoice_id: invoiceId,
      amount: selected ? selected.total : '',
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await api.post('/payments', {
        invoice_id: Number(form.invoice_id),
        method: form.method,
        amount: Number(form.amount),
        paid_on: form.paid_on,
        note: form.note || '',
      });
      setOpenModal(false);
      load();
      inv.load();
      setMsg('Payment transaction recorded successfully.');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Unable to record payment.');
    } finally {
      setBusy(false);
    }
  }

  // Only invoices that are not already Paid or Cancelled
  const payableInvoices = inv.rows.filter(x => x.status !== 'Paid' && x.status !== 'Cancelled');

  return (
    <>
      <PageHead
        eyebrow="CASH FLOW & SETTLEMENTS"
        title="Payments"
        desc="Record incoming collections, track ledger receipts, and auto-settle invoice balances."
        action={
          <button className="primary" onClick={openCreate}>
            <Plus size={16} /> Record payment
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
              Payment ledger <span className="count">{rows.length}</span>
            </h3>
            <p>Verified payment transactions and payment methods</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PAYMENT ID</th>
                <th>INVOICE NUMBER</th>
                <th>METHOD</th>
                <th>PAYMENT DATE</th>
                <th>AMOUNT RECEIVED</th>
                <th>NOTE / REF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(x => {
                const matchedInvoice = inv.rows.find(i => i.id === x.invoice_id);
                return (
                  <tr key={x.id}>
                    <td>
                      <b>PAY-{String(x.id).padStart(5, '0')}</b>
                    </td>
                    <td>
                      <b>{matchedInvoice?.number || `Invoice #${x.invoice_id}`}</b>
                      {matchedInvoice?.customer_name && <small>{matchedInvoice.customer_name}</small>}
                    </td>
                    <td>{x.method}</td>
                    <td>{dateFmt(x.paid_on)}</td>
                    <td>
                      <b style={{ color: '#2ca879' }}>{money(x.amount)}</b>
                    </td>
                    <td>{x.note || '—'}</td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">
                    No payment records in the ledger yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openModal && (
        <Modal title="Record customer payment" close={() => setOpenModal(false)}>
          <form className="form-grid" onSubmit={handleSave}>
            <Field label="Invoice" required wide>
              <select
                required
                value={form.invoice_id}
                onChange={e => handleInvoiceSelect(e.target.value)}
              >
                <option value="">Select outstanding invoice</option>
                {payableInvoices.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.number} — {x.customer_name || `Customer #${x.customer_id}`} ({money(x.total)})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Amount to record (INR)" required>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
              />
            </Field>

            <Field label="Payment method" required>
              <select
                value={form.method}
                onChange={e => setForm({ ...form, method: e.target.value })}
              >
                <option value="Bank transfer">Bank transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI</option>
                <option value="Credit card">Credit card</option>
                <option value="Debit card">Debit card</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Razorpay">Razorpay</option>
                <option value="Stripe">Stripe</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Payment date" required>
              <input
                type="date"
                required
                value={form.paid_on}
                onChange={e => setForm({ ...form, paid_on: e.target.value })}
              />
            </Field>

            <Field label="Internal notes / UTR / Reference" wide>
              <textarea
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="e.g. Bank UTR #1234567890 or transaction ref"
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
                {busy ? 'Recording…' : 'Save payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

