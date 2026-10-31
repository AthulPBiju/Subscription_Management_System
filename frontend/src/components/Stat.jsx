import React from 'react';
import { ArrowUpRight } from 'lucide-react';

/**
 * KPI summary card.
 * @param {string}  label  – card title
 * @param {*}       value  – main displayed figure
 * @param {string}  change – secondary annotation (trend, label)
 * @param {React.ElementType} Icon
 * @param {string}  tone   – 'blue' | 'green' | 'orange' | 'red'
 * @param {string}  sub    – footnote text
 */
export default function Stat({ label, value, change, Icon, tone = 'blue', sub }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-foot">
        <span className="positive"><ArrowUpRight size={14} />{change}</span>
        <span>{sub}</span>
      </div>
    </div>
  );
}

