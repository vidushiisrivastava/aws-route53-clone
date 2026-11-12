import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearSession,
  getHostedZoneType,
  getStoredToken,
  getStoredUser,
  hostedZoneHref,
  notify,
  saveSession,
  validateDomainName,
} from '../../app/lib/api';

describe('Route 53 helper functions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('validateDomainName', () => {
    it('accepts valid domain names with optional trailing dot and subdomains', () => {
      expect(validateDomainName('example.com')).toBe('');
      expect(validateDomainName('example.com.')).toBe('');
      expect(validateDomainName('api.prod-1.internal.co.uk')).toBe('');
      expect(validateDomainName('  my-service.dev.  ')).toBe('');
    });

    it('rejects empty and malformed domain names', () => {
      expect(validateDomainName('')).toBe('Domain name is required.');
      expect(validateDomainName('   ')).toBe('Domain name is required.');
      expect(validateDomainName('invalid domain')).toMatch(/valid domain name/i);
      expect(validateDomainName('foo..bar.com')).toMatch(/valid domain name/i);
      expect(validateDomainName('-leading.com')).toMatch(/valid domain name/i);
      expect(validateDomainName('bad!.example.com')).toMatch(/valid domain name/i);
    });
  });

  describe('getHostedZoneType', () => {
    it('prioritizes zone_type over type and defaults to Public', () => {
      expect(getHostedZoneType({ zone_type: 'Private', type: 'Public' })).toBe('Private');
      expect(getHostedZoneType({ type: 'private' })).toBe('Private');
      expect(getHostedZoneType({ type: 'Public' })).toBe('Public');
      expect(getHostedZoneType({})).toBe('Public');
      expect(getHostedZoneType(null)).toBe('Public');
    });
  });

  describe('hostedZoneHref', () => {
    it('formats clean domain paths and disambiguates duplicate domain names with ?id=', () => {
      const z1 = { id: 1, name: 'example.com.' };
      const z2 = { id: 2, name: 'example.com' };
      const z3 = { id: 3, name: 'unique.org' };

      expect(hostedZoneHref(z1)).toBe('/hosted-zones/example.com');
      expect(hostedZoneHref(z1, [z1, z3])).toBe('/hosted-zones/example.com');
      expect(hostedZoneHref(z1, [z1, z2, z3])).toBe('/hosted-zones/example.com?id=1');
      expect(hostedZoneHref(z2, [z1, z2, z3])).toBe('/hosted-zones/example.com?id=2');
      expect(hostedZoneHref({ id: 9, name: '' })).toBe('/hosted-zones/9');
    });
  });

  describe('session and notification helpers', () => {
    it('saves, reads, and clears session state while dispatching r53-auth-changed', () => {
      const authSpy = vi.fn();
      window.addEventListener('r53-auth-changed', authSpy);

      saveSession('jwt-abc-123', { id: 7, username: 'Vidushi', account_id: '1793-0234-9211' });
      expect(getStoredToken()).toBe('jwt-abc-123');
      expect(getStoredUser()).toEqual({
        id: 7,
        username: 'Vidushi',
        account_id: '1793-0234-9211',
      });
      expect(authSpy).toHaveBeenCalledTimes(1);

      clearSession();
      expect(getStoredToken()).toBeNull();
      expect(getStoredUser()).toBeNull();
      expect(authSpy).toHaveBeenCalledTimes(2);

      window.removeEventListener('r53-auth-changed', authSpy);
    });

    it('dispatches r53-notify custom events with generated IDs', () => {
      const notifySpy = vi.fn();
      window.addEventListener('r53-notify', notifySpy);

      notify({ type: 'success', header: 'Zone created', content: 'example.com' });
      expect(notifySpy).toHaveBeenCalledTimes(1);
      const event = notifySpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.type).toBe('success');
      expect(event.detail.header).toBe('Zone created');
      expect(event.detail.id).toBeTruthy();

      window.removeEventListener('r53-notify', notifySpy);
    });
  });
});

