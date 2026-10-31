import React from 'react';
import { X } from 'lucide-react';

/**
 * Reusable modal overlay.
 * Closes when clicking the backdrop or the × button.
 */
export default function Modal({ title, children, close, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => e.target === e.currentTarget && close()}
    >
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button onClick={close} aria-label="Close"><X size={19} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

