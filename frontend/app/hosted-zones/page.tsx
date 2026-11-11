'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import TextFilter from '@cloudscape-design/components/text-filter';
import Pagination from '@cloudscape-design/components/pagination';
import Modal from '@cloudscape-design/components/modal';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Alert from '@cloudscape-design/components/alert';
import Input from '@cloudscape-design/components/input';
import FormField from '@cloudscape-design/components/form-field';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import Textarea from '@cloudscape-design/components/textarea';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Toggle from '@cloudscape-design/components/toggle';

import ConsoleLayout from '../components/ConsoleLayout';
import { api, HostedZone, notify } from '../lib/api';

const PAGE_SIZE = 10;

const ZONE_TYPE_OPTIONS: SelectProps.Option[] = [
  { label: 'All types', value: 'ALL' },
  { label: 'Public hosted zone', value: 'Public' },
  { label: 'Private hosted zone', value: 'Private' },
];

export default function HostedZonesPage() {
  const router = useRouter();
  const [zones, setZones] = useState<HostedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<HostedZone[]>([]);
  const [filterText, setFilterText] = useState('');
  const [typeFilter, setTypeFilter] = useState<SelectProps.Option>(ZONE_TYPE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState(1);

  // Delete / Bulk delete modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Edit zone modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editComment, setEditComment] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // BIND Import modal state
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importTargetZone, setImportTargetZone] = useState<SelectProps.Option | null>(null);
  const [createNewZoneOnImport, setCreateNewZoneOnImport] = useState(false);
  const [newImportDomain, setNewImportDomain] = useState('');
  const [bindZoneText, setBindZoneText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await api.get<HostedZone[]>('/zones/');
      setZones(res.data);
    } catch (err) {
      console.error('Failed to load zones', err);
      notify({
        type: 'error',
        header: 'Failed to load hosted zones',
        content: 'Check your connection to the FastAPI backend.',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredZones = zones.filter((z) => {
    const zType = z.type ?? z.zone_type ?? 'Public';
    if (typeFilter.value && typeFilter.value !== 'ALL' && zType !== typeFilter.value) {
      return false;
    }
    const q = filterText.toLowerCase();
    return (
      z.name.toLowerCase().includes(q) ||
      String(z.id).toLowerCase().includes(q) ||
      (z.comment && z.comment.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredZones.length / PAGE_SIZE));
  const pagedZones = filteredZones.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const isBulkDelete = selectedItems.length > 1;
  const requiredConfirmToken = isBulkDelete ? 'delete' : selectedItems[0]?.name || '';

  const handleDelete = async () => {
    if (selectedItems.length === 0) return;
    if (deleteConfirmText !== requiredConfirmToken) {
      setDeleteError(`Please type "${requiredConfirmToken}" to confirm.`);
      return;
    }
    setIsDeleting(true);
    setDeleteError('');
    try {
      if (isBulkDelete) {
        const ids = selectedItems.map((z) => Number(z.id));
        const res = await api.post('/zones/bulk-delete', { ids });
        notify({
          type: 'success',
          header: `Deleted ${res.data.deleted ?? ids.length} hosted zones`,
          content: 'Selected hosted zones and their DNS records were deleted.',
        });
      } else {
        const target = selectedItems[0];
        await api.delete(`/zones/${target.id}`);
        notify({
          type: 'success',
          header: `Hosted zone ${target.name} deleted`,
        });
      }
      setSelectedItems([]);
      setDeleteModalVisible(false);
      setDeleteConfirmText('');
      await fetchZones();
    } catch {
      setDeleteError('Failed to delete hosted zone(s). Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = () => {
    if (selectedItems.length !== 1) return;
    setEditComment(selectedItems[0].comment || '');
    setEditError('');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (selectedItems.length !== 1) return;
    setIsSavingEdit(true);
    setEditError('');
    try {
      const target = selectedItems[0];
      await api.put(`/zones/${target.id}`, { comment: editComment });
      setEditModalVisible(false);
      setSelectedItems([]);
      notify({
        type: 'success',
        header: `Updated hosted zone ${target.name}`,
        content: 'Hosted zone description saved.',
      });
      await fetchZones();
    } catch {
      setEditError('Failed to update hosted zone description.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportZone = async (format: 'json' | 'bind') => {
    if (selectedItems.length === 0) return;
    try {
      if (selectedItems.length === 1) {
        const zone = selectedItems[0];
        const res = await api.get(`/zones/${zone.id}/export?format=${format}`, {
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
      } else if (format === 'json') {
        const exported = await Promise.all(
          selectedItems.map((z) => api.get(`/zones/${z.id}/export?format=json`).then((r) => r.data))
        );
        const blob = new Blob([JSON.stringify({ hosted_zones: exported }, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hosted-zones-export.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        notify({
          type: 'success',
          header: `Bulk exported ${selectedItems.length} hosted zones (JSON)`,
        });
      } else {
        const exported = await Promise.all(
          selectedItems.map((z) => api.get(`/zones/${z.id}/export?format=bind`).then((r) => r.data as string))
        );
        const blob = new Blob([exported.join('\n\n; ----------------------------------------\n\n')], {
          type: 'text/plain',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hosted-zones-export.zone';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        notify({
          type: 'success',
          header: `Bulk exported ${selectedItems.length} hosted zones (BIND)`,
        });
      }
    } catch {
      notify({
        type: 'error',
        header: 'Failed to export hosted zone(s)',
      });
    }
  };

  const openImportModal = () => {
    setImportError('');
    setBindZoneText('');
    const preselected = selectedItems[0] || zones[0];
    if (preselected) {
      setImportTargetZone({ label: `${preselected.name} (${preselected.id})`, value: String(preselected.id) });
      setCreateNewZoneOnImport(false);
    } else {
      setImportTargetZone(null);
      setCreateNewZoneOnImport(true);
    }
    setNewImportDomain('');
    setImportModalVisible(true);
  };

  const extractOriginFromBind = (text: string): string => {
    const match = text.match(/^\s*\$ORIGIN\s+([^\s;]+)/im);
    return match ? match[1].replace(/\.$/, '') : '';
  };

  const handleBindFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBindZoneText(reader.result);
        setImportError('');
        const detectedOrigin = extractOriginFromBind(reader.result);
        if (detectedOrigin && !newImportDomain) {
          setNewImportDomain(detectedOrigin);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleImportBind = async () => {
    setImportError('');
    if (!bindZoneText.trim()) {
      setImportError('Paste BIND zone file content or upload a .zone/.txt file.');
      return;
    }

    let targetId = importTargetZone?.value;
    let targetName = importTargetZone?.label || '';
    try {
      setIsImporting(true);
      if (createNewZoneOnImport) {
        const domain = (newImportDomain || extractOriginFromBind(bindZoneText)).trim().replace(/\.$/, '');
        if (!domain) {
          setImportError('Enter a domain name or include $ORIGIN in the BIND zone file.');
          setIsImporting(false);
          return;
        }
        const zRes = await api.post('/zones/', {
          name: domain,
          comment: 'Imported from BIND zone file',
          type: 'Public',
          zone_type: 'Public',
        });
        targetId = String(zRes.data.id);
        targetName = domain;
      }

      if (!targetId) {
        setImportError('Select an existing hosted zone or enable creating a new zone.');
        setIsImporting(false);
        return;
      }

      const res = await api.post(`/zones/${targetId}/records/import-bind`, {
        zone_file: bindZoneText,
      });
      setImportModalVisible(false);
      notify({
        type: 'success',
        header: `Imported ${res.data.imported ?? 0} DNS record(s)`,
        content: targetName ? `Target hosted zone: ${targetName}` : undefined,
      });
      await fetchZones();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setImportError(detail || 'Failed to import BIND zone file.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/' },
        { text: 'Hosted zones', href: '/hosted-zones' },
      ]}
    >
      <Table
        columnDefinitions={[
          {
            id: 'name',
            header: 'Hosted zone name',
            cell: (item) => (
              <Link onFollow={() => router.push(`/hosted-zones/${item.id}`)}>
                {item.name}
              </Link>
            ),
            sortingField: 'name',
            isRowHeader: true,
          },
          {
            id: 'type',
            header: 'Type',
            cell: (item) => (
              <Badge color={(item.type ?? 'Public') === 'Public' ? 'blue' : 'grey'}>
                {(item.type ?? 'Public') === 'Public' ? 'Public hosted zone' : 'Private hosted zone'}
              </Badge>
            ),
          },
          {
            id: 'record_count',
            header: 'Record count',
            cell: (item) => item.record_count ?? '-',
          },
          {
            id: 'description',
            header: 'Description',
            cell: (item) => item.comment || '-',
          },
          {
            id: 'id',
            header: 'Hosted zone ID',
            cell: (item) => <Box variant="code">{item.id}</Box>,
          },
        ]}
        items={pagedZones}
        loading={loading}
        loadingText="Loading hosted zones..."
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        trackBy="id"
        empty={
          <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <Box variant="strong">No hosted zones</Box>
              <Box color="text-status-inactive" variant="p">
                You don&apos;t have any hosted zones. Create a hosted zone to start routing traffic for your domain.
              </Box>
              <Button onClick={() => router.push('/hosted-zones/create')}>
                Create hosted zone
              </Button>
            </SpaceBetween>
          </Box>
        }
        filter={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px' }}>
              <TextFilter
                filteringPlaceholder="Find hosted zone by name, ID, or description"
                filteringText={filterText}
                onChange={({ detail }) => {
                  setFilterText(detail.filteringText);
                  setCurrentPage(1);
                }}
                countText={
                  filterText || typeFilter.value !== 'ALL'
                    ? `${filteredZones.length} match${filteredZones.length !== 1 ? 'es' : ''}`
                    : undefined
                }
              />
            </div>
            <div style={{ width: '210px' }}>
              <Select
                selectedOption={typeFilter}
                options={ZONE_TYPE_OPTIONS}
                onChange={({ detail }) => {
                  setTypeFilter(detail.selectedOption);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        }
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={selectedItems.length ? `(${selectedItems.length}/${filteredZones.length})` : `(${filteredZones.length})`}
            description="A hosted zone is a container for records, which define how you want to route traffic for a domain."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={openImportModal}>Import BIND</Button>
                <Button
                  disabled={selectedItems.length !== 1}
                  onClick={() => router.push(`/hosted-zones/${selectedItems[0]?.id}`)}
                >
                  View details
                </Button>
                <Button
                  disabled={selectedItems.length !== 1}
                  onClick={openEditModal}
                >
                  Edit
                </Button>
                <ButtonDropdown
                  disabled={selectedItems.length === 0}
                  items={[
                    {
                      id: 'bind',
                      text:
                        selectedItems.length > 1
                          ? `Export BIND (.zone) (${selectedItems.length})`
                          : 'Export BIND zone file (.zone)',
                    },
                    {
                      id: 'json',
                      text:
                        selectedItems.length > 1
                          ? `Export JSON (.json) (${selectedItems.length})`
                          : 'Export JSON (.json)',
                    },
                  ]}
                  onItemClick={({ detail }) => {
                    if (detail.id === 'bind' || detail.id === 'json') {
                      handleExportZone(detail.id);
                    }
                  }}
                >
                  Export
                </ButtonDropdown>
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={() => {
                    setDeleteError('');
                    setDeleteConfirmText('');
                    setDeleteModalVisible(true);
                  }}
                >
                  {selectedItems.length > 1 ? `Delete (${selectedItems.length})` : 'Delete'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => router.push('/hosted-zones/create')}
                >
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
      />

      {/* Edit Hosted Zone Modal */}
      <Modal
        onDismiss={() => setEditModalVisible(false)}
        visible={editModalVisible}
        header={`Edit hosted zone: ${selectedItems[0]?.name || ''}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEditModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={isSavingEdit} onClick={handleSaveEdit}>
                Save changes
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {editError ? <Alert type="error">{editError}</Alert> : null}
          <FormField
            label="Description - optional"
            description="Update the comment or description for this hosted zone."
          >
            <Textarea
              value={editComment}
              onChange={({ detail }) => setEditComment(detail.value)}
              placeholder="e.g. Production DNS zone"
              rows={3}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Delete / Bulk Delete Confirmation Modal */}
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalVisible(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDelete}
                loading={isDeleting}
                disabled={deleteConfirmText !== requiredConfirmToken}
              >
                {isBulkDelete ? `Delete ${selectedItems.length} zones` : 'Delete'}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={isBulkDelete ? `Delete ${selectedItems.length} hosted zones` : 'Delete hosted zone'}
      >
        <SpaceBetween size="m">
          {deleteError ? <Alert type="error">{deleteError}</Alert> : null}
          <Box>
            {isBulkDelete ? (
              <>
                Deleting the selected <b>{selectedItems.length}</b> hosted zones (
                {selectedItems.map((z) => z.name).join(', ')}) will permanently remove all DNS records inside them.
              </>
            ) : (
              <>
                Deleting the hosted zone <b>{selectedItems[0]?.name}</b> will permanently remove all records in this zone.
                DNS queries for this domain will no longer be answered by Route 53.
              </>
            )}
          </Box>
          <Box>
            <b>This action cannot be undone.</b> To confirm deletion, type <b>{requiredConfirmToken}</b> below.
          </Box>
          <FormField label={<>To confirm, type <b>{requiredConfirmToken}</b> in the field</>}>
            <Input
              value={deleteConfirmText}
              onChange={({ detail }) => {
                setDeleteConfirmText(detail.value);
                setDeleteError('');
              }}
              placeholder={requiredConfirmToken}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Import BIND Zone File Modal */}
      <Modal
        visible={importModalVisible}
        onDismiss={() => setImportModalVisible(false)}
        size="large"
        header="Import DNS records from BIND zone file"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setImportModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={isImporting} onClick={handleImportBind}>
                Import records
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {importError ? <Alert type="error">{importError}</Alert> : null}

          <Toggle
            checked={createNewZoneOnImport}
            onChange={({ detail }) => setCreateNewZoneOnImport(detail.checked)}
          >
            Create a new hosted zone for this BIND file
          </Toggle>

          {createNewZoneOnImport ? (
            <FormField
              label="Domain name"
              description="Leave blank if $ORIGIN is defined in your BIND file."
            >
              <Input
                value={newImportDomain}
                onChange={({ detail }) => setNewImportDomain(detail.value)}
                placeholder="example.com"
              />
            </FormField>
          ) : (
            <FormField label="Target hosted zone">
              <Select
                selectedOption={importTargetZone}
                onChange={({ detail }) => setImportTargetZone(detail.selectedOption)}
                options={zones.map((z) => ({
                  label: `${z.name} (${z.id})`,
                  value: String(z.id),
                }))}
                placeholder="Select a hosted zone"
              />
            </FormField>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".zone,.txt,.db"
              onChange={handleBindFileUpload}
              style={{ fontSize: '13px' }}
            />
            <Button
              onClick={() => {
                const domain =
                  (createNewZoneOnImport ? newImportDomain : zones.find((z) => String(z.id) === importTargetZone?.value)?.name) ||
                  'example.com';
                setBindZoneText(
                  `$ORIGIN ${domain}.\n$TTL 300\n@ IN A 203.0.113.10\nwww 600 IN CNAME ${domain}.\nmail IN MX 10 mail.${domain}.\n@ IN TXT "v=spf1 include:${domain} ~all"`
                );
              }}
            >
              Insert sample BIND file
            </Button>
          </div>

          <FormField label="BIND zone file content">
            <Textarea
              value={bindZoneText}
              onChange={({ detail }) => setBindZoneText(detail.value)}
              rows={9}
              placeholder={`$ORIGIN example.com.\n$TTL 300\n@ IN A 192.0.2.1\nwww IN CNAME example.com.`}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </ConsoleLayout>
  );
}
