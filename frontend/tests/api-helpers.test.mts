import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

const {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  api,
  clearSession,
  getHostedZoneType,
  getStoredToken,
  getStoredUser,
  hostedZoneHref,
  notify,
  saveSession,
  validateDomainName,
} = (await import(new URL('../app/lib/api.ts', import.meta.url).href)) as typeof import('../app/lib/api');

interface DispatchedEvent {
  type: string;
  detail: unknown;
}

function installMockWindow(initialPathname = '/') {
  const storage = new Map<string, string>();
  const events: DispatchedEvent[] = [];

  class MockCustomEvent<T = unknown> {
    type: string;
    detail: T;
    constructor(type: string, init?: { detail?: T }) {
      this.type = type;
      this.detail = init?.detail as T;
    }
  }

  const mockWindow = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
    location: {
      pathname: initialPathname,
      href: `http://localhost:3000${initialPathname}`,
    },
    dispatchEvent: (event: DispatchedEvent) => {
      events.push(event);
      return true;
    },
  };

  Object.defineProperty(globalThis, 'window', {
    value: mockWindow,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: MockCustomEvent,
    configurable: true,
    writable: true,
  });

  return { storage, events, mockWindow };
}

function uninstallMockWindow() {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'CustomEvent');
}

afterEach(() => {
  uninstallMockWindow();
});

test('getHostedZoneType resolves zone_type, type, and Public fallback', () => {
  assert.equal(getHostedZoneType({ zone_type: 'Private' }), 'Private');
  assert.equal(getHostedZoneType({ zone_type: 'private' }), 'Private');
  assert.equal(getHostedZoneType({ type: 'Private' }), 'Private');
  assert.equal(getHostedZoneType({ zone_type: 'Public' }), 'Public');
  assert.equal(getHostedZoneType({}), 'Public');
  assert.equal(getHostedZoneType(null), 'Public');
});

test('hostedZoneHref builds domain-based slugs and disambiguates duplicates', () => {
  assert.equal(hostedZoneHref({ id: 7, name: 'example.com.' }), '/hosted-zones/example.com');
  assert.equal(hostedZoneHref({ id: 8, name: '' }), '/hosted-zones/8');

  const zones = [
    { id: 1, name: 'corp.internal' },
    { id: 2, name: 'corp.internal.' },
    { id: 3, name: 'unique.example.org' },
  ];
  assert.equal(hostedZoneHref(zones[2], zones), '/hosted-zones/unique.example.org');
  assert.equal(hostedZoneHref(zones[0], zones), '/hosted-zones/corp.internal?id=1');
  assert.equal(hostedZoneHref(zones[1], zones), '/hosted-zones/corp.internal?id=2');
});

test('validateDomainName enforces required and valid DNS domain syntax', () => {
  assert.equal(validateDomainName(''), 'Domain name is required.');
  assert.equal(validateDomainName('   '), 'Domain name is required.');
  assert.equal(validateDomainName('invalid domain!'), 'Enter a valid domain name (e.g. example.com).');
  assert.equal(validateDomainName('-leading.com'), 'Enter a valid domain name (e.g. example.com).');
  assert.equal(validateDomainName('example.com'), '');
  assert.equal(validateDomainName('sub.example-1.co.uk.'), '');
});

test('session helpers handle SSR safely and manage localStorage + auth events', () => {
  assert.equal(getStoredToken(), null);
  assert.equal(getStoredUser(), null);
  saveSession('ignored-on-ssr', { id: 1, username: 'ssr' });
  clearSession();
  notify({ type: 'info', header: 'SSR noop' });

  const { storage, events } = installMockWindow('/hosted-zones');
  saveSession('jwt-abc', { id: 1, username: 'Vidushi', account_id: '1793-0234-9211' });
  assert.equal(storage.get(TOKEN_STORAGE_KEY), 'jwt-abc');
  assert.equal(getStoredToken(), 'jwt-abc');
  assert.deepEqual(getStoredUser(), { id: 1, username: 'Vidushi', account_id: '1793-0234-9211' });
  assert.equal(events[0]?.type, 'r53-auth-changed');

  storage.set(USER_STORAGE_KEY, '{bad json');
  assert.equal(getStoredUser(), null);

  clearSession();
  assert.equal(getStoredToken(), null);
  assert.equal(getStoredUser(), null);
  assert.equal(events[1]?.type, 'r53-auth-changed');
  assert.equal(events[1]?.detail, null);

  notify({ type: 'success', header: 'Saved', content: 'Zone updated' });
  assert.equal(events[2]?.type, 'r53-notify');
  const detail = events[2]?.detail as { id: string; type: string; header: string };
  assert.equal(detail.type, 'success');
  assert.equal(detail.header, 'Saved');
  assert.ok(detail.id.length > 0);
});

test('axios request and response interceptors attach Bearer token and redirect on non-auth 401', async () => {
  const { mockWindow } = installMockWindow('/hosted-zones');
  saveSession('tok-123', { id: 2, username: 'alice' });

  let capturedAuthHeader = '';
  api.defaults.adapter = async (config) => {
    capturedAuthHeader = String(config.headers?.Authorization || '');
    return {
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  const okRes = await api.get('/zones/');
  assert.equal(okRes.data.ok, true);
  assert.equal(capturedAuthHeader, 'Bearer tok-123');

  // 401 on /auth/ endpoint should NOT clear session or redirect
  api.defaults.adapter = async (config) => {
    throw { response: { status: 401 }, config };
  };
  await assert.rejects(() => api.post('/auth/login-json', {}));
  assert.equal(getStoredToken(), 'tok-123');
  assert.equal(mockWindow.location.href, 'http://localhost:3000/hosted-zones');

  // 401 on non-auth endpoint MUST clear session and redirect to /login
  await assert.rejects(() => api.get('/zones/'));
  assert.equal(getStoredToken(), null);
  assert.equal(mockWindow.location.href, '/login');
});

