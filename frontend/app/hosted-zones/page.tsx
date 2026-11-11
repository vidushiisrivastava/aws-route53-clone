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
import StatusIndicator from '@cloudscape-design/components/status-indicator';

import Link from '@cloudscape-design/components/link';

import ConsoleLayout from '../components/ConsoleLayout';
import { api, HostedZone } from '../../lib/api';

export default function HostedZonesPage() {
  const router = useRouter();
  const [zones, setZones] = useState<HostedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<HostedZone[]>([]);
  const [filterText, setFilterText] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await api.get<HostedZone[]>('/zones');
      setZones(res.data);
    } catch (err) {
      console.error('Failed to load zones', err);
    } finally {
      setLoading(false);
    }
  };


  const filteredZones = zones.filter((z) =>
    z.name.toLowerCase().includes(filterText.toLowerCase()) ||
    String(z.id).toLowerCase().includes(filterText.toLowerCase()) ||
    (z.comment && z.comment.toLowerCase().includes(filterText.toLowerCase()))
  );

  const handleDelete = async () => {
    if (selectedItems.length === 0) return;
    setIsDeleting(true);
    try {
      await api.delete(`/zones/${selectedItems[0].id}`);
      setSelectedItems([]);
      setDeleteModalVisible(false);
      await fetchZones();
    } catch (err) {
      console.error('Failed to delete zone', err);
    } finally {
      setIsDeleting(false);
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
        items={filteredZones}
        loading={loading}
        loadingText="Loading hosted zones..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        trackBy="id"
        empty={
          <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No hosted zones</b>
              <Button onClick={() => router.push('/hosted-zones/create')}>
                Create hosted zone
              </Button>
            </SpaceBetween>
          </Box>
        }
        filter={
          <TextFilter
            filteringPlaceholder="Find hosted zone"
            filteringText={filterText}
            onChange={({ detail }) => setFilterText(detail.filteringText)}
            countText={`${filteredZones.length} matches`}
          />
        }
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={`(${filteredZones.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={() => router.push(`/hosted-zones/${selectedItems[0].id}`)}
                >
                  View details
                </Button>
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={() => setDeleteModalVisible(true)}
                >
                  Delete
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
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
      />

      {/* Confirmation Modal */}
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
              <Button variant="primary" onClick={() => handleDelete()} loading={isDeleting}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete hosted zone"
      >
        Are you sure you want to delete hosted zone{' '}
        <b>{selectedItems[0]?.name}</b> ({selectedItems[0]?.id})? All associated
        DNS records will also be permanently deleted.
      </Modal>
    </ConsoleLayout>
  );
}