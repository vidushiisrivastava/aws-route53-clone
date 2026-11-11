import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'r53_access_token';
export const USER_STORAGE_KEY = 'r53_user';

export interface AuthUser {
  id: number;
  username: string;
  account_id?: string;
}

export interface FlashNotificationPayload {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  header: string;
  content?: string;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('r53-auth-changed', { detail: user }));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('r53-auth-changed', { detail: null }));
}

export function notify(payload: FlashNotificationPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('r53-notify', {
      detail: {
        ...payload,
        id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    })
  );
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== 'undefined' &&
      error?.response?.status === 401 &&
      !String(error?.config?.url || '').includes('/auth/')
    ) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface HostedZone {
  id: number | string;
  name: string;
  comment?: string;
  type?: string;
  zone_type?: string;
  vpc_id?: string | null;
  vpc_region?: string | null;
  record_count?: number;
  nameservers?: string[];
  created_at?: string;
}

export interface DNSRecord {
  id: number | string;
  hosted_zone_id?: string;
  zone_id?: number | string;
  name: string;
  type: string;
  routing_policy?: string;
  weight?: number | null;
  region?: string | null;
  failover?: string | null;
  health_check_id?: number | null;
  set_identifier?: string | null;
  ttl: number;
  value?: string;
  values?: string;
  is_alias?: boolean;
  created_at: string;
}

export interface HealthCheck {
  id: number | string;
  name: string;
  protocol: string;
  endpoint: string;
  port: number;
  resource_path?: string;
  request_interval: number;
  failure_threshold: number;
  status: string;
  status_reason?: string;
  last_checked_at?: string;
  created_at: string;
}

export interface TrafficPolicy {
  id: number | string;
  name: string;
  version: number;
  dns_type: string;
  comment?: string;
  document?: string;
  created_at: string;
}

export interface PolicyRecord {
  id: number | string;
  name: string;
  type: string;
  ttl: number;
  hosted_zone_id?: number | null;
  hosted_zone_name: string;
  traffic_policy_id?: number | null;
  traffic_policy_name: string;
  traffic_policy_version: number;
  created_at: string;
}

export interface ResolverEndpoint {
  id: number | string;
  name: string;
  direction: string;
  vpc_id: string;
  ip_addresses: string;
  status: string;
  created_at: string;
}

export interface ResolverRule {
  id: number | string;
  name: string;
  rule_type: string;
  domain_name: string;
  target_ip: string;
  vpc_id: string;
  status: string;
  created_at: string;
}

export interface Route53Profile {
  id: number | string;
  name: string;
  description?: string;
  status: string;
  vpc_associations: string;
  resource_count: number;
  created_at: string;
}
