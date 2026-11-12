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
import Textarea from '@cloudscape-design/components/textarea';
import TextFilter from '@cloudscape-design/components/text-filter';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { api, Route53Profile } from '../lib/api';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Route53Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Route53Profile[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [vpcModalVisible, setVpcModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vpcAssociations, setVpcAssociations] = useState('');

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const res = await api.get<Route53Profile[]>('/profiles/');
      setProfiles(res.data);
    } catch (err) {
      console.error('Failed to fetch profiles', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const filtered = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(filterText.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(filterText.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await api.post('/profiles/', {
        name: name.trim(),
        description: description.trim(),
        vpc_associations: vpcAssociations.trim(),
      });
      setCreateModalVisible(false);
      setName('');
      setDescription('');
      setVpcAssociations('');
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to create profile', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateVpcs = async () => {
    if (!selected[0]) return;
    try {
      setSubmitting(true);
      await api.put(`/profiles/${selected[0].id}`, {
        vpc_associations: vpcAssociations,
      });
      setVpcModalVisible(false);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to update VPC associations', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected[0]) return;
    try {
      setSubmitting(true);
      await api.delete(`/profiles/${selected[0].id}`);
      setSelected([]);
      setDeleteModalVisible(false);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to delete profile', err);
    } finally {
      setSubmitting(false);
    }
  };

  const countVpcs = (vpcs: string) =>
    vpcs ? vpcs.split(',').filter((v) => v.trim().length > 0).length : 0;

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/' },
        { text: 'Profiles', href: '/profiles' },
      ]}
    >
      <Table
        columnDefinitions={[
          { id: 'name', header: 'Profile name', cell: (item) => item.name, isRowHeader: true },
          { id: 'id', header: 'Profile ID', cell: (item) => <Box variant="code">rp-{item.id}</Box> },
          {
            id: 'status',
            header: 'Status',
            cell: (item) => <StatusIndicator type="success">{item.status}</StatusIndicator>,
          },
          {
            id: 'associations',
            header: 'VPC associations',
            cell: (item) =>
              item.vpc_associations ? (
                <Box variant="code">{item.vpc_associations}</Box>
              ) : (
                `${countVpcs(item.vpc_associations)}`
              ),
          },
          { id: 'resources', header: 'Resources', cell: (item) => item.resource_count },
          { id: 'description', header: 'Description', cell: (item) => item.description || '-' },
          {
            id: 'createdAt',
            header: 'Created',
            cell: (item) => new Date(item.created_at).toLocaleDateString(),
          },
        ]}
        items={filtered}
        loading={loading}
        loadingText="Loading profiles..."
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        trackBy="id"
        filter={
          <TextFilter
            controlId="profiles-filter"
            filteringAriaLabel="Find profile"
            filteringText={filterText}
            filteringPlaceholder="Find profile"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
            countText={filterText ? `${filtered.length} matches` : undefined}
          />
        }
        empty={
          <Box textAlign="center" color="inherit" margin={{ vertical: 'xs' }}>
            <SpaceBetween size="m">
              <b>No profiles</b>
              <Box color="text-status-inactive">
                Create a profile to share Route 53 configurations across VPCs.
              </Box>
              <Button onClick={() => setCreateModalVisible(true)}>Create profile</Button>
            </SpaceBetween>
          </Box>
        }
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={`(${filtered.length})`}
            description="Share Route 53 configurations, such as resolver rules and DNS Firewall rule groups, across VPCs."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={selected.length === 0}
                  onClick={() => {
                    setVpcAssociations(selected[0]?.vpc_associations || '');
                    setVpcModalVisible(true);
                  }}
                >
                  Manage VPC associations
                </Button>
                <Button disabled={selected.length === 0} onClick={() => setDeleteModalVisible(true)}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => setCreateModalVisible(true)}>
                  Create profile
                </Button>
              </SpaceBetween>
            }
          >
            Profiles
          </Header>
        }
      />

      {/* Create Modal */}
      <Modal
        visible={createModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
        header="Create profile"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate} loading={submitting} disabled={!name.trim()}>
                Create profile
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Profile name" description="A name to identify this profile.">
            <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="my-profile" />
          </FormField>
          <FormField label="VPC IDs to associate (comma-separated, optional)">
            <Input
              value={vpcAssociations}
              onChange={({ detail }) => setVpcAssociations(detail.value)}
              placeholder="vpc-0a1b2c3d4e5f67890"
            />
          </FormField>
          <FormField label="Description (optional)">
            <Textarea value={description} onChange={({ detail }) => setDescription(detail.value)} rows={2} />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Manage VPC Modal */}
      <Modal
        visible={vpcModalVisible}
        onDismiss={() => setVpcModalVisible(false)}
        header={`Manage VPC associations for ${selected[0]?.name}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setVpcModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUpdateVpcs} loading={submitting}>
                Save associations
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="Associated VPC IDs (comma-separated)">
          <Input
            value={vpcAssociations}
            onChange={({ detail }) => setVpcAssociations(detail.value)}
            placeholder="vpc-0a1b2c3d4e5f67890, vpc-0987654321fedcba0"
          />
        </FormField>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={deleteModalVisible}
        onDismiss={() => setDeleteModalVisible(false)}
        header="Delete profile"
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
        Are you sure you want to delete profile <b>{selected[0]?.name}</b>? This will remove all VPC associations.
      </Modal>
    </ConsoleLayout>
  );
}
