import React from 'react';

/**
 * Standard page header with eyebrow text, title, description, and action buttons.
 */
export default function PageHead({ eyebrow, title, desc, action, secondary }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      <div className="head-actions">
        {secondary}
        {action}
      </div>
    </div>
  );
}

