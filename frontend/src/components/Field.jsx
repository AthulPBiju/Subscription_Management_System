import React from 'react';

/**
 * Styled form field wrapper.
 * @param {string}  label     – visible label text
 * @param {boolean} wide      – spans full grid width when true
 * @param {boolean} required  – appends a red asterisk
 */
export default function Field({ label, children, wide = false, required = false }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}{required && <span style={{ color: '#e16c68', marginLeft: 2 }}>*</span>}</span>
      {children}
    </label>
  );
}

