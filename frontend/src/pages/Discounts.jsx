import React, { useState } from 'react';
import { Plus, Tag, Edit2, Trash2 } from 'lucide-react';
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

export default function Discounts() {
  const { rows, load, loading } = useRows('/discounts');
  const [openModal, setOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    name: '',
    kind: 'percentage',
    value: '',
    min_quantity: 1,
    starts_on: '',
    ends_on: '',
    usage_limit: '',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditingItem(null);
    setForm({
      name: '',
      kind: 'percentage',
      value: '',
      min_quantity: 1,
      starts_on: '',
      ends_on: '',
      usage_limit: '',
    });
    setOpenModal(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      kind: item.kind || 'percentage',
      value: item.value || '',
      min_quantity: item.min_quantity || 1,
      starts_on: item.starts_on || '',
      ends_on: item.ends_on || '',
      usage_limit: item.usage_limit ?? '',
    });
    setOpenModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const payload = {
        name: form.name,
        kind: form.kind,
        value: Number(form.value),
        min_quantity: Number(form.min_quantity) || 1,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      };

      if (editingItem) {
        await api.patch(`/discounts/${editingItem.id}`, payload);
        setMsg('Discount rule updated.');
      } else {
        await api.post('/discounts', payload);
        setMsg('Discount rule created.');
      }
      setOpenModal(false);
      load();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Unable to save discount rule.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Deactivate discount rule "${item.name}"?`)) return;
    try {
      await api.delete(`/discounts/${item.id}`);
      load();
      setMsg('Discount rule deactivated.');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Could not deactivate discount.');
    }
  }

  return (
    <>
      <PageHead
        eyebrow="PRICING & PROMOTIONS"
        title="Discounts"
        desc="Create promotional coupons, percentage deductions, volume incentives and usage limits."
        action={
          <button className="primary" onClick={openCreate}>
            <Plus size={16} /> New discount
          </button>
        }
      />

      {msg && (
        <div className="notice">
          {msg}
          <button onClick={() => setMsg('')}>×</button>
        </div>
      )}

      <div className="catalog-grid">
        {rows.map(x => (
          <div
            className="product-card"
            key={x.id}
            style={{ opacity: x.active === false ? 0.6 : 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="product-symbol orange">
                <Tag />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="row-action" title="Edit discount" onClick={() => openEdit(x)}>
                  <Edit2 size={14} />
                </button>
                <button
                  className="row-action"
                  title="Deactivate discount"
                  onClick={() => handleDelete(x)}
                  style={{ color: '#e16c68' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="product-type">
              {x.kind} discount {x.active === false && '(Inactive)'}
            </div>
            <h3>{x.name}</h3>

            <div className="discount-value">
              {x.kind === 'percentage' ? `${x.value}%` : money(x.value)}{' '}
              <small>off</small>
            </div>

            <div className="variant-list">
              <span>
                Minimum contract quantity <b>{x.min_quantity}</b>
              </span>
              <span>
                Usage count <b>{x.used_count} / {x.usage_limit ?? '∞'}</b>
              </span>
              <span>
                Valid from <b>{dateFmt(x.starts_on)}</b>
              </span>
              <span>
                Valid until <b>{dateFmt(x.ends_on)}</b>
              </span>
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <div className="empty-card">No discount offers configured yet. Create a promotion above.</div>
        )}
      </div>

      {openModal && (
        <Modal
          title={editingItem ? 'Edit discount rule' : 'Create discount rule'}
          close={() => setOpenModal(false)}
        >
          <form className="form-grid" onSubmit={handleSave}>
            <Field label="Rule name" required wide>
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Q4 Growth Discount, Early Adopter 20"
              />
            </Field>

            <Field label="Discount type" required>
              <select
                value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value })}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (INR)</option>
              </select>
            </Field>

            <Field label={form.kind === 'percentage' ? 'Percentage (%)' : 'Amount (INR)'} required>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.value}
                onChange={e => setForm({ ...form, value: e.target.value })}
              />
            </Field>

            <Field label="Minimum quantity">
              <input
                type="number"
                min="1"
                value={form.min_quantity}
                onChange={e => setForm({ ...form, min_quantity: e.target.value })}
              />
            </Field>

            <Field label="Usage limit (blank for unlimited)">
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={form.usage_limit}
                onChange={e => setForm({ ...form, usage_limit: e.target.value })}
              />
            </Field>

            <Field label="Starts on">
              <input
                type="date"
                value={form.starts_on}
                onChange={e => setForm({ ...form, starts_on: e.target.value })}
              />
            </Field>

            <Field label="Ends on">
              <input
                type="date"
                value={form.ends_on}
                onChange={e => setForm({ ...form, ends_on: e.target.value })}
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
                {busy ? 'Saving…' : 'Save discount'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

