import React, { useState } from 'react';
import { Plus, Boxes, CalendarDays, Edit2, Trash2, Tag } from 'lucide-react';
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

export default function Catalog() {
  const p = useRows('/products');
  const pl = useRows('/plans');
  const [tab, setTab] = useState('products');
  const [openModal, setOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Variant modal state
  const [variantModal, setVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variantForm, setVariantForm] = useState({ name: '', price_adjustment: 0 });

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    product_type: 'Software',
    sales_price: '',
    cost_price: '',
    notes: '',
  });

  const [planForm, setPlanForm] = useState({
    name: '',
    price: '',
    interval: 'monthly',
    min_quantity: 1,
    allow_pause: true,
    allow_early_close: true,
  });

  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditingItem(null);
    if (tab === 'products') {
      setProductForm({
        name: '',
        product_type: 'Software',
        sales_price: '',
        cost_price: '',
        notes: '',
      });
    } else {
      setPlanForm({
        name: '',
        price: '',
        interval: 'monthly',
        min_quantity: 1,
        allow_pause: true,
        allow_early_close: true,
      });
    }
    setOpenModal(true);
  }

  function openEditProduct(item) {
    setEditingItem(item);
    setProductForm({
      name: item.name || '',
      product_type: item.product_type || 'Software',
      sales_price: item.sales_price || 0,
      cost_price: item.cost_price || 0,
      notes: item.notes || '',
    });
    setOpenModal(true);
  }

  function openEditPlan(item) {
    setEditingItem(item);
    setPlanForm({
      name: item.name || '',
      price: item.price || 0,
      interval: item.interval || 'monthly',
      min_quantity: item.min_quantity || 1,
      allow_pause: item.allow_pause ?? true,
      allow_early_close: item.allow_early_close ?? true,
    });
    setOpenModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (tab === 'products') {
        const payload = {
          ...productForm,
          sales_price: Number(productForm.sales_price) || 0,
          cost_price: Number(productForm.cost_price) || 0,
        };
        if (editingItem) {
          await api.patch(`/products/${editingItem.id}`, payload);
          setMsg('Product updated successfully.');
        } else {
          await api.post('/products', payload);
          setMsg('Product created successfully.');
        }
        p.load();
      } else {
        const payload = {
          ...planForm,
          price: Number(planForm.price) || 0,
          min_quantity: Number(planForm.min_quantity) || 1,
        };
        if (editingItem) {
          await api.patch(`/plans/${editingItem.id}`, payload);
          setMsg('Billing plan updated successfully.');
        } else {
          await api.post('/plans', payload);
          setMsg('Billing plan created successfully.');
        }
        pl.load();
      }
      setOpenModal(false);
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Unable to save item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProduct(prod) {
    if (!window.confirm(`Deactivate product "${prod.name}"?`)) return;
    try {
      await api.delete(`/products/${prod.id}`);
      p.load();
      setMsg('Product deactivated.');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Could not delete product.');
    }
  }

  async function handleDeletePlan(plan) {
    if (!window.confirm(`Deactivate plan "${plan.name}"?`)) return;
    try {
      await api.delete(`/plans/${plan.id}`);
      pl.load();
      setMsg('Plan deactivated.');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Could not delete plan.');
    }
  }

  function openAddVariant(product) {
    setSelectedProduct(product);
    setVariantForm({ name: '', price_adjustment: 0 });
    setVariantModal(true);
  }

  async function handleSaveVariant(e) {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await api.post(`/products/${selectedProduct.id}/variants`, {
        name: variantForm.name,
        price_adjustment: Number(variantForm.price_adjustment) || 0,
      });
      setVariantModal(false);
      p.load();
      setMsg('Variant added successfully.');
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to add variant.');
    }
  }

  return (
    <>
      <PageHead
        eyebrow="CATALOG CONFIGURATION"
        title="Products & plans"
        desc="Configure deliverables, billable items, pricing tiers and recurring intervals."
        action={
          <button className="primary" onClick={openCreate}>
            <Plus size={16} /> Add {tab === 'products' ? 'product' : 'plan'}
          </button>
        }
      />

      {msg && (
        <div className="notice">
          {msg}
          <button onClick={() => setMsg('')}>×</button>
        </div>
      )}

      <div className="tabs">
        <button
          className={tab === 'products' ? 'selected' : ''}
          onClick={() => setTab('products')}
        >
          Products <span>{p.rows.length}</span>
        </button>
        <button
          className={tab === 'plans' ? 'selected' : ''}
          onClick={() => setTab('plans')}
        >
          Billing plans <span>{pl.rows.length}</span>
        </button>
      </div>

      {tab === 'products' ? (
        <div className="catalog-grid">
          {p.rows.map(x => (
            <div className="product-card" key={x.id} style={{ opacity: x.active === false ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="product-symbol">
                  <Boxes />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="row-action"
                    title="Add variant"
                    onClick={() => openAddVariant(x)}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    className="row-action"
                    title="Edit product"
                    onClick={() => openEditProduct(x)}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="row-action"
                    title="Deactivate product"
                    onClick={() => handleDeleteProduct(x)}
                    style={{ color: '#e16c68' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="product-type">{x.product_type} {x.active === false && '(Inactive)'}</div>
              <h3>{x.name}</h3>
              <p>{x.notes || 'No product description provided.'}</p>
              <div className="product-price">
                {money(x.sales_price)} <small>base price</small>
              </div>
              <div className="variant-list">
                <span style={{ fontWeight: 600, color: '#445169' }}>Variants:</span>
                {x.variants?.length ? (
                  x.variants.map(v => (
                    <span key={v.id}>
                      {v.name} <b>+{money(v.price_adjustment)}</b>
                    </span>
                  ))
                ) : (
                  <span style={{ fontStyle: 'italic', color: '#9aa4b4' }}>No variants configured</span>
                )}
              </div>
            </div>
          ))}
          {p.rows.length === 0 && (
            <div className="empty-card">No products registered yet. Create your first product.</div>
          )}
        </div>
      ) : (
        <div className="catalog-grid">
          {pl.rows.map(x => (
            <div className="product-card plan-card" key={x.id} style={{ opacity: x.active === false ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="product-symbol purple">
                  <CalendarDays />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="row-action"
                    title="Edit plan"
                    onClick={() => openEditPlan(x)}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="row-action"
                    title="Deactivate plan"
                    onClick={() => handleDeletePlan(x)}
                    style={{ color: '#e16c68' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="product-type">{x.interval} billing {x.active === false && '(Inactive)'}</div>
              <h3>{x.name}</h3>
              <div className="product-price">
                {money(x.price)} <small>/ {x.interval.replace('ly', '')}</small>
              </div>
              <div className="variant-list">
                <span>
                  Minimum quantity <b>{x.min_quantity}</b>
                </span>
                <span>
                  Pause allowed <b>{x.allow_pause ? 'Yes' : 'No'}</b>
                </span>
                <span>
                  Early cancel allowed <b>{x.allow_early_close ? 'Yes' : 'No'}</b>
                </span>
              </div>
            </div>
          ))}
          {pl.rows.length === 0 && (
            <div className="empty-card">No billing plans found. Set up recurring cycles.</div>
          )}
        </div>
      )}

      {/* Product / Plan Modal */}
      {openModal && (
        <Modal
          title={
            tab === 'products'
              ? editingItem
                ? 'Edit product'
                : 'Create product'
              : editingItem
              ? 'Edit billing plan'
              : 'Create billing plan'
          }
          close={() => setOpenModal(false)}
        >
          <form className="form-grid" onSubmit={handleSave}>
            <Field label="Name" required wide>
              <input
                required
                value={tab === 'products' ? productForm.name : planForm.name}
                onChange={e =>
                  tab === 'products'
                    ? setProductForm({ ...productForm, name: e.target.value })
                    : setPlanForm({ ...planForm, name: e.target.value })
                }
                placeholder={tab === 'products' ? 'e.g. Enterprise Cloud Suite' : 'e.g. Monthly Standard'}
              />
            </Field>

            {tab === 'products' ? (
              <>
                <Field label="Product type">
                  <input
                    value={productForm.product_type}
                    onChange={e => setProductForm({ ...productForm, product_type: e.target.value })}
                  />
                </Field>
                <Field label="Sales price (INR)" required>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={productForm.sales_price}
                    onChange={e => setProductForm({ ...productForm, sales_price: e.target.value })}
                  />
                </Field>
                <Field label="Cost price (INR)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.cost_price}
                    onChange={e => setProductForm({ ...productForm, cost_price: e.target.value })}
                  />
                </Field>
                <Field label="Notes / Description" wide>
                  <textarea
                    value={productForm.notes}
                    onChange={e => setProductForm({ ...productForm, notes: e.target.value })}
                    placeholder="Brief description of product features..."
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Plan price (INR)" required>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={planForm.price}
                    onChange={e => setPlanForm({ ...planForm, price: e.target.value })}
                  />
                </Field>
                <Field label="Billing interval" required>
                  <select
                    value={planForm.interval}
                    onChange={e => setPlanForm({ ...planForm, interval: e.target.value })}
                  >
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </Field>
                <Field label="Minimum quantity">
                  <input
                    type="number"
                    min="1"
                    value={planForm.min_quantity}
                    onChange={e => setPlanForm({ ...planForm, min_quantity: e.target.value })}
                  />
                </Field>
                <Field label="Allow pause">
                  <select
                    value={planForm.allow_pause ? 'true' : 'false'}
                    onChange={e => setPlanForm({ ...planForm, allow_pause: e.target.value === 'true' })}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </Field>
                <Field label="Allow early cancel">
                  <select
                    value={planForm.allow_early_close ? 'true' : 'false'}
                    onChange={e =>
                      setPlanForm({ ...planForm, allow_early_close: e.target.value === 'true' })
                    }
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </Field>
              </>
            )}

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
                {busy ? 'Saving…' : 'Save configuration'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Variant Modal */}
      {variantModal && selectedProduct && (
        <Modal
          title={`Add variant for ${selectedProduct.name}`}
          close={() => setVariantModal(false)}
        >
          <form className="form-grid" onSubmit={handleSaveVariant}>
            <Field label="Variant name" required wide>
              <input
                required
                value={variantForm.name}
                onChange={e => setVariantForm({ ...variantForm, name: e.target.value })}
                placeholder="e.g. Pro Addon, Dedicated IP"
              />
            </Field>
            <Field label="Price adjustment (INR)" required wide>
              <input
                type="number"
                step="0.01"
                required
                value={variantForm.price_adjustment}
                onChange={e => setVariantForm({ ...variantForm, price_adjustment: e.target.value })}
                placeholder="Additional amount added to product base price"
              />
            </Field>
            <div className="form-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setVariantModal(false)}
              >
                Cancel
              </button>
              <button className="primary">Add variant</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

