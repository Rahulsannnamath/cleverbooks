import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function JobLogs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    try {
      const res = await api.getJobs({ limit: 10 });
      setJobs(res.data.jobs);
    } catch (err) {
      toast.error('Failed to load job logs');
    } finally {
      setLoading(false);
    }
  }

  async function handleReconcile() {
    setReconciling(true);
    try {
      await api.triggerReconciliation();
      toast.success('Reconciliation completed!');
      fetchJobs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReconciling(false);
    }
  }

  function formatDateTime(date) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  function getDuration(startedAt, completedAt) {
    if (!startedAt || !completedAt) return '—';
    const ms = new Date(completedAt) - new Date(startedAt);
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function getStatusBadge(status) {
    const map = {
      COMPLETED: 'badge-completed',
      RUNNING: 'badge-running',
      FAILED: 'badge-failed',
    };
    return <span className={`badge ${map[status] || ''}`}>{status}</span>;
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div className="action-bar">
          <div>
            <h1 className="page-title">Reconciliation Jobs</h1>
            <p className="page-subtitle">
              Last 10 reconciliation runs with detailed stats
            </p>
          </div>
          <div className="action-group">
            <button
              className="btn btn-ghost btn-sm"
              onClick={fetchJobs}
            >
              🔄 Refresh
            </button>
            <button
              className="btn btn-primary"
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
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner lg"></div>
            <div className="loading-text">Loading job logs...</div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚙️</div>
            <div className="empty-title">No reconciliation jobs yet</div>
            <div className="empty-description">
              Click "Run Reconciliation" to process pending settlements
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Started At</th>
                  <th>Status</th>
                  <th>Trigger</th>
                  <th>Duration</th>
                  <th>Total Records</th>
                  <th>Matched</th>
                  <th>Discrepancies</th>
                  <th>Pending Review</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job._id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {formatDateTime(job.startedAt)}
                    </td>
                    <td>{getStatusBadge(job.status)}</td>
                    <td>
                      <span
                        className={`badge ${
                          job.trigger === 'MANUAL' ? 'badge-queued' : 'badge-pending'
                        }`}
                      >
                        {job.trigger}
                      </span>
                    </td>
                    <td className="td-mono">
                      {getDuration(job.startedAt, job.completedAt)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{job.totalRecords}</td>
                    <td style={{ color: 'var(--accent-400)', fontWeight: 600 }}>
                      {job.matchedCount}
                    </td>
                    <td style={{ color: 'var(--danger-400)', fontWeight: 600 }}>
                      {job.discrepancyCount}
                    </td>
                    <td style={{ color: 'var(--orange-400)', fontWeight: 600 }}>
                      {job.pendingReviewCount}
                    </td>
                    <td style={{ color: 'var(--danger-400)', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.errorMessage || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
