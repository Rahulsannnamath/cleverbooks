import { useState } from 'react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'upload', label: 'Upload', icon: '📤' },
  { id: 'settlements', label: 'Settlements', icon: '💰' },
  { id: 'jobs', label: 'Job Logs', icon: '⚙️' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
];

export default function Sidebar({ activeTab, onTabChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">CB</div>
          <div>
            <div className="logo-text">CleverBooks</div>
            <div className="logo-subtitle">Settlement Engine</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            {tab.label}
          </div>
        ))}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
            Reconciliation Engine v1.0
          </div>
          Nightly reconciliation: 2:00 AM IST
        </div>
      </div>
    </aside>
  );
}
