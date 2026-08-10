export interface ConfigData {
  telegram_bot_token: string;
  telegram_chat_id: string;
  oci_user: string;
  oci_fingerprint: string;
  oci_tenancy: string;
  oci_region: string;
  oci_compartment_id: string;
  oci_subnet_id: string;
  oci_image_id: string;
  oci_ocpus?: string;
  oci_memory_gb?: string;
  private_key: string;
  ssh_public_key: string;
}

export interface StatusData {
  status: 'RUNNING' | 'STOPPED' | 'IDLE' | 'UNKNOWN';
  detail?: string;
  success_marker: boolean;
  is_configured: boolean;
  region?: string;
  subnet_id?: string;
}

const API_BASE = '/api';

export async function fetchStatus(): Promise<StatusData> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Status fetching failed');
  return res.json();
}

export async function fetchConfig(): Promise<ConfigData> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Config fetching failed');
  return res.json();
}

export async function saveConfig(data: Partial<ConfigData>): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'Saving failed');
  return json;
}

export async function startHunter(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/hunter/start`, { method: 'POST' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'Start failed');
  return json;
}

export async function stopHunter(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/hunter/stop`, { method: 'POST' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'Stop failed');
  return json;
}

export async function resetMarker(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/hunter/reset`, { method: 'POST' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'Reset failed');
  return json;
}

export async function testTelegram(botToken: string, chatId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/test/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_bot_token: botToken, telegram_chat_id: chatId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'Telegram test failed');
  return json;
}

export async function testOciConnection(): Promise<{ success: boolean; message: string; availability_domains?: string[] }> {
  const res = await fetch(`${API_BASE}/test/oci`, { method: 'POST' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'OCI connection test failed');
  return json;
}

export async function fetchLogs(lines: number = 150): Promise<{ logs: string[] }> {
  const res = await fetch(`${API_BASE}/logs?lines=${lines}`);
  if (!res.ok) throw new Error('Fetch logs failed');
  return res.json();
}
