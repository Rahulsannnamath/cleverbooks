import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'SENT', label: 'Sent' },
  { id: 'QUEUED', label: 'Queued' },
  { id: 'RETRYING', label: 'Retrying' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'DEAD_LETTER', label: 'Dead Letter' },
];

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [activeStatus, setActiveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchNotifications(1);
    fetchStats();
  }, [activeStatus]);

  async function fetchNotifications(page = 1) {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (activeStatus) params.status = activeStatus;
      const res = await api.getNotifications(params);
      setNotifications(res.data.notifications);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await api.getNotificationStats();
      setStats(res.data);
    } catch {
      // silent
    }
  }

  async function handleRetry(id) {
    try {
      await api.retryNotification(id);
      toast.success('Notification re-queued');
      fetchNotifications(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function getStatusBadge(status) {
    const map = {
      SENT: 'badge-sent',
      FAILED: 'badge-failed',
      QUEUED: 'badge-queued',
      RETRYING: 'badge-retrying',
      DEAD_LETTER: 'badge-dead-letter',
    };
    return (
      <span className={`badge ${map[status] || ''}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  }

  function getStatusIcon(status) {
    const icons = {
      SENT: '✅',
      FAILED: '❌',
      QUEUED: '⏳',
      RETRYING: '🔄',
      DEAD_LETTER: '💀',
    };
    return icons[status] || '📧';
  }

  function formatDateTime(date) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Notification Delivery Log</h1>
        <p className="page-subtitle">
          Track all merchant discrepancy notifications
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="stat-card primary">
            <div className="stat-label">Total</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card accent">
            <div className="stat-label">Sent</div>
            <div className="stat-value accent">{stats.sent}</div>
          </div>
          <div className="stat-card primary">
            <div className="stat-label">Queued</div>
            <div className="stat-value">{stats.queued + stats.retrying}</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-label">Failed</div>
            <div className="stat-value danger">{stats.failed}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Dead Letter</div>
            <div className="stat-value warning">{stats.deadLetter}</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="tab-group">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeStatus === tab.id ? 'active' : ''}`}
              onClick={() => setActiveStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-ghost btn-sm" onClick={() => { fetchNotifications(1); fetchStats(); }}>
          🔄 Refresh
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="loading-overlay">
          <div className="loading-spinner lg"></div>
          <div className="loading-text">Loading notifications...</div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <div className="empty-title">No notifications yet</div>
            <div className="empty-description">
              Notifications appear after reconciliation detects discrepancies
            </div>
          </div>
        </div>
      ) : (
        <>
          {notifications.map((n) => (
            <div className="notification-item" key={n._id}>
              <div
                className={`notification-icon ${
                  n.status === 'SENT' ? 'sent' : n.status === 'FAILED' || n.status === 'DEAD_LETTER' ? 'failed' : 'queued'
                }`}
              >
                {getStatusIcon(n.status)}
              </div>
              <div className="notification-body">
                <div className="notification-title">
                  <span className="td-mono" style={{ marginRight: '8px' }}>{n.awbNumber}</span>
                  {getStatusBadge(n.status)}
                </div>
                <div className="notification-meta">
                  {n.discrepancyType?.replace(/_/g, ' ')} • Merchant: {n.merchantId} •
                  Attempts: {n.attempts}/{n.maxAttempts}
                  {n.sentAt && ` • Sent: ${formatDateTime(n.sentAt)}`}
                  {n.lastAttemptAt && ` • Last attempt: ${formatDateTime(n.lastAttemptAt)}`}
                </div>
                {n.errorMessage && (
                  <div style={{ fontSize: '12px', color: 'var(--danger-400)', marginTop: '4px' }}>
                    {n.errorMessage}
                  </div>
                )}
              </div>
              <div>
                {(n.status === 'DEAD_LETTER' || n.status === 'FAILED') && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRetry(n._id)}
                  >
                    🔄 Retry
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="pagination">
            <div className="pagination-info">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-ghost btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchNotifications(pagination.page - 1)}
              >
                ← Prev
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchNotifications(pagination.page + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
