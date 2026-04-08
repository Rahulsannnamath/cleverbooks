import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'MATCHED', label: 'Matched' },
  { id: 'DISCREPANCY', label: 'Discrepancy' },
  { id: 'PENDING_REVIEW', label: 'Review' },
];

export default function Settlements() {
  const [settlements, setSettlements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [activeStatus, setActiveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAwb, setSelectedAwb] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchSettlements(1);
  }, [activeStatus]);

  async function fetchSettlements(page = 1) {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (activeStatus) params.status = activeStatus;
      const res = await api.getSettlements(params);
      setSettlements(res.data.settlements);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }

  async function handleViewDetail(awbNumber) {
    setSelectedAwb(awbNumber);
    setDetailLoading(true);
    try {
      const res = await api.getSettlementDetail(awbNumber);
      setDetail(res.data);
    } catch (err) {
      toast.error('Failed to load settlement detail');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedAwb(null);
    setDetail(null);
  }

  async function handleExport() {
    try {
      const params = {};
      if (activeStatus) params.status = activeStatus;
      await api.exportSettlementsCSV(params);
      toast.success('CSV exported successfully');
    } catch (err) {
      toast.error('Export failed');
    }
  }

  function getStatusBadge(status) {
    const map = {
      MATCHED: 'badge-matched',
      DISCREPANCY: 'badge-discrepancy',
      PENDING: 'badge-pending',
      PENDING_REVIEW: 'badge-pending-review',
    };
    return (
      <span className={`badge ${map[status] || 'badge-pending'}`}>
        {status === 'PENDING_REVIEW' ? 'REVIEW' : status}
      </span>
    );
  }

  function formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Settlements</h1>
        <p className="page-subtitle">
          View and filter all courier settlement records
        </p>
      </div>

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

        <button className="btn btn-ghost btn-sm" onClick={handleExport}>
          📥 Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner lg"></div>
            <div className="loading-text">Loading settlements...</div>
          </div>
        ) : settlements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No settlements found</div>
            <div className="empty-description">
              {activeStatus
                ? `No settlements with status "${activeStatus}"`
                : 'Upload a settlement batch to get started'}
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>AWB Number</th>
                    <th>Status</th>
                    <th>Courier</th>
                    <th>Settled COD</th>
                    <th>Expected COD</th>
                    <th>Charged Wt</th>
                    <th>Declared Wt</th>
                    <th>RTO Charge</th>
                    <th>Settlement Date</th>
                    <th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <span
                          className="td-link td-mono"
                          onClick={() => handleViewDetail(s.awbNumber)}
                        >
                          {s.awbNumber}
                        </span>
                      </td>
                      <td>{getStatusBadge(s.status)}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {s.order?.courierPartner || '—'}
                      </td>
                      <td className="td-mono">₹{s.settledCodAmount?.toFixed(2)}</td>
                      <td className="td-mono">
                        ₹{s.order?.codAmount?.toFixed(2) || '—'}
                      </td>
                      <td>{s.chargedWeight} kg</td>
                      <td>{s.order?.declaredWeight || '—'} kg</td>
                      <td className="td-mono">₹{s.rtoCharge?.toFixed(2)}</td>
                      <td>{formatDate(s.settlementDate)}</td>
                      <td className="td-mono" style={{ fontSize: '11px' }}>
                        {s.batchId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination" style={{ padding: '12px 16px' }}>
              <div className="pagination-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
              </div>
              <div className="pagination-controls">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchSettlements(pagination.page - 1)}
                >
                  ← Prev
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchSettlements(pagination.page + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAwb && (
        <div className="modal-backdrop" onClick={closeDetail}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Settlement Detail — {selectedAwb}</h2>
              <button className="modal-close" onClick={closeDetail}>
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="loading-overlay" style={{ padding: '40px' }}>
                <div className="loading-spinner lg"></div>
              </div>
            ) : detail ? (
              <>
                {/* Settlement Info */}
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)' }}>
                  SETTLEMENT RECORD
                </h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">AWB Number</div>
                    <div className="detail-value mono">{detail.settlement.awbNumber}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Status</div>
                    <div className="detail-value">
                      {getStatusBadge(detail.settlement.status)}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Settled COD Amount</div>
                    <div className="detail-value">₹{detail.settlement.settledCodAmount?.toFixed(2)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Charged Weight</div>
                    <div className="detail-value">{detail.settlement.chargedWeight} kg</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Forward Charge</div>
                    <div className="detail-value">₹{detail.settlement.forwardCharge?.toFixed(2)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">RTO Charge</div>
                    <div className="detail-value">₹{detail.settlement.rtoCharge?.toFixed(2)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">COD Handling Fee</div>
                    <div className="detail-value">₹{detail.settlement.codHandlingFee?.toFixed(2)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Batch ID</div>
                    <div className="detail-value mono" style={{ fontSize: '12px' }}>
                      {detail.settlement.batchId}
                    </div>
                  </div>
                </div>

                {/* Order Info */}
                {detail.order && (
                  <>
                    <div className="section-divider"></div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)' }}>
                      ORDER RECORD (MERCHANT EXPECTED)
                    </h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <div className="detail-label">Merchant ID</div>
                        <div className="detail-value mono">{detail.order.merchantId}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Courier Partner</div>
                        <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                          {detail.order.courierPartner}
                        </div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Order Status</div>
                        <div className="detail-value">{detail.order.orderStatus}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Expected COD</div>
                        <div className="detail-value">₹{detail.order.codAmount?.toFixed(2)}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Declared Weight</div>
                        <div className="detail-value">{detail.order.declaredWeight} kg</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">Delivery Date</div>
                        <div className="detail-value">{formatDate(detail.order.deliveryDate)}</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Discrepancies */}
                {detail.settlement.discrepancies?.length > 0 && (
                  <>
                    <div className="section-divider"></div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--danger-400)' }}>
                      ⚠️ DISCREPANCIES ({detail.settlement.discrepancies.length})
                    </h3>
                    <div className="discrepancy-list">
                      {detail.settlement.discrepancies.map((d, i) => (
                        <div className="discrepancy-card" key={i}>
                          <div className="discrepancy-rule">{d.rule?.replace(/_/g, ' ')}</div>
                          <div className="discrepancy-desc">{d.description}</div>
                          <div className="discrepancy-values">
                            <div>
                              <span>Expected: </span>
                              <strong>{String(d.expected)}</strong>
                            </div>
                            <div>
                              <span>Actual: </span>
                              <strong>{String(d.actual)}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
