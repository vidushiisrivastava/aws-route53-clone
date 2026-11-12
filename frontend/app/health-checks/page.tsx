'use client';

import React, { useState, useEffect } from 'react';
import ConsoleLayout from '../components/ConsoleLayout';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import TextFilter from '@cloudscape-design/components/text-filter';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import { api, HealthCheck, notify } from '../lib/api';

export default function HealthChecksPage() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HealthCheck[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingId, setCheckingId] = useState<string | number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [protocol, setProtocol] = useState({ label: 'HTTPS', value: 'HTTPS' });
  const [port, setPort] = useState('443');
  const [resourcePath, setResourcePath] = useState('/');
  const [interval, setInterval] = useState('30');
  const [threshold, setThreshold] = useState('3');

  const fetchHealthChecks = async () => {
    try {
      setLoading(true);
      const res = await api.get<HealthCheck[]>('/health-checks/');
      setHealthChecks(res.data);
    } catch (err) {
      console.error('Failed to fetch health checks', err);
      notify({ type: 'error', header: 'Failed to load health checks', content: 'Please check your session and try again.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthChecks();
  }, []);

  const filtered = healthChecks.filter(
    (h) =>
      h.name.toLowerCase().includes(filterText.toLowerCase()) ||
      h.endpoint.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleProtocolChange = (val: string) => {
    setProtocol({ label: val, value: val });
    if (val === 'HTTPS') setPort('443');
    else if (val === 'HTTP') setPort('80');
  };

  const handleCreate = async () => {
    const trimmedEndpoint = endpoint.trim();
    const parsedPort = parseInt(port, 10) || (protocol.value === 'HTTPS' ? 443 : 80);
    if (!trimmedEndpoint) {
      notify({ type: 'error', header: 'Validation error', content: 'Domain name or IP endpoint is required.' });
      return;
    }
    if (parsedPort < 1 || parsedPort > 65535) {
      notify({ type: 'error', header: 'Validation error', content: 'Port must be between 1 and 65535.' });
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/health-checks/', {
        name: name.trim(),
        protocol: protocol.value,
        endpoint: trimmedEndpoint,
        port: parsedPort,
        resource_path: resourcePath.trim() || '/',
        request_interval: parseInt(interval, 10) || 30,
        failure_threshold: parseInt(threshold, 10) || 3,
      });
      setCreateModalVisible(false);
      setName('');
      setEndpoint('');
      setResourcePath('/');
      notify({ type: 'success', header: 'Health check created', content: `Created health check for ${trimmedEndpoint}.` });
      await fetchHealthChecks();
    } catch (err) {
      console.error('Failed to create health check', err);
      notify({ type: 'error', header: 'Failed to create health check', content: 'Verify endpoint format and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckNow = async () => {
    if (!selected[0]) return;
    try {
      setCheckingId(selected[0].id);
      const res = await api.post<HealthCheck>(`/health-checks/${selected[0].id}/check`);
      setHealthChecks((prev) => prev.map((h) => (h.id === res.data.id ? res.data : h)));
      setSelected([res.data]);
      notify({
        type: res.data.status === 'Healthy' ? 'success' : 'warning',
        header: `Health check ${res.data.status}`,
        content: res.data.status_reason || `Probed ${res.data.endpoint}`,
      });
    } catch (err) {
      console.error('Failed to run health check', err);
      notify({ type: 'error', header: 'Health check probe failed', content: 'Unable to probe endpoint right now.' });
    } finally {
      setCheckingId(null);
    }
  };

  const handleDelete = async () => {
    if (!selected[0]) return;
    try {
      setSubmitting(true);
      const targetName = selected[0].name;
      await api.delete(`/health-checks/${selected[0].id}`);
      setSelected([]);
      setDeleteModalVisible(false);
      notify({ type: 'success', header: 'Health check deleted', content: `Deleted "${targetName}".` });
      await fetchHealthChecks();
    } catch (err) {
      console.error('Failed to delete health check', err);
      notify({ type: 'error', header: 'Failed to delete health check', content: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = (status: string) => {
    if (status === 'Healthy') return <StatusIndicator type="success">Healthy</StatusIndicator>;
    if (status === 'Unhealthy') return <StatusIndicator type="error">Unhealthy</StatusIndicator>;
    return <StatusIndicator type="pending">Checking</StatusIndicator>;
  };

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/dashboard' },
        { text: 'Health checks', href: '/health-checks' },
      ]}
      contentType="default"
    >
      <SpaceBetween size="l">
        <Table
          columnDefinitions={[
            { id: 'name', header: 'Name', cell: (item) => item.name, isRowHeader: true },
            { id: 'id', header: 'Health check ID', cell: (item) => <Box variant="code">{item.id}</Box> },
            { id: 'type', header: 'Protocol', cell: (item) => item.protocol },
            { id: 'endpoint', header: 'Domain name / IP', cell: (item) => <Box variant="code">{item.endpoint}</Box> },
            { id: 'port', header: 'Port', cell: (item) => item.port },
            { id: 'interval', header: 'Request interval', cell: (item) => `${item.request_interval}s` },
            { id: 'threshold', header: 'Failure threshold', cell: (item) => item.failure_threshold },
            { id: 'status', header: 'Status', cell: (item) => renderStatus(item.status) },
          ]}
          items={filtered}
          loading={loading}
          loadingText="Loading health checks..."
          selectionType="single"
          selectedItems={selected}
          onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
          trackBy="id"
          filter={
            <TextFilter
              controlId="health-checks-filter"
              filteringAriaLabel="Find health check"
              filteringText={filterText}
              filteringPlaceholder="Find health check"
              onChange={({ detail }) => setFilterText(detail.filteringText)}
              countText={filterText ? `${filtered.length} matches` : undefined}
            />
          }
          empty={
            <Box textAlign="center" color="inherit" margin={{ vertical: 'xs' }}>
              <SpaceBetween size="m">
                <b>No health checks</b>
                <Box color="text-status-inactive">
                  Create a health check to monitor the health of your endpoints and configure DNS failover.
                </Box>
                <Button onClick={() => setCreateModalVisible(true)}>Create health check</Button>
              </SpaceBetween>
            </Box>
          }
          header={
            <Header
              variant="awsui-h1-sticky"
              counter={`(${filtered.length})`}
              description="Route 53 monitors the health of your resources and routes traffic only to healthy endpoints."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={selected.length === 0}
                    loading={checkingId !== null}
                    onClick={handleCheckNow}
                  >
                    Run health check
                  </Button>
                  <Button disabled={selected.length === 0} onClick={() => setDeleteModalVisible(true)}>
                    Delete
                  </Button>
                  <Button variant="primary" onClick={() => setCreateModalVisible(true)}>
                    Create health check
                  </Button>
                </SpaceBetween>
              }
            >
              Health checks
            </Header>
          }
        />

        {selected[0] ? (
          <Container header={<Header variant="h2">Health check details: {selected[0].name}</Header>}>
            <ColumnLayout columns={4} variant="text-grid">
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Status</Box>
                {renderStatus(selected[0].status)}
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Endpoint</Box>
                <Box variant="code">
                  {selected[0].protocol.toLowerCase()}://{selected[0].endpoint}:{selected[0].port}
                  {selected[0].resource_path || '/'}
                </Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Last check result</Box>
                <Box>{selected[0].status_reason || '-'}</Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Last checked</Box>
                <Box>
                  {selected[0].last_checked_at
                    ? new Date(selected[0].last_checked_at).toLocaleString()
                    : '-'}
                </Box>
              </SpaceBetween>
            </ColumnLayout>
          </Container>
        ) : null}
      </SpaceBetween>

      {/* Create Modal */}
      <Modal
        visible={createModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
        header="Create health check"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate} loading={submitting} disabled={!endpoint.trim()}>
                Create health check
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Name" description="An optional friendly name for this health check.">
            <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="my-health-check" />
          </FormField>

          <ColumnLayout columns={2}>
            <FormField label="Protocol">
              <Select
                selectedOption={protocol}
                onChange={({ detail }) => handleProtocolChange(detail.selectedOption.value!)}
                options={[
                  { label: 'HTTP', value: 'HTTP' },
                  { label: 'HTTPS', value: 'HTTPS' },
                  { label: 'TCP', value: 'TCP' },
                ]}
              />
            </FormField>

            <FormField label="Port">
              <Input type="number" value={port} onChange={({ detail }) => setPort(detail.value)} />
            </FormField>
          </ColumnLayout>

          <FormField
            label="Domain name or IP address"
            description="Enter the endpoint that Route 53 will probe (e.g., example.com)."
          >
            <Input value={endpoint} onChange={({ detail }) => setEndpoint(detail.value)} placeholder="example.com" />
          </FormField>

          {protocol.value !== 'TCP' ? (
            <FormField label="Path" description="The path that you want Route 53 to request when checking health.">
              <Input value={resourcePath} onChange={({ detail }) => setResourcePath(detail.value)} placeholder="/health" />
            </FormField>
          ) : null}

          <ColumnLayout columns={2}>
            <FormField label="Request interval">
              <Select
                selectedOption={{ label: `${interval} seconds`, value: interval }}
                onChange={({ detail }) => setInterval(detail.selectedOption.value!)}
                options={[
                  { label: '10 seconds (Fast)', value: '10' },
                  { label: '30 seconds (Standard)', value: '30' },
                ]}
              />
            </FormField>

            <FormField label="Failure threshold" description="Consecutive failures before marking Unhealthy.">
              <Input type="number" value={threshold} onChange={({ detail }) => setThreshold(detail.value)} />
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={deleteModalVisible}
        onDismiss={() => setDeleteModalVisible(false)}
        header="Delete health check"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDelete} loading={submitting}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Are you sure you want to delete health check <b>{selected[0]?.name}</b>?
      </Modal>
    </ConsoleLayout>
  );
}
