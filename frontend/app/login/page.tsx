'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { api, getStoredToken, notify, saveSession } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [accountId, setAccountId] = useState('1793-0234-9211');
  const [username, setUsername] = useState('Vidushi');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (getStoredToken()) {
      router.replace('/hosted-zones');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    if (!username.trim() || !password) {
      setError('Enter both an IAM user name and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await api.post('/auth/register', {
          username: username.trim(),
          password,
        });
      }
      const res = await api.post('/auth/login-json', {
        username: username.trim(),
        password,
      });
      const { access_token, user } = res.data;
      saveSession(access_token, user);
      notify({
        type: 'success',
        header: `Signed in to AWS Route 53 as ${user.username}`,
        content: `Account ID: ${user.account_id || accountId}`,
      });
      router.push('/hosted-zones');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Authentication failed. Check your credentials and ensure the FastAPI backend is running.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setInfoMsg(null);
    setDemoLoading(true);
    try {
      const res = await api.post('/auth/demo');
      const { access_token, user } = res.data;
      saveSession(access_token, user);
      notify({
        type: 'success',
        header: `Signed in as Demo IAM User (${user.username})`,
        content: 'Session persisted in browser storage.',
      });
      router.push('/hosted-zones');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not sign in with demo account. Ensure FastAPI is running on port 8000.';
      setError(detail);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f141a',
        color: '#d1d5db',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Minimal AWS Header */}
      <div
        style={{
          height: '44px',
          backgroundColor: '#161d26',
          borderBottom: '1px solid #2b3543',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          onClick={() => router.push('/')}
        >
          <span style={{ fontWeight: 800, fontSize: '18px', color: '#ffffff', letterSpacing: '-0.5px' }}>
            aws
          </span>
          <span style={{ color: '#6b7280' }}>|</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e5e7eb' }}>
            Amazon Route 53 Management Console
          </span>
        </div>
        <Button variant="link" onClick={() => router.push('/')}>
          Back to Route 53 Overview
        </Button>
      </div>

      {/* Centered AWS IAM Sign-in Box */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '460px' }}>
          <SpaceBetween size="l">
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '8px',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
                  <path
                    d="M32 6L10 14V30C10 44.5 19.4 55.6 32 59C44.6 55.6 54 44.5 54 30V14L32 6Z"
                    stroke="#ff9900"
                    strokeWidth="3"
                    fill="#1b2430"
                  />
                  <text
                    x="32"
                    y="38"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="20"
                    fontWeight="700"
                    fontFamily="sans-serif"
                  >
                    53
                  </text>
                </svg>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                  Amazon Route 53
                </span>
              </div>
              <Box color="text-body-secondary" fontSize="body-s">
                Mocked AWS IAM Sign-In with persistent JWT session
              </Box>
            </div>

            <Container
              header={
                <Header
                  variant="h2"
                  description={
                    mode === 'login'
                      ? 'Sign in as an IAM user in your Route 53 account'
                      : 'Create a mocked IAM user stored in SQLite'
                  }
                >
                  {mode === 'login' ? 'Sign in as IAM user' : 'Create IAM user'}
                </Header>
              }
            >
              <form onSubmit={handleSubmit}>
                <SpaceBetween size="m">
                  {error ? <Alert type="error">{error}</Alert> : null}
                  {infoMsg ? <Alert type="info">{infoMsg}</Alert> : null}

                  <FormField
                    label="Account ID (12 digits)"
                    description="Mocked AWS account identifier"
                  >
                    <Input
                      value={accountId}
                      onChange={({ detail }) => setAccountId(detail.value)}
                      placeholder="1793-0234-9211"
                    />
                  </FormField>

                  <FormField label="IAM user name">
                    <Input
                      value={username}
                      onChange={({ detail }) => setUsername(detail.value)}
                      placeholder="Vidushi"
                      autoComplete="username"
                    />
                  </FormField>

                  <FormField label="Password">
                    <Input
                      type="password"
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                      placeholder="Enter password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                  </FormField>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        borderRadius: '20px',
                        border: 'none',
                        backgroundColor: '#ff9900',
                        color: '#0f141a',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      {loading
                        ? 'Authenticating...'
                        : mode === 'login'
                        ? 'Sign in'
                        : 'Create IAM user & Sign in'}
                    </button>

                    <Button
                      fullWidth
                      variant="normal"
                      loading={demoLoading}
                      onClick={handleDemoLogin}
                    >
                      1-Click Demo Sign-In (Vidushi)
                    </Button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #2b3543',
                      paddingTop: '12px',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: '#9ca3af' }}>
                      {mode === 'login' ? 'Need a separate user?' : 'Already have an IAM user?'}
                    </span>
                    <Button
                      variant="link"
                      onClick={() => {
                        setError(null);
                        if (mode === 'login') {
                          setMode('register');
                          setUsername('');
                          setPassword('');
                        } else {
                          setMode('login');
                          setUsername('Vidushi');
                          setPassword('demo1234');
                        }
                      }}
                    >
                      {mode === 'login' ? 'Create IAM user' : 'Sign in instead'}
                    </Button>
                  </div>
                </SpaceBetween>
              </form>
            </Container>
          </SpaceBetween>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          height: '32px',
          backgroundColor: '#0b0f14',
          borderTop: '1px solid #232f3e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          color: '#9ca3af',
        }}
      >
        © 2026, Amazon Route 53 Clone (Assignment Demo) • Mocked AWS IAM Authentication
      </div>
    </div>
  );
}

