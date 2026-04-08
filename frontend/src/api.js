const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || `Request failed: ${response.status}`);
    }

    return data;
  }

  // Settlements
  async uploadSettlements(formData) {
    return this.request('/settlements/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadSettlementsJSON(records, batchId, orders) {
    const body = { records, batchId };
    if (orders && orders.length > 0) body.orders = orders;
    return this.request('/settlements/upload', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getSettlements(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/settlements?${query}`);
  }

  async getSettlementDetail(awbNumber) {
    return this.request(`/settlements/${awbNumber}`);
  }

  async getSettlementStats() {
    return this.request('/settlements/stats/summary');
  }

  async exportSettlementsCSV(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE}/settlements/export/csv?${query}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `settlements_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  }

  // Jobs
  async getJobs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/jobs?${query}`);
  }

  async triggerReconciliation() {
    return this.request('/jobs/trigger', { method: 'POST' });
  }

  // Notifications
  async getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/notifications?${query}`);
  }

  async getNotificationStats() {
    return this.request('/notifications/stats');
  }

  async retryNotification(id) {
    return this.request(`/notifications/${id}/retry`, { method: 'POST' });
  }
}

const api = new ApiClient();
export default api;
