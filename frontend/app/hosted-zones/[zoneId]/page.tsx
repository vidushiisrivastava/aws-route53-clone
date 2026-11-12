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
import Select, { SelectProps } from '@cloudscape-design/components/select';
import Textarea from '@cloudscape-design/components/textarea';
import Container from '@cloudscape-design/components/container';
import Badge from '@cloudscape-design/components/badge';
import Alert from '@cloudscape-design/components/alert';
import Pagination from '@cloudscape-design/components/pagination';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Toggle from '@cloudscape-design/components/toggle';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';

import ConsoleLayout from '../../components/ConsoleLayout';
import { api, HostedZone, DNSRecord, HealthCheck, notify, getHostedZoneType, hostedZoneHref, validateDomainName } from '../../lib/api';

const RECORD_TYPES = [
  { label: 'A – Routes traffic to an IPv4 address', value: 'A' },
  { label: 'AAAA – Routes traffic to an IPv6 address', value: 'AAAA' },
  { label: 'CNAME – Routes traffic to another domain name', value: 'CNAME' },
  { label: 'MX – Specifies mail servers', value: 'MX' },
  { label: 'TXT – Verifies domain ownership', value: 'TXT' },
  { label: 'PTR – Maps an IP to a domain name', value: 'PTR' },
  { label: 'SRV – Defines location of servers', value: 'SRV' },
  { label: 'CAA – Specifies certificate authorities', value: 'CAA' },
  { label: 'NS – Name server record', value: 'NS' },
  { label: 'SOA – Start of authority', value: 'SOA' },
];

const TYPE_FILTER_OPTIONS: SelectProps.Option[] = [
  { label: 'All record types', value: 'ALL' },
  { label: 'A', value: 'A' },
  { label: 'AAAA', value: 'AAAA' },
  { label: 'CNAME', value: 'CNAME' },
  { label: 'MX', value: 'MX' },
  { label: 'TXT', value: 'TXT' },
  { label: 'PTR', value: 'PTR' },
  { label: 'SRV', value: 'SRV' },
  { label: 'CAA', value: 'CAA' },
  { label: 'NS', value: 'NS' },
  { label: 'SOA', value: 'SOA' },
];

const ROUTING_POLICIES = [
  { label: 'Simple routing', value: 'Simple' },
  { label: 'Weighted', value: 'Weighted' },
  { label: 'Latency', value: 'Latency' },
  { label: 'Failover', value: 'Failover' },
  { label: 'Geolocation', value: 'Geolocation' },
  { label: 'Multivalue answer', value: 'Multivalue' },
];

const LATENCY_REGIONS = [
  { label: 'us-east-1 (N. Virginia)', value: 'us-east-1' },
  { label: 'us-west-2 (Oregon)', value: 'us-west-2' },
  { label: 'eu-west-1 (Ireland)', value: 'eu-west-1' },
  { label: 'ap-south-1 (Mumbai)', value: 'ap-south-1' },
  { label: 'ap-southeast-1 (Singapore)', value: 'ap-southeast-1' },
];

const PAGE_SIZE = 10;

