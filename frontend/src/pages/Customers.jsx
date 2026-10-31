import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Edit2, AlertCircle } from 'lucide-react';
import api from '../api';
import { useRows } from '../hooks/useRows';
import PageHead from '../components/PageHead';
import Modal from '../components/Modal';
import Field from '../components/Field';

const dateFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Customers() {
  const { rows, load, loading, error } = useRows('/customers');
  const [search, setSearch] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' });
  const [msg, setMsg] = useState({ text: '', type: 'info' });
  const [busy, setBusy] = useState(false);

  // Client-side search filtering over rows (reactive and safe, no DOM hacks)
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter(
      c =>
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term)
    );
  }, [rows, search]);

  function handleOpenCreate() {
    setEditingCustomer(null);
    setForm({ name: '', email: '', company: '', phone: '' });
    setOpenModal(true);
  }

  function handleOpenEdit(customer) {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      company: customer.company || '',
      phone: customer.phone || '',
    });
    setOpenModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: '', type: 'info' });
    try {
      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer.id}`, form);
        setMsg({ text: 'Customer updated successfully.', type: 'success' });
      } else {
        await api.post('/customers', form);
        setMsg({ text: 'Customer created successfully.', type: 'success' });
      }
      setOpenModal(false);
      load();
    } catch (err) {
      setMsg({
        text: err.response?.data?.detail || 'Unable to save customer details.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(customer) {
    if (!window.confirm(`Are you sure you want to delete customer "${customer.name}"?`)) return;
    try {
      await api.delete(`/customers/${customer.id}`);
      setMsg({ text: 'Customer deleted.', type: 'success' });
      load();
    } catch (err) {
      setMsg({
        text: err.response?.data?.detail || 'Could not delete customer.',
        type: 'error',
      });
    }
  }

  return (
    <>
      <PageHead
        eyebrow="RELATIONSHIP MANAGEMENT"
        title="Customers"
        desc="Manage your customer directory, contact info and accounts."
        action={
          <button className="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add customer
          </button>
        }
      />

      {msg.text && (
        <div className={`notice ${msg.type === 'error' ? 'notice-error' : ''}`}>
          {msg.text}
          <button onClick={() => setMsg({ text: '', type: 'info' })}>×</button>
        </div>
      )}

      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>
              All customers <span className="count">{filteredRows.length}</span>
            </h3>
            <p>Your business customer accounts in one place</p>
          </div>
          <div className="searchbox compact">
            <Search size={15} />
            <input
              placeholder="Search by name, email, company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>COMPANY</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>CREATED</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="person">
                      <div className="avatar soft">{c.name?.[0]?.toUpperCase() || 'C'}</div>
                      <b>{c.name}</b>
                    </div>
                  </td>
                  <td>{c.company || '—'}</td>
                  <td>{c.email}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{dateFmt(c.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        className="row-action"
                        title="Edit customer"
                        onClick={() => handleOpenEdit(c)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="row-action"
                        title="Delete customer"
                        onClick={() => handleDelete(c)}
                        style={{ color: '#e16c68' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">
                    {search ? 'No matching customers found.' : error || 'No customers found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openModal && (
        <Modal
          title={editingCustomer ? 'Edit customer' : 'Add a customer'}
          close={() => setOpenModal(false)}
        >
          <form className="form-grid" onSubmit={handleSave}>
            <Field label="Full name" required>
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Acme Corp / Jane Doe"
              />
            </Field>
            <Field label="Email address" required>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="billing@example.com"
              />
            </Field>
            <Field label="Company name">
              <input
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
                placeholder="Acme Global Inc"
              />
            </Field>
            <Field label="Phone number">
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
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
                {busy ? 'Saving…' : editingCustomer ? 'Update customer' : 'Create customer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

