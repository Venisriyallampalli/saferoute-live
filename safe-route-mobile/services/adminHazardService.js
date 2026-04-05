import { apiRequest } from './apiClient';

export async function fetchAdminHazards(status = 'all') {
  const query = new URLSearchParams({ status, limit: '200' });
  const data = await apiRequest(`/api/safety/admin/hazards?${query.toString()}`);
  return Array.isArray(data?.hazards) ? data.hazards : [];
}

export async function updateAdminHazard(hazardId, updates) {
  if (!hazardId) {
    throw new Error('Hazard id is required');
  }

  const payload = {};
  if (typeof updates?.isActive === 'boolean') {
    payload.isActive = updates.isActive;
  }

  if (typeof updates?.severity === 'string') {
    payload.severity = updates.severity;
  }

  if (typeof updates?.description === 'string') {
    payload.description = updates.description;
  }

  return apiRequest(`/api/safety/admin/hazards/${encodeURIComponent(hazardId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
