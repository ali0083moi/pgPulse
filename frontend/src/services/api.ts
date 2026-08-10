import { DiscoveredSource, QueryResultPayload, SchemaTreeResponse, UsersResponse } from '../types';

export async function fetchDiscovery(): Promise<{
  dockerSources: DiscoveredSource[];
  localSources: DiscoveredSource[];
  manualSources: DiscoveredSource[];
}> {
  const res = await fetch('/api/discovery');
  if (!res.ok) throw new Error('Failed to discover sources');
  return res.json();
}

export async function connectSource(config: {
  id: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}): Promise<{ success: boolean; message: string; version?: string }> {
  const res = await fetch('/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Connection failed');
  return data;
}

export async function switchDatabase(
  sourceId: string,
  database: string
): Promise<{ success: boolean; message: string; databases: string[]; schemas: string[]; tables: any[]; foreignKeys: any[] }> {
  const res = await fetch('/api/switch-database', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, database }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to switch database');
  return data;
}

export async function executeSql(
  sourceId: string,
  sql: string,
  superuserCreds?: { user?: string; password?: string }
): Promise<QueryResultPayload> {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, sql, superuserCreds }),
  });
  return res.json();
}

export async function fetchSchema(sourceId: string): Promise<SchemaTreeResponse> {
  const res = await fetch(`/api/schema?sourceId=${encodeURIComponent(sourceId)}`);
  if (!res.ok) throw new Error('Failed to fetch schema');
  return res.json();
}

export async function fetchUsers(
  sourceId: string,
  superUser?: string,
  superPass?: string
): Promise<UsersResponse> {
  let url = `/api/users?sourceId=${encodeURIComponent(sourceId)}`;
  if (superUser) url += `&superUser=${encodeURIComponent(superUser)}`;
  if (superPass) url += `&superPass=${encodeURIComponent(superPass)}`;
  const res = await fetch(url);
  return res.json();
}

export async function createUser(
  sourceId: string,
  data: { username: string; password?: string; isSuperuser?: boolean; canCreateDb?: boolean },
  superuserCreds?: { user?: string; password?: string }
) {
  const res = await fetch('/api/users/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, data, superuserCreds }),
  });
  return res.json();
}

export async function changePassword(
  sourceId: string,
  data: { username: string; newPassword: string },
  superuserCreds?: { user?: string; password?: string }
) {
  const res = await fetch('/api/users/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, data, superuserCreds }),
  });
  return res.json();
}

export async function togglePrivilege(
  sourceId: string,
  data: { username: string; database: string; grant: boolean },
  superuserCreds?: { user?: string; password?: string }
) {
  const res = await fetch('/api/users/grant-privileges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, data, superuserCreds }),
  });
  return res.json();
}

export async function resetSystemPassword(data: {
  containerId?: string;
  port?: number;
  username: string;
  newPassword: string;
  sudoPassword?: string;
}) {
  const res = await fetch('/api/users/reset-system-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