export default function HostedZoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const zoneParam = decodeURIComponent((params?.zoneId as string) || '');

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [typeFilter, setTypeFilter] = useState<SelectProps.Option>(TYPE_FILTER_OPTIONS[0]);
  const [selectedRecords, setSelectedRecords] = useState<DNSRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Record Create / Edit / Delete Modals
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [deleteRecordModalVisible, setDeleteRecordModalVisible] = useState(false);
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // BIND Import Modal
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [bindZoneText, setBindZoneText] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  // Bulk Edit TTL Modal
  const [bulkTtlModalVisible, setBulkTtlModalVisible] = useState(false);
  const [bulkTtlValue, setBulkTtlValue] = useState('300');
  const [updatingBulkTtl, setUpdatingBulkTtl] = useState(false);

  // DNS Query Simulator Modal
  const [simulateModalVisible, setSimulateModalVisible] = useState(false);
  const [simQueryName, setSimQueryName] = useState('@');
  const [simQueryType, setSimQueryType] = useState(RECORD_TYPES[0]);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{
    query_name: string;
    query_type: string;
    response_code: string;
    routing_policy: string | null;
    ttl: number | null;
    answers: string[];
  } | null>(null);

  const handleSimulateDns = async () => {
    if (!zone) return;
    try {
      setSimulating(true);
      const res = await api.get(`/zones/${zone.id}/simulate`, {
        params: { name: simQueryName.trim() || '@', type: simQueryType.value || 'A' },
      });
      setSimResult(res.data);
    } catch {
      notify({ type: 'error', header: 'DNS simulation failed', content: 'Unable to simulate DNS query.' });
    } finally {
      setSimulating(false);
    }
  };

  // Edit / Delete Zone Modals
  const [editZoneModalVisible, setEditZoneModalVisible] = useState(false);
  const [zoneNameDraft, setZoneNameDraft] = useState('');
  const [zoneCommentDraft, setZoneCommentDraft] = useState('');
  const [editZoneError, setEditZoneError] = useState('');
  const [deleteZoneModalVisible, setDeleteZoneModalVisible] = useState(false);
  const [deleteZoneConfirm, setDeleteZoneConfirm] = useState('');

  // Record form state
  const [recordName, setRecordName] = useState('');
  const [recordType, setRecordType] = useState(RECORD_TYPES[0]);
  const [routingPolicy, setRoutingPolicy] = useState(ROUTING_POLICIES[0]);
  const [recordTtl, setRecordTtl] = useState('300');
  const [recordValue, setRecordValue] = useState('');
  const [isAlias, setIsAlias] = useState(false);
  const [weight, setWeight] = useState('100');
  const [regionOption, setRegionOption] = useState(LATENCY_REGIONS[0]);
  const [failoverOption, setFailoverOption] = useState({ label: 'Primary', value: 'Primary' });
  const [setIdentifier, setSetIdentifier] = useState('');
  const [selectedHealthCheck, setSelectedHealthCheck] = useState<{ label: string; value: string }>({
    label: 'None',
    value: '',
  });

  const getZoneRef = () => {
    if (zone?.id !== undefined && zone?.id !== null) {
      return String(zone.id);
    }
    if (typeof window !== 'undefined') {
      const qid = new URLSearchParams(window.location.search).get('id');
      if (qid) return qid;
    }
    return zoneParam;
  };

  const loadData = async () => {
    const qid =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;
    const lookupRef = encodeURIComponent(qid || zoneParam);
    try {
      setLoading(true);
      setLoadError('');
      const [zoneRes, recordsRes, hcRes] = await Promise.allSettled([
        api.get<HostedZone>(`/zones/${lookupRef}`),
        api.get<DNSRecord[]>(`/zones/${lookupRef}/records/`),
        api.get<HealthCheck[]>('/health-checks/'),
      ]);

      if (zoneRes.status === 'fulfilled') {
        setZone(zoneRes.value.data);
      } else {
        setZone(null);
        const reason = zoneRes.reason as { response?: { data?: { detail?: string } } };
        setLoadError(
          reason?.response?.data?.detail || `Failed to load hosted zone "${zoneParam}".`
        );
      }

      if (recordsRes.status === 'fulfilled') {
        setRecords(recordsRes.value.data);
      } else if (zoneRes.status === 'fulfilled') {
        setLoadError('Loaded hosted zone metadata, but failed to load DNS records.');
      }

      if (hcRes.status === 'fulfilled') {
        setHealthChecks(hcRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load zone details', err);
      setLoadError(`Failed to load hosted zone "${zoneParam}".`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zoneParam) loadData();
  }, [zoneParam]);

  const filteredRecords = records.filter((r) => {
    if (typeFilter.value && typeFilter.value !== 'ALL' && r.type !== typeFilter.value) {
      return false;
    }
    const q = filterText.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      (r.value ?? r.values ?? '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const openCreateModal = () => {
    setEditingRecord(null);
    setModalError('');
    setRecordName('');
    setRecordType(RECORD_TYPES[0]);
    setRoutingPolicy(ROUTING_POLICIES[0]);
    setRecordTtl('300');
    setRecordValue('');
    setIsAlias(false);
    setWeight('100');
    setSetIdentifier('');
    setSelectedHealthCheck({ label: 'None', value: '' });
    setRecordModalVisible(true);
  };

  const openEditModal = (rec: DNSRecord) => {
    setEditingRecord(rec);
    setModalError('');
    const zoneSuffix = `.${zone?.name}.`;
    let sub = rec.name;
    if (rec.name === `${zone?.name}.` || rec.name === zone?.name) {
      sub = '';
    } else if (rec.name.endsWith(zoneSuffix)) {
      sub = rec.name.slice(0, -zoneSuffix.length);
    }
    setRecordName(sub);
    setRecordType(RECORD_TYPES.find((t) => t.value === rec.type) || RECORD_TYPES[0]);
    setRoutingPolicy(
      ROUTING_POLICIES.find((p) => p.value === (rec.routing_policy || 'Simple')) || ROUTING_POLICIES[0]
    );
    setRecordTtl(String(rec.ttl ?? 300));
    setRecordValue(rec.value ?? rec.values ?? '');
    setIsAlias(Boolean(rec.is_alias));
    setWeight(String(rec.weight ?? 100));
    setRegionOption(LATENCY_REGIONS.find((r) => r.value === rec.region) || LATENCY_REGIONS[0]);
    setFailoverOption(
      rec.failover === 'Secondary'
        ? { label: 'Secondary', value: 'Secondary' }
        : { label: 'Primary', value: 'Primary' }
    );
    setSetIdentifier(rec.set_identifier || '');
    const hcMatch = healthChecks.find((h) => String(h.id) === String(rec.health_check_id));
    setSelectedHealthCheck(
      hcMatch ? { label: `${hcMatch.name} (${hcMatch.endpoint})`, value: String(hcMatch.id) } : { label: 'None', value: '' }
    );
    setRecordModalVisible(true);
  };

  const handleSaveRecord = async () => {
    setModalError('');
    if (!recordValue.trim()) {
      setModalError('Value is required.');
      return;
    }

    const payload = {
      name: recordName.trim(),
      type: recordType.value,
      ttl: parseInt(recordTtl, 10) || 300,
      value: recordValue.trim(),
      routing_policy: routingPolicy.value,
      is_alias: isAlias,
      weight: routingPolicy.value === 'Weighted' ? parseInt(weight, 10) || 100 : null,
      region: routingPolicy.value === 'Latency' ? regionOption.value : null,
      failover: routingPolicy.value === 'Failover' ? failoverOption.value : null,
      set_identifier: routingPolicy.value !== 'Simple' ? setIdentifier.trim() || null : null,
      health_check_id: selectedHealthCheck.value ? parseInt(selectedHealthCheck.value, 10) : null,
    };

    try {
      setSubmitting(true);
      const targetZoneRef = encodeURIComponent(getZoneRef());
      if (editingRecord) {
        await api.put(`/zones/${targetZoneRef}/records/${editingRecord.id}`, payload);
        notify({
          type: 'success',
          header: `Record ${payload.name || zone?.name} (${payload.type}) updated`,
        });
      } else {
        await api.post(`/zones/${targetZoneRef}/records/`, payload);
        notify({
          type: 'success',
          header: `Record ${payload.name || zone?.name} (${payload.type}) created`,
        });
      }
      setRecordModalVisible(false);
      setSelectedRecords([]);
      await loadData();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setModalError(detail || 'Failed to save DNS record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (selectedRecords.length === 0) return;
    try {
      setSubmitting(true);
      const targetZoneRef = encodeURIComponent(getZoneRef());
      if (selectedRecords.length > 1) {
        const ids = selectedRecords.map((r) => Number(r.id));
        const res = await api.post(`/zones/${targetZoneRef}/records/bulk-delete`, { ids });
        const skipped = res.data.skipped_system || 0;
        notify({
          type: 'success',
          header: `Deleted ${res.data.deleted ?? ids.length} record(s)`,
          content: skipped > 0 ? `${skipped} apex NS/SOA record(s) preserved.` : undefined,
        });
      } else {
        const target = selectedRecords[0];
        await api.delete(`/zones/${targetZoneRef}/records/${target.id}`);
        notify({
          type: 'success',
          header: `Deleted ${target.type} record (${target.name})`,
        });
      }
      setSelectedRecords([]);
      setDeleteRecordModalVisible(false);
      await loadData();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setModalError(detail || 'Failed to delete record(s).');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateZone = async () => {
    const domainErr = validateDomainName(zoneNameDraft);
    if (domainErr) {
      setEditZoneError(domainErr);
      return;
    }
    try {
      setSubmitting(true);
      setEditZoneError('');
      const cleanName = zoneNameDraft.trim().replace(/\.$/, '');
      const targetZoneRef = encodeURIComponent(getZoneRef());
      const res = await api.put<HostedZone>(`/zones/${targetZoneRef}`, {
        name: cleanName,
        comment: zoneCommentDraft,
      });
      const renamed = cleanName !== zone?.name;
      setEditZoneModalVisible(false);
      notify({
        type: 'success',
        header: `Updated hosted zone ${cleanName}`,
      });
      if (renamed && res.data) {
        router.replace(hostedZoneHref(res.data));
      } else {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to update zone', err);
      setEditZoneError('Failed to update hosted zone.');
      notify({ type: 'error', header: 'Failed to update hosted zone' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteZone = async () => {
    if (deleteZoneConfirm !== zone?.name) return;
    try {
      setSubmitting(true);
      const targetZoneRef = encodeURIComponent(getZoneRef());
      await api.delete(`/zones/${targetZoneRef}`);
      notify({
        type: 'success',
        header: `Hosted zone ${zone?.name} deleted`,
      });
      router.push('/hosted-zones');
    } catch (err) {
      console.error('Failed to delete zone', err);
      notify({ type: 'error', header: 'Failed to delete hosted zone' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportZone = async (format: 'bind' | 'json') => {
    if (!zone) return;
    try {
      const targetZoneRef = encodeURIComponent(getZoneRef());
      const res = await api.get(`/zones/${targetZoneRef}/export?format=${format}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'bind' ? `${zone.name}.zone` : `${zone.name}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify({
        type: 'success',
        header: `Exported ${zone.name} (${format.toUpperCase()})`,
      });
    } catch {
      notify({
        type: 'error',
        header: 'Failed to export hosted zone',
      });
    }
  };

  const handleImportBind = async () => {
    setImportError('');
    if (!bindZoneText.trim()) {
      setImportError('Paste a BIND zone file or upload a .zone/.txt file.');
      return;
    }
    try {
      setImporting(true);
      const targetZoneRef = encodeURIComponent(getZoneRef());
      const res = await api.post(`/zones/${targetZoneRef}/records/import-bind`, {
        zone_file: bindZoneText,
      });
      const importedCount = res.data.imported ?? 0;
      setImportModalVisible(false);
      setBindZoneText('');
      notify({
        type: 'success',
        header: `Imported ${importedCount} DNS record(s) from BIND zone file`,
      });
      await loadData();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setImportError(detail || 'Failed to parse or import BIND zone file.');
    } finally {
      setImporting(false);
    }
  };

  const handleBindFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBindZoneText(reader.result);
        setImportError('');
      }
    };
    reader.readAsText(file);
  };

  const handleBulkTtlUpdate = async () => {
    const ttlNum = parseInt(bulkTtlValue, 10);
    if (!ttlNum || ttlNum < 1) {
      notify({ type: 'error', header: 'Enter a valid TTL in seconds (>= 1).' });
      return;
    }
    try {
      setUpdatingBulkTtl(true);
      const targetZoneRef = encodeURIComponent(getZoneRef());
      const ids = selectedRecords.map((r) => Number(r.id));
      const res = await api.post(`/zones/${targetZoneRef}/records/bulk-ttl`, {
        ids,
        ttl: ttlNum,
      });
      setBulkTtlModalVisible(false);
      setSelectedRecords([]);
      notify({
        type: 'success',
        header: `Updated TTL to ${ttlNum}s for ${res.data.updated ?? ids.length} record(s)`,
      });
      await loadData();
    } catch {
      notify({ type: 'error', header: 'Failed to bulk update TTL.' });
    } finally {
      setUpdatingBulkTtl(false);
    }
  };

  const isSystemRecord = (r: DNSRecord) =>
    r.type === 'SOA' || (r.type === 'NS' && r.name.replace(/\.$/, '') === zone?.name.replace(/\.$/, ''));

  const renderDifferentiator = (r: DNSRecord) => {
    if (r.routing_policy === 'Weighted' && r.weight !== null && r.weight !== undefined) {
      return `Weight: ${r.weight}`;
    }
    if (r.routing_policy === 'Latency' && r.region) {
      return r.region;
    }
    if (r.routing_policy === 'Failover' && r.failover) {
      return r.failover;
    }
    return '-';
  };

  const resolvedZoneType = zone ? getHostedZoneType(zone) : null;
  const displayZoneName = zone?.name ?? (zoneParam || 'Hosted zone');

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/dashboard' },
        { text: 'Hosted zones', href: '/hosted-zones' },
        {
          text: displayZoneName,
          href: `/hosted-zones/${encodeURIComponent(zone?.name ?? zoneParam)}`,
        },
      ]}
      contentType="default"
    >
      <SpaceBetween size="l">
        {loadError ? <Alert type="error">{loadError}</Alert> : null}
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                items={[
                  { text: 'Export BIND zone file (.zone)', id: 'bind' },
                  { text: 'Export JSON (.json)', id: 'json' },
                ]}
                onItemClick={({ detail }) => {
                  if (detail.id === 'bind' || detail.id === 'json') {
                    handleExportZone(detail.id);
                  }
                }}
              >
                Export zone
              </ButtonDropdown>
              <Button
                onClick={() => {
                  setZoneNameDraft(zone?.name || '');
                  setZoneCommentDraft(zone?.comment || '');
                  setEditZoneError('');
                  setEditZoneModalVisible(true);
                }}
              >
                Edit hosted zone
              </Button>
              <Button
                onClick={() => {
                  setDeleteZoneConfirm('');
                  setDeleteZoneModalVisible(true);
                }}
              >
                Delete zone
              </Button>
            </SpaceBetween>
          }
        >
          {displayZoneName}
        </Header>

        {/* Hosted zone details */}
        <Container header={<Header variant="h2">Hosted zone details</Header>}>
          <SpaceBetween size="l">
            <ColumnLayout columns={4} variant="text-grid">
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Hosted zone name</Box>
                <Box>{zone?.name ?? '-'}</Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Type</Box>
                {resolvedZoneType ? (
                  <Badge color={resolvedZoneType === 'Public' ? 'blue' : 'grey'}>
                    {resolvedZoneType === 'Public' ? 'Public hosted zone' : 'Private hosted zone'}
                  </Badge>
                ) : (
                  <Box>-</Box>
                )}
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Hosted zone ID</Box>
                <Box variant="code">{zone?.id ?? '-'}</Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Record count</Box>
                <Box>{records.length}</Box>
              </SpaceBetween>
            </ColumnLayout>

            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Description</Box>
                <Box>{zone?.comment || '-'}</Box>
              </SpaceBetween>
              {resolvedZoneType === 'Private' ? (
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Associated VPC</Box>
                  <Box variant="code">
                    {zone?.vpc_id || 'vpc-0a1b2c3d4e5f67890'} ({zone?.vpc_region || 'us-east-1'})
                  </Box>
                </SpaceBetween>
              ) : (
                <ExpandableSection headerText="Name servers">
                  <SpaceBetween size="xs">
                    {(zone?.nameservers || []).map((ns) => (
                      <div key={ns} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Box variant="code">{ns}</Box>
                        <CopyToClipboard
                          copyButtonText="Copy"
                          copyErrorText="Failed to copy"
                          copySuccessText="Copied"
                          textToCopy={ns}
                          variant="icon"
                        />
                      </div>
                    ))}
                  </SpaceBetween>
                </ExpandableSection>
              )}
            </ColumnLayout>
          </SpaceBetween>
        </Container>

        {/* DNS Records Table */}
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: 'Record name',
              cell: (item) => <Box variant="code">{item.name || `${zone?.name}.`}</Box>,
              sortingField: 'name',
              isRowHeader: true,
            },
            {
              id: 'type',
              header: 'Type',
              cell: (item) => <Badge color="blue">{item.type}</Badge>,
              sortingField: 'type',
            },
            {
              id: 'routing_policy',
              header: 'Routing policy',
              cell: (item) => item.routing_policy || 'Simple',
            },
            {
              id: 'differentiator',
              header: 'Differentiator',
              cell: (item) => renderDifferentiator(item),
            },
            {
              id: 'alias',
              header: 'Alias',
              cell: (item) => (item.is_alias ? 'Yes' : 'No'),
            },
            {
              id: 'ttl',
              header: 'TTL (seconds)',
              cell: (item) => item.ttl ?? '-',
              sortingField: 'ttl',
            },
            {
              id: 'values',
              header: 'Value/Route traffic to',
              cell: (item) => (
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
                  {item.value ?? item.values ?? '-'}
                </div>
              ),
            },
          ]}
          items={pagedRecords}
          loading={loading}
          loadingText="Loading records..."
          selectionType="multi"
          selectedItems={selectedRecords}
          onSelectionChange={({ detail }) => setSelectedRecords(detail.selectedItems)}
          trackBy="id"
          stickyHeader
          filter={
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px' }}>
                <TextFilter
                  controlId="zone-records-filter"
                  filteringAriaLabel="Search records by name, type, or value"
                  filteringPlaceholder="Search records by name, type, or value"
                  filteringText={filterText}
                  onChange={({ detail }) => {
                    setFilterText(detail.filteringText);
                    setCurrentPage(1);
                  }}
                  countText={
                    filterText || typeFilter.value !== 'ALL'
                      ? `${filteredRecords.length} match${filteredRecords.length !== 1 ? 'es' : ''}`
                      : undefined
                  }
                />
              </div>
              <div className="r53-filter-select">
                <Select
                  selectedOption={typeFilter}
                  options={TYPE_FILTER_OPTIONS}
                  onChange={({ detail }) => {
                    setTypeFilter(detail.selectedOption);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          }
          empty={
            <Box textAlign="center" color="inherit" margin={{ vertical: 'xs' }}>
              <SpaceBetween size="m">
                <b>No records</b>
                <Button onClick={openCreateModal}>Create record</Button>
              </SpaceBetween>
            </Box>
          }
          pagination={
            <Pagination
              currentPageIndex={currentPage}
              pagesCount={totalPages}
              onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
            />
          }
          header={
            <Header
              variant="awsui-h1-sticky"
              counter={
                selectedRecords.length
                  ? `(${selectedRecords.length}/${filteredRecords.length})`
                  : `(${filteredRecords.length})`
              }
              description="DNS records define how Route 53 responds to DNS queries for this hosted zone."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    onClick={() => {
                      const sel = selectedRecords[0];
                      setSimQueryName(sel ? sel.name : '@');
                      if (sel) {
                        const match = RECORD_TYPES.find((t) => t.value === sel.type);
                        if (match) setSimQueryType(match);
                      }
                      setSimResult(null);
                      setSimulateModalVisible(true);
                    }}
                  >
                    Test record
                  </Button>
                  <Button
                    onClick={() => {
                      setImportError('');
                      setImportModalVisible(true);
                    }}
                  >
                    Import zone file
                  </Button>
                  <Button
                    disabled={selectedRecords.length !== 1}
                    onClick={() => openEditModal(selectedRecords[0])}
                  >
                    Edit record
                  </Button>
                  <Button
                    disabled={selectedRecords.length === 0}
                    onClick={() => {
                      setBulkTtlValue(String(selectedRecords[0]?.ttl ?? 300));
                      setBulkTtlModalVisible(true);
                    }}
                  >
                    Bulk edit TTL
                  </Button>
                  <Button
                    disabled={
                      selectedRecords.length === 0 ||
                      !selectedRecords.some((r) => !isSystemRecord(r))
                    }
                    onClick={() => setDeleteRecordModalVisible(true)}
                  >
                    {selectedRecords.length > 1
                      ? `Delete records (${selectedRecords.length})`
                      : 'Delete record'}
                  </Button>
                  <Button variant="primary" onClick={openCreateModal}>
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

      {/* Create / Edit Record Modal */}
      <Modal
        onDismiss={() => setRecordModalVisible(false)}
        visible={recordModalVisible}
        closeAriaLabel="Close modal"
        size="large"
        header={editingRecord ? 'Edit record' : 'Create record'}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setRecordModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveRecord} loading={submitting}>
                {editingRecord ? 'Save' : 'Create records'}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          {modalError ? <Alert type="error">{modalError}</Alert> : null}

          <ColumnLayout columns={2}>
            <FormField
              label="Record name"
              description={`Leave blank to route traffic to the zone apex (${zone?.name}).`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input
                  name="record_name"
                  value={recordName}
                  onChange={({ detail }) => setRecordName(detail.value)}
                  placeholder="www"
                />
                <span style={{ whiteSpace: 'nowrap' }}>
                  <Box color="text-status-inactive">.{zone?.name}</Box>
                </span>
              </div>
            </FormField>

            <FormField label="Record type">
              <Select
                selectedOption={recordType}
                onChange={({ detail }) => setRecordType(detail.selectedOption as any)}
                options={RECORD_TYPES}
              />
            </FormField>
          </ColumnLayout>

          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Alias</Box>
            <Box variant="small" color="text-status-inactive">
              Route traffic to an AWS resource such as CloudFront or an ELB.
            </Box>
            <Toggle checked={isAlias} onChange={({ detail }) => setIsAlias(detail.checked)}>
              Route traffic to an Alias target
            </Toggle>
          </SpaceBetween>

          <FormField
            label="Value"
            description={
              isAlias
                ? 'Enter the AWS resource domain target (e.g., d111111abcdef8.cloudfront.net).'
                : recordType.value === 'A'
                ? 'Enter one IPv4 address per line, for example: 192.0.2.1'
                : recordType.value === 'AAAA'
                ? 'Enter one IPv6 address per line.'
                : recordType.value === 'CNAME'
                ? 'Enter a single domain name, for example: www.example.com'
                : recordType.value === 'MX'
                ? 'Enter priority and domain: 10 mail.example.com'
                : recordType.value === 'TXT'
                ? 'Enter text in quotes: "v=spf1 include:example.com ~all"'
                : 'Enter the record value.'
            }
          >
            <Textarea
              value={recordValue}
              onChange={({ detail }) => setRecordValue(detail.value)}
              placeholder={
                isAlias
                  ? 'd111111abcdef8.cloudfront.net'
                  : recordType.value === 'A'
                  ? '192.0.2.1'
                  : recordType.value === 'CNAME'
                  ? 'www.example.com'
                  : recordType.value === 'MX'
                  ? '10 mail.example.com'
                  : recordType.value === 'TXT'
                  ? '"v=spf1 include:example.com ~all"'
                  : 'Enter value...'
              }
              rows={4}
            />
          </FormField>

          <ColumnLayout columns={2}>
            <FormField label="TTL (seconds)" description="Time to live in DNS caches.">
              <Select
                selectedOption={{
                  label:
                    recordTtl === '60'
                      ? '1 minute (60)'
                      : recordTtl === '300'
                      ? '5 minutes (300)'
                      : recordTtl === '3600'
                      ? '1 hour (3600)'
                      : recordTtl === '86400'
                      ? '1 day (86400)'
                      : `${recordTtl}`,
                  value: recordTtl,
                }}
                onChange={({ detail }) => setRecordTtl(detail.selectedOption.value!)}
                options={[
                  { label: '1 minute (60)', value: '60' },
                  { label: '5 minutes (300)', value: '300' },
                  { label: '1 hour (3600)', value: '3600' },
                  { label: '1 day (86400)', value: '86400' },
                  { label: '2 days (172800)', value: '172800' },
                ]}
              />
            </FormField>

            <FormField label="Routing policy">
              <Select
                selectedOption={routingPolicy}
                onChange={({ detail }) => setRoutingPolicy(detail.selectedOption as any)}
                options={ROUTING_POLICIES}
              />
            </FormField>
          </ColumnLayout>

          {routingPolicy.value !== 'Simple' ? (
            <ColumnLayout columns={2}>
              {routingPolicy.value === 'Weighted' ? (
                <FormField label="Weight" description="Value between 0 and 255.">
                  <Input
                    type="number"
                    value={weight}
                    onChange={({ detail }) => setWeight(detail.value)}
                  />
                </FormField>
              ) : null}

              {routingPolicy.value === 'Latency' ? (
                <FormField label="Region">
                  <Select
                    selectedOption={regionOption}
                    onChange={({ detail }) => setRegionOption(detail.selectedOption as any)}
                    options={LATENCY_REGIONS}
                  />
                </FormField>
              ) : null}

              {routingPolicy.value === 'Failover' ? (
                <FormField label="Failover record type">
                  <Select
                    selectedOption={failoverOption}
                    onChange={({ detail }) => setFailoverOption(detail.selectedOption as any)}
                    options={[
                      { label: 'Primary', value: 'Primary' },
                      { label: 'Secondary', value: 'Secondary' },
                    ]}
                  />
                </FormField>
              ) : null}

              <FormField label="Record ID" description="Unique name to distinguish records with the same name and type.">
                <Input
                  value={setIdentifier}
                  onChange={({ detail }) => setSetIdentifier(detail.value)}
                  placeholder="primary-endpoint"
                />
              </FormField>

              <FormField label="Health check ID - optional">
                <Select
                  selectedOption={selectedHealthCheck}
                  onChange={({ detail }) => setSelectedHealthCheck(detail.selectedOption as any)}
                  options={[
                    { label: 'None', value: '' },
                    ...healthChecks.map((hc) => ({
                      label: `${hc.name} (${hc.endpoint})`,
                      value: String(hc.id),
                    })),
                  ]}
                />
              </FormField>
            </ColumnLayout>
          ) : null}
        </SpaceBetween>
      </Modal>

      {/* Delete / Bulk Delete Record Modal */}
      <Modal
        onDismiss={() => setDeleteRecordModalVisible(false)}
        visible={deleteRecordModalVisible}
        header={
          selectedRecords.length > 1
            ? `Delete ${selectedRecords.length} records`
            : 'Delete record'
        }
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteRecordModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDeleteRecord} loading={submitting}>
                {selectedRecords.length > 1 ? 'Delete selected records' : 'Delete'}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning">
            Deleting DNS records is permanent and cannot be undone. Required apex NS and SOA records will be preserved automatically.
          </Alert>
          {selectedRecords.length > 1 ? (
            <Box>
              Are you sure you want to delete <b>{selectedRecords.length}</b> selected record(s) from{' '}
              <b>{zone?.name}</b>?
            </Box>
          ) : (
            <Box>
              Are you sure you want to delete the <b>{selectedRecords[0]?.type}</b> record for{' '}
              <b>{selectedRecords[0]?.name || zone?.name}</b>?
            </Box>
          )}
        </SpaceBetween>
      </Modal>

      {/* Import BIND Zone File Modal */}
      <Modal
        visible={importModalVisible}
        onDismiss={() => setImportModalVisible(false)}
        size="large"
        header="Import zone file (BIND format)"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setImportModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={importing} onClick={handleImportBind}>
                Import records
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {importError ? <Alert type="error">{importError}</Alert> : null}
          <Box color="text-body-secondary">
            Paste standard BIND zone file records (supports <code>$ORIGIN</code>, <code>$TTL</code>, A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, and CAA records) or upload a <code>.zone</code> / <code>.txt</code> file.
          </Box>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <input
              id="zone-detail-bind-file"
              name="bind_file"
              aria-label="Upload BIND zone file"
              type="file"
              accept=".zone,.txt,.db"
              onChange={handleBindFileUpload}
              style={{ fontSize: '13px', color: '#d1d5db' }}
            />
            <Button
              onClick={() =>
                setBindZoneText(
                  `$ORIGIN ${zone?.name || 'example.com'}.\n$TTL 300\n@ IN A 203.0.113.10\nwww 600 IN CNAME ${zone?.name || 'example.com'}.\nmail IN MX 10 mail.${zone?.name || 'example.com'}.\n@ IN TXT "v=spf1 include:${zone?.name || 'example.com'} ~all"`
                )
              }
            >
              Insert sample BIND file
            </Button>
          </div>
          <FormField label="Zone file contents">
            <Textarea
              value={bindZoneText}
              onChange={({ detail }) => setBindZoneText(detail.value)}
              rows={9}
              placeholder={`$ORIGIN ${zone?.name || 'example.com'}.\n$TTL 300\n@ IN A 192.0.2.1\nwww IN CNAME ${zone?.name || 'example.com'}.`}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Edit Hosted Zone Modal */}
      <Modal
        visible={editZoneModalVisible}
        onDismiss={() => setEditZoneModalVisible(false)}
        header="Edit hosted zone"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEditZoneModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUpdateZone} loading={submitting}>
                Save changes
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {editZoneError ? <Alert type="error">{editZoneError}</Alert> : null}
          <FormField
            label="Domain name"
            description="Update the domain name for this hosted zone."
          >
            <Input
              name="edit_zone_name"
              value={zoneNameDraft}
              onChange={({ detail }) => {
                setZoneNameDraft(detail.value);
                if (editZoneError) setEditZoneError('');
              }}
              placeholder="example.com"
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              name="edit_zone_comment"
              value={zoneCommentDraft}
              onChange={({ detail }) => setZoneCommentDraft(detail.value)}
              rows={3}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Delete Hosted Zone Modal */}
      <Modal
        visible={deleteZoneModalVisible}
        onDismiss={() => setDeleteZoneModalVisible(false)}
        header="Delete hosted zone"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteZoneModalVisible(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteZone}
                loading={submitting}
                disabled={deleteZoneConfirm !== zone?.name}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            Deleting <b>{zone?.name}</b> will permanently remove all DNS records in this hosted zone.
          </Box>
          <FormField label={<>To confirm, type <b>{zone?.name}</b> below</>}>
            <Input
              value={deleteZoneConfirm}
              onChange={({ detail }) => setDeleteZoneConfirm(detail.value)}
              placeholder={zone?.name}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Bulk Edit TTL Modal */}
      <Modal
        visible={bulkTtlModalVisible}
        onDismiss={() => setBulkTtlModalVisible(false)}
        header={`Bulk edit TTL (${selectedRecords.length} record${selectedRecords.length !== 1 ? 's' : ''})`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setBulkTtlModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={updatingBulkTtl} onClick={handleBulkTtlUpdate}>
                Apply TTL
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            Update the TTL (seconds) for all <b>{selectedRecords.length}</b> selected DNS record(s) at once.
          </Box>
          <FormField label="New TTL (seconds)">
            <Input
              type="number"
              value={bulkTtlValue}
              onChange={({ detail }) => setBulkTtlValue(detail.value)}
              placeholder="300"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* DNS Query Simulator Modal */}
      <Modal
        visible={simulateModalVisible}
        onDismiss={() => setSimulateModalVisible(false)}
        header="Test DNS response"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setSimulateModalVisible(false)}>
                Close
              </Button>
              <Button variant="primary" loading={simulating} onClick={handleSimulateDns}>
                Get response
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Record name" description={`Subdomain or '@' for ${zone?.name || 'zone apex'}`}>
            <Input
              value={simQueryName}
              onChange={({ detail }) => setSimQueryName(detail.value)}
              placeholder="www"
            />
          </FormField>
          <FormField label="Record type">
            <Select
              selectedOption={simQueryType}
              options={RECORD_TYPES}
              onChange={({ detail }) => setSimQueryType(detail.selectedOption as typeof RECORD_TYPES[0])}
            />
          </FormField>
          {simResult && (
            <Alert
              type={simResult.response_code === 'NOERROR' ? 'success' : 'warning'}
              header={`DNS Response: ${simResult.response_code}`}
            >
              <SpaceBetween size="xs">
                <Box>
                  <b>Query:</b> <Box variant="code" display="inline">{simResult.query_name}</Box> ({simResult.query_type})
                </Box>
                <Box>
                  <b>Routing policy:</b> {simResult.routing_policy || 'N/A'} | <b>TTL:</b> {simResult.ttl ?? '-'}
                </Box>
                <Box>
                  <b>Returned value(s):</b>{' '}
                  {simResult.answers.length > 0 ? simResult.answers.join(', ') : 'No matching records'}
                </Box>
              </SpaceBetween>
            </Alert>
          )}
        </SpaceBetween>
      </Modal>
    </ConsoleLayout>
  );
}
