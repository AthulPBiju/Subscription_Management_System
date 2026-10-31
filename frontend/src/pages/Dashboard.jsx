import React, { useState, useEffect, useMemo } from 'react';
import {
  Repeat, Wallet, Receipt, AlertCircle,
  RefreshCw, Play, MoreHorizontal, ChevronDown, Download, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api, { downloadInvoicePdf } from '../api';
import Stat from '../components/Stat';
import PageHead from '../components/PageHead';
import Status from '../components/Status';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Number(n || 0));

const dateFmt = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Dashboard({ onOverdueChange }) {
  const [data,     setData]     = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [subs,     setSubs]     = useState([]);
  const [payments, setPayments] = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [notice,   setNotice]   = useState('');

  async function load() {
    try {
      const [d, i, s, p] = await Promise.all([
        api.get('/dashboard'),
        api.get('/invoices'),
        api.get('/subscriptions'),
        api.get('/payments'),
      ]);
      setData(d.data);
      setInvoices(Array.isArray(i.data) ? i.data : []);
      setSubs(Array.isArray(s.data) ? s.data : []);
      setPayments(Array.isArray(p.data) ? p.data : []);
      if (onOverdueChange) onOverdueChange(d.data.overdue_invoices ?? 0);
    } catch {
      setNotice('Could not load dashboard data. Check the backend connection.');
    }
  }

  useEffect(() => { load(); }, []);

  async function runBilling() {
    setBusy(true);
    try {
      const r = await api.post('/billing/run');
      setNotice(`${r.data.created} invoice(s) generated successfully.`);
      load();
    } catch (e) {
      setNotice(e.response?.data?.detail || 'Billing run failed.');
    } finally {
      setBusy(false);
    }
  }

  // ── Real monthly revenue chart (last 6 months from actual payments) ───────
  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d    = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const m    = d.toLocaleString('en-IN', { month: 'short' });
      const year = d.getFullYear();
      const mon  = d.getMonth();
      const v    = payments
        .filter(p => {
          const pd = new Date(p.paid_on);
          return pd.getFullYear() === year && pd.getMonth() === mon;
        })
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      return { m, v };
    });
  }, [payments]);

  const today = new Date();
  const weekday = today.toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase();
  const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <>
      <PageHead
        eyebrow={`${weekday}, ${dateStr}`}
        title="Good day, team 👋"
        desc="Here's what's happening across your subscription business today."
        secondary={<button className="outline" onClick={load}><RefreshCw size={15} /> Refresh</button>}
        action={
          <button className="primary" onClick={runBilling} disabled={busy}>
            <Play size={15} />{busy ? 'Running…' : 'Run billing'}
          </button>
        }
      />

      {notice && (
        <div className="notice">
          {notice}
          <button onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <Stat
          label="Active subscriptions"
          value={data?.active_subscriptions ?? '—'}
          change="Currently live"
          sub="active contracts"
          Icon={Repeat}
        />
        <Stat
          label="Revenue received"
          value={money(data?.revenue_received)}
          change="All time"
          sub="recorded payments"
          Icon={Wallet}
          tone="green"
        />
        <Stat
          label="Outstanding"
          value={money(data?.outstanding)}
          change="Needs collection"
          sub="unpaid invoice value"
          Icon={Receipt}
          tone="orange"
        />
        <Stat
          label="Overdue invoices"
          value={data?.overdue_invoices ?? '—'}
          change="Action required"
          sub="past their due date"
          Icon={AlertCircle}
          tone="red"
        />
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="dashboard-grid">
        {/* Revenue trend */}
        <section className="panel revenue-panel">
          <div className="panel-head">
            <div>
              <h3>Revenue overview</h3>
              <p>Payments collected over the last 6 months</p>
            </div>
            <button className="select-lite">Last 6 months <ChevronDown size={14} /></button>
          </div>
          <div className="chart-total">
            {money(data?.revenue_received)}
            {payments.length === 0 && (
              <span style={{ fontSize: 10, color: '#aab2c0', marginLeft: 10 }}>
                No payments recorded yet
              </span>
            )}
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5478ed" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#5478ed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: '#929bad', fontSize: 12 }} />
                <YAxis hide />
                <Tooltip formatter={v => money(v)} />
                <Area type="monotone" dataKey="v" stroke="#5478ed" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Subscription health */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Subscription health</h3>
              <p>Current lifecycle breakdown</p>
            </div>
            <button className="more"><MoreHorizontal /></button>
          </div>
          <div className="health-number">
            {subs.length}<small> total subscriptions</small>
          </div>
          <div className="health-list">
            {['Active', 'Draft', 'Quotation', 'Confirmed', 'Paused', 'Closed'].map((s, i) => {
              const n = subs.filter(x => x.status === s).length;
              return (
                <div className="health-row" key={s}>
                  <span><i className={`dot d${i}`} />{s}</span>
                  <b>{n}</b>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Recent invoices ──────────────────────────────────────────────── */}
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>Recent invoices</h3>
            <p>Latest billing activity across your customers</p>
          </div>
          <a href="/invoices" className="text-link">
            View all invoices <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>INVOICE</th>
                <th>CUSTOMER</th>
                <th>BILLING DATE</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 5).length ? (
                invoices.slice(0, 5).map(x => (
                  <tr key={x.id}>
                    <td>
                      <b>{x.number}</b>
                      <small>{x.subscription_number || `Subscription #${x.subscription_id}`}</small>
                    </td>
                    <td>{x.customer_name || `Customer #${x.customer_id}`}</td>
                    <td>{dateFmt(x.billing_date)}</td>
                    <td><b>{money(x.total)}</b></td>
                    <td><Status value={x.status} /></td>
                    <td>
                      <button
                        className="row-action"
                        title="Download PDF"
                        onClick={() => downloadInvoicePdf(x.id, x.number)}
                      >
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty">
                    No invoices yet. Activate a subscription and run billing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

