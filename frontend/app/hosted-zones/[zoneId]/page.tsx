'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import TextFilter from '@cloudscape-design/components/text-filter';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Textarea from '@cloudscape-design/components/textarea';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Container from '@cloudscape-design/components/container';
import Badge from '@cloudscape-design/components/badge';
import Alert from '@cloudscape-design/components/alert';




import ConsoleLayout from '../../components/ConsoleLayout';
import { api, HostedZone, DNSRecord } from '../../lib/api';

const RECORD_TYPES = [
  { label: 'A - Routes traffic to an IPv4 address and some AWS resources', value: 'A' },
  { label: 'AAAA - Routes traffic to an IPv6 address and some AWS resources', value: 'AAAA' },
  { label: 'CNAME - Routes traffic to another domain name', value: 'CNAME' },
  { label: 'MX - Specifies mail servers', value: 'MX' },
  { label: 'TXT - Verifies domain ownership or configures SPF/DKIM', value: 'TXT' },
  { label: 'PTR - Maps an IP address to a domain name', value: 'PTR' },
  { label: 'SRV - Defines location of servers for specific services', value: 'SRV' },
  { label: 'CAA - Specifies which certificate authorities can issue certificates', value: 'CAA' },
];

export default function HostedZoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const zoneId = params?.zoneId as string;

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<DNSRecord[]>([]);

  // Modals state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New Record Form State
  const [recordSubdomain, setRecordSubdomain] = useState('');
  const [recordType, setRecordType] = useState(RECORD_TYPES[0]);
  const [recordTtl, setRecordTtl] = useState('300');
  const [recordValue, setRecordValue] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [zoneRes, recordsRes] = await Promise.all([
        api.get<HostedZone>(`/api/hosted-zones/${zoneId}`),
        api.get<DNSRecord[]>(`/api/hosted-zones/${zoneId}/records`),
      ]);
      setZone(zoneRes.data);
      setRecords(recordsRes.data);
    } catch (err) {
      console.error('Failed to load zone details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zoneId) {
      loadData();
    }
  }, [zoneId]);

  const handleCreateRecord = async () => {
    
    setModalError('');

    if (!recordValue.trim()) {
      setModalError('Value is required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/api/hosted-zones/${zoneId}/records`, {
        name: recordSubdomain.trim(),
        type: recordType.value,
        ttl: parseInt(recordTtl, 10) || 300,
        values: recordValue.trim(),
        routing_policy: 'Simple',
      });
      setCreateModalVisible(false);
      setRecordSubdomain('');
      setRecordValue('');
      await loadData();
    } catch (err: any) {
      setModalError(err?.response?.data?.detail || 'Failed to create DNS record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (selectedRecords.length === 0) return;
    try {
      setSubmitting(true);
      await api.delete(`/api/hosted-zones/${zoneId}/records/${selectedRecords[0].id}`);
      setSelectedRecords([]);
      setDeleteModalVisible(false);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to delete record.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.name.toLowerCase().includes(filterText.toLowerCase()) ||
      r.type.toLowerCase().includes(filterText.toLowerCase()) ||
      r.values.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/' },
        { text: 'Hosted zones', href: '/hosted-zones' },
        { text: zone ? zone.name : zoneId, href: `/hosted-zones/${zoneId}` },
      ]}
    >
      <SpaceBetween size="l">
        {/* Hosted Zone Summary Card */}
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <Button onClick={() => router.push('/hosted-zones')}>
                  Back to Hosted zones
                </Button>
              }
            >
              Hosted zone details
            </Header>
          }
        >
          <KeyValuePairs
            columns={4}
            items={[
              { label: 'Hosted zone name', value: zone?.name || '-' },
              { label: 'Hosted zone ID', value: zone?.id || '-' },
              {
                label: 'Type',
                value: (
                  <Badge color={zone?.type === 'Public' ? 'blue' : 'grey'}>
                    {zone?.type || '-'}
                  </Badge>
                ),
              },
              { label: 'Total records', value: records.length.toString() },
            ]}
          />
        </Container>

        {/* DNS Records Table */}
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: 'Record name',
              cell: (item) => <Box variant="code">{item.name}</Box>,
              isRowHeader: true,
            },
            {
              id: 'type',
              header: 'Type',
              cell: (item) => <Badge color="blue">{item.type}</Badge>,
            },
            {
              id: 'routing_policy',
              header: 'Routing policy',
              cell: (item) => item.routing_policy,
            },
            {
              id: 'ttl',
              header: 'TTL (seconds)',
              cell: (item) => item.ttl,
            },
            {
              id: 'values',
              header: 'Value/Route traffic to',
              cell: (item) => (
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
                  {item.values}
                </div>
              ),
            },
          ]}
          items={filteredRecords}
          loading={loading}
          loadingText="Loading DNS records..."
          selectionType="single"
          selectedItems={selectedRecords}
          onSelectionChange={({ detail }) => setSelectedRecords(detail.selectedItems)}
          trackBy="id"
          filter={
            <TextFilter
              filteringPlaceholder="Search records by name, type, or value"
              filteringText={filterText}
              onChange={({ detail }) => setFilterText(detail.filteringText)}
              countText={`${filteredRecords.length} matches`}
            />
          }
          header={
            <Header
              variant="awsui-h1-sticky"
              counter={`(${filteredRecords.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={
                      selectedRecords.length === 0 ||
                      selectedRecords[0]?.type === 'SOA' ||
                      (selectedRecords[0]?.type === 'NS' && selectedRecords[0]?.name === `${zone?.name}.`)
                    }
                    onClick={() => setDeleteModalVisible(true)}
                  >
                    Delete record
                  </Button>
                  <Button variant="primary" onClick={() => setCreateModalVisible(true)}>
                    Create record
                  </Button>
                </SpaceBetween>
              }
            >
              Records
            </Header>
          }
        />
      </SpaceBetween>

      {/* Quick Create Record Modal */}
      <Modal
        onDismiss={() => setCreateModalVisible(false)}
        visible={createModalVisible}
        closeAriaLabel="Close modal"
        size="medium"
        header="Quick create record"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateRecord} loading={submitting}>
                Create records
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {modalError && <Alert type="error">{modalError}</Alert>}

          <FormField
            label="Record name"
            description={`Leave blank to route traffic to the root apex (${zone?.name}).`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input
                value={recordSubdomain}
                onChange={({ detail }) => setRecordSubdomain(detail.value)}
                placeholder="e.g. api, www, mail"
              />
              <span style={{ color: '#545b64', fontWeight: 600 }}>.{zone?.name}</span>
            </div>
          </FormField>

          <FormField label="Record type">
            <Select
              selectedOption={recordType}
              onChange={({ detail }) => setRecordType(detail.selectedOption as any)}
              options={RECORD_TYPES}
            />
          </FormField>

          <FormField label="TTL (seconds)" description="Time to live in DNS caches.">
            <Input
              type="number"
              value={recordTtl}
              onChange={({ detail }) => setRecordTtl(detail.value)}
            />
          </FormField>

          <FormField
            label="Value / Route traffic to"
            description="Enter one value per line (e.g. IP address for A record, domain for CNAME)."
          >
            <Textarea
              value={recordValue}
              onChange={({ detail }) => setRecordValue(detail.value)}
              placeholder="192.0.2.44&#10;198.51.100.2"
              rows={4}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Delete Record Modal */}
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        header="Delete record"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDeleteRecord} loading={submitting}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Are you sure you want to delete record <b>{selectedRecords[0]?.name}</b> ({selectedRecords[0]?.type})?
      </Modal>
    </ConsoleLayout>
  );
}