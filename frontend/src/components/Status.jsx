import React from 'react';

/**
 * Coloured status badge.
 * CSS class is derived from the value — keep `styles.css` in sync.
 */
export default function Status({ value }) {
  const cls = (value || '').toLowerCase().replace(/\s+/g, '-');
  return <span className={`status ${cls}`}>{value || '—'}</span>;
}

