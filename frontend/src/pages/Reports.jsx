import React, { useMemo, useState, useEffect } from 'react';
import { Download, Wallet, Repeat, Receipt, AlertCircle, TrendingUp, FileSpreadsheet } from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api from '../api';
import { useRows } from '../hooks/useRows';
import PageHead from '../components/PageHead';
import Stat from '../components/Stat';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export default function Reports() {
  const s = useRows('/subscriptions');
  const i = useRows('/invoices');
  const p = useRows('/payments');

  const [analytics, setAnalytics] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/analytics/summary')
      .then(res => setAnalytics(res.data))
      .catch(() => {});
  }, []);

  const received = useMemo(() => p.rows.reduce((sum, x) => sum + (x.amount || 0), 0), [p.rows]);

  const openInvoiceValue = useMemo(
    () =>
      i.rows
        .filter(x => x.status !== 'Paid' && x.status !== 'Cancelled')
        .reduce((sum, x) => sum + (x.total || 0), 0),
    [i.rows]
  );

  const byMethod = useMemo(() => {
    const map = {};
    p.rows.forEach(item => {
      const m = item.method || 'Other';
      map[m] = (map[m] || 0) + (item.amount || 0);
    });
    return Object.entries(map).map(([method, total]) => ({ method, total }));
  }, [p.rows]);

  const invoiceStatusBreakdown = useMemo(() => {
    const statuses = ['Paid', 'Confirmed', 'Draft', 'Cancelled'];
    return statuses.map(st => ({
      status: st,
      count: i.rows.filter(x => x.status === st).length,
    }));
  }, [i.rows]);

  const subStatusBreakdown = useMemo(() => {
    const statuses = ['Active', 'Draft', 'Quotation', 'Confirmed', 'Paused', 'Closed'];
    return statuses.map(st => ({
      name: st,
      value: s.rows.filter(x => x.status === st).length,
    })).filter(x => x.value > 0);
  }, [s.rows]);

  async function handleExportCsv() {
    setDownloading(true);
    try {
      const res = await api.get('/analytics/export-csv', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `brightloop_financials_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate CSV export.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="BUSINESS INTELLIGENCE & AUDIT"
        title="Reports & analytics"
        desc="A 100% verified view of recurring revenue, customer churn, cash collections, and receivable risk."
        secondary={
          <button className="outline" onClick={handleExportCsv} disabled={downloading}>
            <FileSpreadsheet size={15} /> {downloading ? 'Exporting…' : 'Export CSV'}
          </button>
        }
        action={
          <button className="outline" onClick={() => window.print()}>
            <Download size={15} /> Print view
          </button>
        }
      />

      <div className="stats-grid">
        <Stat
          label="Monthly Recurring (MRR)"
          value={money(analytics?.mrr ?? 0)}
          change={`ARR: ${money(analytics?.arr ?? 0)}`}
          sub="normalized contracts"
          Icon={TrendingUp}
          tone="blue"
        />
        <Stat
          label="Average Rev Per User (ARPU)"
          value={money(analytics?.arpu ?? 0)}
          change={`LTV: ${money(analytics?.ltv ?? 0)}`}
          sub="per active subscriber"
          Icon={Wallet}
          tone="green"
        />
        <Stat
          label="Customer churn rate"
          value={`${analytics?.churn_rate_pct ?? 0}%`}
          change="Historical"
          sub="closed vs total contracts"
          Icon={Repeat}
          tone={analytics?.churn_rate_pct > 15 ? 'red' : 'green'}
        />
        <Stat
          label="Open receivables"
          value={money(openInvoiceValue)}
          change="Unsettled"
          sub="excludes cancelled"
          Icon={AlertCircle}
          tone="orange"
        />
      </div>

      <div className="dashboard-grid">
        {/* Collections by payment method */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Collections by payment method</h3>
              <p>Aggregated from actual transaction records</p>
            </div>
          </div>
          <div className="chart">
            {byMethod.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMethod}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="method" tick={{ fontSize: 11, fill: '#7c8798' }} />
                  <YAxis hide />
                  <Tooltip formatter={v => money(v)} />
                  <Bar dataKey="total" fill="#536fe0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty" style={{ paddingTop: '60px' }}>
                No payment transactions recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Invoice status distribution */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Invoice status distribution</h3>
              <p>All issued billing documents</p>
            </div>
          </div>
          <div className="health-list" style={{ marginTop: '16px' }}>
            {invoiceStatusBreakdown.map((item, idx) => (
              <div className="health-row" key={item.status}>
                <span>
                  <i className={`dot d${idx % 6}`} />
                  {item.status}
                </span>
                <b>{item.count}</b>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px', borderTop: '1px solid #edf0f5', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '11px', color: '#68758a', margin: '0 0 10px' }}>
              Subscription contract breakdown
            </h4>
            <div className="health-list">
              {subStatusBreakdown.map((item, idx) => (
                <div className="health-row" key={item.name}>
                  <span>
                    <i className={`dot d${(idx + 2) % 6}`} />
                    {item.name}
                  </span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
