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
import Badge from '@cloudscape-design/components/badge';
import { api, PolicyRecord, HostedZone, TrafficPolicy } from '../lib/api';

export default function PolicyRecordsPage() {
  const [records, setRecords] = useState<PolicyRecord[]>([]);
  const [zones, setZones] = useState<HostedZone[]>([]);
  const [policies, setPolicies] = useState<TrafficPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PolicyRecord[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [selectedZone, setSelectedZone] = useState<{ label: string; value: string } | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<{ label: string; value: string } | null>(null);
  const [ttl, setTtl] = useState('60');

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [prRes, zRes, tpRes] = await Promise.all([
        api.get<PolicyRecord[]>('/policy-records/'),
        api.get<HostedZone[]>('/zones'),
        api.get<TrafficPolicy[]>('/traffic-policies/'),
      ]);
      setRecords(prRes.data);
      setZones(zRes.data);
      setPolicies(tpRes.data);
      if (zRes.data.length > 0 && !selectedZone) {
        setSelectedZone({ label: zRes.data[0].name, value: String(zRes.data[0].id) });
      }
      if (tpRes.data.length > 0 && !selectedPolicy) {
        setSelectedPolicy({
          label: `${tpRes.data[0].name} (v${tpRes.data[0].version})`,
          value: String(tpRes.data[0].id),
        });
      }
    } catch (err) {
      console.error('Failed to fetch policy records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = records.filter(
    (r) =>
      r.name.toLowerCase().includes(filterText.toLowerCase()) ||
      r.hosted_zone_name.toLowerCase().includes(filterText.toLowerCase()) ||
      r.traffic_policy_name.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleCreate = async () => {
    const z = zones.find((item) => String(item.id) === selectedZone?.value);
    const p = policies.find((item) => String(item.id) === selectedPolicy?.value);
    try {
      setSubmitting(true);
      await api.post('/policy-records/', {
        name: name.trim(),
        type: p?.dns_type || 'A',
        ttl: parseInt(ttl, 10) || 60,
        hosted_zone_id: z ? Number(z.id) : null,
        hosted_zone_name: z?.name || selectedZone?.label || 'example.com',
        traffic_policy_id: p ? Number(p.id) : null,
        traffic_policy_name: p?.name || 'Default',
        traffic_policy_version: p?.version || 1,
      });
      setCreateModalVisible(false);
      setName('');
      await fetchAll();
    } catch (err) {
      console.error('Failed to create policy record', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected[0]) return;
    try {
      setSubmitting(true);
      await api.delete(`/policy-records/${selected[0].id}`);
      setSelected([]);
      setDeleteModalVisible(false);
      await fetchAll();
    } catch (err) {
      console.error('Failed to delete policy record', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/dashboard' },
        { text: 'Policy records', href: '/policy-records' },
      ]}
    >
      <Table
        columnDefinitions={[
          { id: 'name', header: 'DNS name', cell: (item) => <Box variant="code">{item.name}</Box>, isRowHeader: true },
          { id: 'type', header: 'Type', cell: (item) => <Badge color="blue">{item.type}</Badge> },
          {
            id: 'policy',
            header: 'Traffic policy',
            cell: (item) => `${item.traffic_policy_name} (v${item.traffic_policy_version})`,
          },
          { id: 'ttl', header: 'TTL (seconds)', cell: (item) => item.ttl },
          { id: 'hostedZone', header: 'Hosted zone', cell: (item) => item.hosted_zone_name },
        ]}
        items={filtered}
        loading={loading}
        loadingText="Loading policy records..."
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        trackBy="id"
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Find policy record"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
            countText={filterText ? `${filtered.length} matches` : undefined}
          />
        }
        empty={
          <Box textAlign="center" color="inherit" margin={{ vertical: 'xs' }}>
            <SpaceBetween size="m">
              <b>No policy records</b>
              <Box color="text-status-inactive">
                Associate a traffic policy with a hosted zone to create a policy record.
              </Box>
              <Button onClick={() => setCreateModalVisible(true)}>Create policy record</Button>
            </SpaceBetween>
          </Box>
        }
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={`(${filtered.length})`}
            description="Policy records link a traffic policy version to a domain name in one of your hosted zones."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled={selected.length === 0} onClick={() => setDeleteModalVisible(true)}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => setCreateModalVisible(true)}>
                  Create policy record
                </Button>
              </SpaceBetween>
            }
          >
            Policy records
          </Header>
        }
      />

      <Modal
        visible={createModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
        header="Create policy record"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate} loading={submitting} disabled={!name.trim() || !selectedZone}>
                Create policy record
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Hosted zone">
            <Select
              selectedOption={selectedZone}
              onChange={({ detail }) => setSelectedZone(detail.selectedOption as any)}
              options={zones.map((z) => ({ label: z.name, value: String(z.id) }))}
              placeholder="Select a hosted zone"
            />
          </FormField>

          <FormField label="Traffic policy">
            <Select
              selectedOption={selectedPolicy}
              onChange={({ detail }) => setSelectedPolicy(detail.selectedOption as any)}
              options={policies.map((p) => ({
                label: `${p.name} (v${p.version} - ${p.dns_type})`,
                value: String(p.id),
              }))}
              placeholder={policies.length === 0 ? 'No traffic policies created yet (optional)' : 'Select a traffic policy'}
            />
          </FormField>

          <FormField label="Policy record DNS name" description="Example: www.example.com">
            <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="www.example.com" />
          </FormField>

          <FormField label="TTL (seconds)">
            <Input type="number" value={ttl} onChange={({ detail }) => setTtl(detail.value)} />
          </FormField>
        </SpaceBetween>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        onDismiss={() => setDeleteModalVisible(false)}
        header="Delete policy record"
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
        Are you sure you want to delete policy record <b>{selected[0]?.name}</b>?
      </Modal>
    </ConsoleLayout>
  );
}
