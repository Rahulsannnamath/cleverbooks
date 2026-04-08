import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [notifStats, setNotifStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, notifRes] = await Promise.all([
        api.getSettlementStats(),
        api.getNotificationStats(),
      ]);
      setStats(statsRes.data);
      setNotifStats(notifRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function handleReconcile() {
    setReconciling(true);
    try {
      const res = await api.triggerReconciliation();
      toast.success(
        `Reconciliation complete! ${res.data.discrepancyCount} discrepancies found`
      );
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReconciling(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner lg"></div>
        <div className="loading-text">Loading dashboard...</div>
      </div>
    );
  }

  const {
    statusBreakdown = {},
    totalRecords = 0,
    totalDiscrepancyValue = 0,
    courierBreakdown = [],
    discrepancyTypeBreakdown = [],
  } = stats || {};

  const maxCourierCount = Math.max(
    ...courierBreakdown.map((c) => c.discrepancyCount),
    1
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div className="action-bar">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              Settlement reconciliation overview & analytics
            </p>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleReconcile}
            disabled={reconciling}
          >
            {reconciling ? (
              <>
                <span className="loading-spinner"></span> Running...
              </>
            ) : (
              <>⚡ Run Reconciliation</>
            )}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">Total Settlements</div>
          <div className="stat-value">{totalRecords}</div>
          <div className="stat-subtitle">All records in system</div>
        </div>

        <div className="stat-card accent">
          <div className="stat-label">Matched</div>
          <div className="stat-value accent">{statusBreakdown.matched || 0}</div>
          <div className="stat-subtitle">No discrepancies found</div>
        </div>

        <div className="stat-card danger">
          <div className="stat-label">Discrepancies</div>
          <div className="stat-value danger">
            {statusBreakdown.discrepancy || 0}
          </div>
          <div className="stat-subtitle">Require attention</div>
        </div>

        <div className="stat-card warning">
          <div className="stat-label">Pending</div>
          <div className="stat-value warning">
            {statusBreakdown.pending || 0}
          </div>
          <div className="stat-subtitle">Awaiting reconciliation</div>
        </div>

        <div className="stat-card purple">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: 'var(--purple-400)' }}>
            {statusBreakdown.pending_review || 0}
          </div>
          <div className="stat-subtitle">Manual review needed</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-label">Total Discrepancy Value</div>
          <div className="stat-value" style={{ color: 'var(--orange-400)' }}>
            ₹{totalDiscrepancyValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-subtitle">INR across all open records</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        {/* Courier Breakdown Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🏢 Courier Discrepancy Breakdown</h3>
          </div>
          {courierBreakdown.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-description">No discrepancy data yet</div>
            </div>
          ) : (
            <div className="chart-container">
              {courierBreakdown.map((c, i) => (
                <div className="chart-bar-row" key={c._id || i}>
                  <div className="chart-label">{c._id || 'Unknown'}</div>
                  <div className="chart-bar-track">
                    <div
                      className={`chart-bar-fill bar-${(i % 6) + 1}`}
                      style={{
                        width: `${(c.discrepancyCount / maxCourierCount) * 100}%`,
                      }}
                    >
                      {c.discrepancyCount}
                    </div>
                  </div>
                  <div className="chart-value">
                    ₹{Math.abs(c.totalVariance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discrepancy Types */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🔍 Discrepancy Types</h3>
          </div>
          {discrepancyTypeBreakdown.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-description">No discrepancy data yet</div>
            </div>
          ) : (
            <div className="chart-container">
              {discrepancyTypeBreakdown.map((d, i) => {
                const maxCount = Math.max(
                  ...discrepancyTypeBreakdown.map((x) => x.count),
                  1
                );
                const labels = {
                  COD_SHORT_REMITTANCE: 'COD Short',
                  WEIGHT_DISPUTE: 'Weight Dispute',
                  PHANTOM_RTO_CHARGE: 'Phantom RTO',
                  OVERDUE_REMITTANCE: 'Overdue',
                  DUPLICATE_SETTLEMENT: 'Duplicate',
                };
                return (
                  <div className="chart-bar-row" key={d._id}>
                    <div className="chart-label">{labels[d._id] || d._id}</div>
                    <div className="chart-bar-track">
                      <div
                        className={`chart-bar-fill bar-${(i % 6) + 1}`}
                        style={{
                          width: `${(d.count / maxCount) * 100}%`,
                        }}
                      >
                        {d.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notification Stats */}
      {notifStats && (
        <div className="card" style={{ marginTop: 'var(--space-5)' }}>
          <div className="card-header">
            <h3 className="card-title">📧 Notification Summary</h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate('notifications')}
            >
              View All →
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 'var(--space-4)',
            }}
          >
            <div className="detail-item">
              <div className="detail-label">Total</div>
              <div className="detail-value">{notifStats.total}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Sent</div>
              <div className="detail-value" style={{ color: 'var(--accent-400)' }}>
                {notifStats.sent}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Queued</div>
              <div className="detail-value" style={{ color: 'var(--primary-400)' }}>
                {notifStats.queued + notifStats.retrying}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Failed</div>
              <div className="detail-value" style={{ color: 'var(--danger-400)' }}>
                {notifStats.failed}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Dead Letter</div>
              <div className="detail-value" style={{ color: 'var(--warning-400)' }}>
                {notifStats.deadLetter}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
