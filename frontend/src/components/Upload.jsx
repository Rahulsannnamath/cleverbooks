import { useState, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Upload({ onUploadComplete }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [result, setResult] = useState(null);
  const [jsonInput, setJsonInput] = useState('');
  const [mode, setMode] = useState('csv'); // 'csv' or 'json'
  const fileInputRef = useRef(null);

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }

  function handleFileSelect(e) {
    if (e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  }

  async function uploadFile(file) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
      toast.error('Please upload a CSV or JSON file');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const records = Array.isArray(data) ? data : data.records || data.settlements || [];
        const res = await api.uploadSettlementsJSON(records, batchId || undefined);
        setResult(res);
        toast.success(res.message || 'Upload successful!');
      } else {
        const formData = new FormData();
        formData.append('file', file);
        if (batchId) formData.append('batchId', batchId);
        const res = await api.uploadSettlements(formData);
        setResult(res);
        toast.success(res.message || 'Upload successful!');
      }
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      toast.error(err.message);
      setResult({ success: false, error: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleJsonUpload() {
    if (!jsonInput.trim()) {
      toast.error('Please enter JSON data');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const data = JSON.parse(jsonInput);
      const records = Array.isArray(data) ? data : data.records || data.settlements || [];
      if (records.length === 0) {
        toast.error('No records found in JSON');
        return;
      }
      const res = await api.uploadSettlementsJSON(records, batchId || undefined);
      setResult(res);
      toast.success(res.message || 'Upload successful!');
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      if (err instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        toast.error(err.message);
      }
      setResult({ success: false, error: err.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Upload Settlements</h1>
        <p className="page-subtitle">
          Upload courier settlement records as CSV or JSON (max 1,000 rows per batch)
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="filter-bar">
        <div className="tab-group">
          <button
            className={`tab-item ${mode === 'csv' ? 'active' : ''}`}
            onClick={() => setMode('csv')}
          >
            📄 CSV File
          </button>
          <button
            className={`tab-item ${mode === 'json' ? 'active' : ''}`}
            onClick={() => setMode('json')}
          >
            📋 JSON Input
          </button>
        </div>

        <div style={{ flex: 1 }}></div>

        <div>
          <input
            className="input"
            style={{ width: '240px' }}
            placeholder="Batch ID (auto-generated if empty)"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />
        </div>
      </div>

      {mode === 'csv' ? (
        /* CSV Upload Zone */
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            className="file-input-hidden"
            onChange={handleFileSelect}
          />

          {uploading ? (
            <>
              <div className="loading-spinner lg"></div>
              <div className="upload-text" style={{ marginTop: '16px' }}>
                Uploading & processing...
              </div>
            </>
          ) : (
            <>
              <div className="upload-icon">📁</div>
              <div className="upload-text">
                Drag & drop your settlement CSV here
              </div>
              <div className="upload-hint">
                or click to browse • CSV/JSON files up to 5MB • Max 1,000 rows
              </div>
            </>
          )}
        </div>
      ) : (
        /* JSON Input */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Paste Settlement JSON</h3>
            <button
              className="btn btn-primary"
              onClick={handleJsonUpload}
              disabled={uploading || !jsonInput.trim()}
            >
              {uploading ? (
                <>
                  <span className="loading-spinner"></span> Uploading...
                </>
              ) : (
                <>📤 Upload JSON</>
              )}
            </button>
          </div>
          <textarea
            className="input"
            style={{
              minHeight: '300px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              resize: 'vertical',
            }}
            placeholder={`Paste an array of settlement records, e.g.:
[
  {
    "awbNumber": "AWB00000001",
    "settledCodAmount": 450,
    "chargedWeight": 1.5,
    "forwardCharge": 85,
    "rtoCharge": 0,
    "codHandlingFee": 15,
    "settlementDate": "2025-01-15"
  }
]`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
        </div>
      )}

      {/* CSV Format Guide */}
      <div className="card" style={{ marginTop: 'var(--space-5)' }}>
        <div className="card-header">
          <h3 className="card-title">📋 Expected CSV Format</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>awbNumber</th>
                <th>settledCodAmount</th>
                <th>chargedWeight</th>
                <th>forwardCharge</th>
                <th>rtoCharge</th>
                <th>codHandlingFee</th>
                <th>settlementDate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="td-mono">AWB00000001</td>
                <td>450.00</td>
                <td>1.5</td>
                <td>85.00</td>
                <td>0</td>
                <td>15.00</td>
                <td>2025-01-15</td>
              </tr>
              <tr>
                <td className="td-mono">AWB00000002</td>
                <td>1200.00</td>
                <td>2.3</td>
                <td>120.00</td>
                <td>75.00</td>
                <td>30.00</td>
                <td>2025-01-15</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Result */}
      {result && (
        <div
          className="card"
          style={{
            marginTop: 'var(--space-5)',
            borderLeft: `3px solid ${result.success ? 'var(--accent-500)' : 'var(--danger-500)'}`,
          }}
        >
          <div className="card-header">
            <h3 className="card-title">
              {result.success ? '✅ Upload Result' : '❌ Upload Error'}
            </h3>
          </div>
          {result.success ? (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">Batch ID</div>
                <div className="detail-value mono">{result.data?.batchId}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Total Records</div>
                <div className="detail-value">{result.data?.totalRecords}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Inserted</div>
                <div className="detail-value" style={{ color: 'var(--accent-400)' }}>
                  {result.data?.inserted}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Skipped</div>
                <div className="detail-value" style={{ color: 'var(--warning-400)' }}>
                  {result.data?.skipped}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--danger-400)', fontSize: '14px' }}>
              {result.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
