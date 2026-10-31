import React, { useState, useMemo } from 'react';
import { Play, Download, FileText, CheckCircle2, Clock3, AlertCircle, Search } from 'lucide-react';
import api, { downloadInvoicePdf } from '../api';
import { useRows } from '../hooks/useRows';
import PageHead from '../components/PageHead';
import Stat from '../components/Stat';
import Status from '../components/Status';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const dateFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Invoices() {
  const { rows, load, loading } = useRows('/invoices');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  async function handleRunBilling() {
    setBusy(true);
    setMsg('');
    try {
      const res = await api.post('/billing/run');
      setMsg(`${res.data.created} invoice(s) generated for due active subscriptions.`);
      load();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Billing generation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      await api.patch(`/invoices/${id}/status`, { status: newStatus });
      load();
      setMsg(`Invoice status updated to ${newStatus}.`);
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to update invoice status.');
    }
  }

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filterStatus !== 'ALL') {
      result = result.filter(x => x.status === filterStatus);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        x =>
          x.number?.toLowerCase().includes(term) ||
          x.customer_name?.toLowerCase().includes(term) ||
          x.subscription_number?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [rows, filterStatus, search]);

  const paidCount = rows.filter(x => x.status === 'Paid').length;
  const confirmedCount = rows.filter(x => x.status === 'Confirmed').length;
  const overdueCount = rows.filter(
    x => x.status !== 'Paid' && x.status !== 'Cancelled' && new Date(x.due_date) < new Date()
  ).length;

  return (
    <>
      <PageHead
        eyebrow="BILLING & RECEIVABLES"
        title="Invoices"
        desc="Review all generated billing documents, due dates, payment status, and PDF archives."
        action={
          <button className="primary" onClick={handleRunBilling} disabled={busy}>
            <Play size={15} /> {busy ? 'Generating…' : 'Generate due invoices'}
          </button>
        }
      />

      {msg && (
        <div className="notice">
          {msg}
          <button onClick={() => setMsg('')}>×</button>
        </div>
      )}

      {/* Summary stats */}
      <div className="stats-grid mini-stats">
        <Stat
          label="Total invoices"
          value={rows.length}
          change="All time"
          sub="generated documents"
          Icon={FileText}
        />
        <Stat
          label="Paid"
          value={paidCount}
          change="Settled"
          sub="fully paid invoices"
          Icon={CheckCircle2}
          tone="green"
        />
        <Stat
          label="Awaiting payment"
          value={confirmedCount}
          change="Open"
          sub="confirmed invoices"
          Icon={Clock3}
          tone="orange"
        />
        <Stat
          label="Overdue"
          value={overdueCount}
          change="Action required"
          sub="past due date"
          Icon={AlertCircle}
          tone="red"
        />
      </div>

      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>
              Invoice register <span className="count">{filteredRows.length}</span>
            </h3>
            <p>Official billing records and ledger items</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              className="select-lite"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Paid">Paid</option>
              <option value="Draft">Draft</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <div className="searchbox compact">
              <Search size={15} />
              <input
                placeholder="Search invoice or customer..."
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
                <th>INVOICE</th>
                <th>CUSTOMER</th>
                <th>ISSUED</th>
                <th>DUE DATE</th>
                <th>TOTAL</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'center' }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(x => (
                <tr key={x.id}>
                  <td>
                    <b>{x.number}</b>
                    <small>{x.subscription_number || `Subscription #${x.subscription_id}`}</small>
                  </td>
                  <td>
                    <b>{x.customer_name || `Customer #${x.customer_id}`}</b>
                  </td>
                  <td>{dateFmt(x.billing_date)}</td>
                  <td>{dateFmt(x.due_date)}</td>
                  <td>
                    <b>{money(x.total)}</b>
                  </td>
                  <td>
                    {x.status === 'Paid' ? (
                      <Status value={x.status} />
                    ) : (
                      <select
                        className="mini-select"
                        value={x.status}
                        onChange={e => handleStatusChange(x.id, e.target.value)}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="row-action"
                      title="Download PDF invoice"
                      onClick={() => downloadInvoicePdf(x.id, x.number)}
                    >
                      <Download size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty">
                    No matching invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

