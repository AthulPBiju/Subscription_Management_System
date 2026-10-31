import React, { useState } from 'react';
import { CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';
import api from '../api';
import Modal from './Modal';

export default function GatewayModal({ invoice, close, onPaymentSuccess }) {
  const [gateway, setGateway] = useState('razorpay');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState(null);
  const [complete, setComplete] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleCreateSession() {
    setBusy(true);
    setMsg('');
    try {
      const res = await api.post('/gateways/checkout', {
        invoice_id: invoice.id,
        gateway: gateway,
      });
      setSession(res.data);
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to initialize payment gateway.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateCapture() {
    setBusy(true);
    try {
      const txnId = `txn_${gateway}_${Date.now()}`;
      await api.post('/gateways/webhook', {
        gateway: gateway,
        event: gateway === 'razorpay' ? 'payment.captured' : 'payment_intent.succeeded',
        payload: {
          invoice_id: invoice.id,
          transaction_id: txnId,
          amount: invoice.total,
        },
      });
      setComplete(true);
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Payment verification failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Pay invoice ${invoice.number}`} close={close}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Amount Due</div>
          <div style={{ font: '800 24px Manrope', color: '#1e293b' }}>
            ₹{Number(invoice.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            Billed to: {invoice.customer_name || `Customer #${invoice.customer_id}`}
          </div>
        </div>

        {msg && <div className="notice notice-error">{msg}</div>}

        {complete ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={48} color="#2ca879" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>Payment Successful!</h3>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              Transaction recorded and verified via {gateway.toUpperCase()} webhook.
            </p>
            <button className="primary" onClick={close} style={{ marginTop: '18px' }}>
              Done
            </button>
          </div>
        ) : !session ? (
          <>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
                Select Payment Gateway (Sandbox Mode)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  className={`outline ${gateway === 'razorpay' ? 'primary' : ''}`}
                  onClick={() => setGateway('razorpay')}
                  style={{ padding: '14px', textAlign: 'center' }}
                >
                  <b>Razorpay</b>
                  <small style={{ display: 'block', fontSize: '9px', opacity: 0.8 }}>Cards, UPI, Netbanking</small>
                </button>
                <button
                  type="button"
                  className={`outline ${gateway === 'stripe' ? 'primary' : ''}`}
                  onClick={() => setGateway('stripe')}
                  style={{ padding: '14px', textAlign: 'center' }}
                >
                  <b>Stripe</b>
                  <small style={{ display: 'block', fontSize: '9px', opacity: 0.8 }}>Global Credit Cards</small>
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="outline" onClick={close}>
                Cancel
              </button>
              <button className="primary" onClick={handleCreateSession} disabled={busy}>
                <CreditCard size={15} /> {busy ? 'Connecting…' : `Proceed with ${gateway.toUpperCase()}`}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px', fontSize: '11px', color: '#166534' }}>
              <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Sandbox Order Active: <b>{session.order_id || session.session_id}</b>
            </div>

            <div style={{ margin: '18px 0', fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
              In test mode, clicking below simulates the real customer authorization flow and delivers an idempotent webhook back to the server to settle this invoice.
            </div>

            <div className="form-actions">
              <button type="button" className="outline" onClick={() => setSession(null)}>
                Back
              </button>
              <button className="primary" onClick={handleSimulateCapture} disabled={busy}>
                {busy ? 'Verifying payment…' : 'Simulate Successful Payment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

