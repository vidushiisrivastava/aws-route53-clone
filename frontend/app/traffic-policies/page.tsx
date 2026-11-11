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
import Textarea from '@cloudscape-design/components/textarea';
import TextFilter from '@cloudscape-design/components/text-filter';
import Badge from '@cloudscape-design/components/badge';
import Container from '@cloudscape-design/components/container';
import { api, TrafficPolicy } from '../lib/api';

export default function TrafficPoliciesPage() {
  const [policies, setPolicies] = useState<TrafficPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrafficPolicy[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [dnsType, setDnsType] = useState({ label: 'A – IPv4 address', value: 'A' });
  const [comment, setComment] = useState('');
  const [documentDraft, setDocumentDraft] = useState('');

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await api.get<TrafficPolicy[]>('/traffic-policies/');
      setPolicies(res.data);
    } catch (err) {
      console.error('Failed to fetch traffic policies', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const filtered = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(filterText.toLowerCase()) ||
      (p.comment || '').toLowerCase().includes(filterText.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await api.post('/traffic-policies/', {
        name: name.trim(),
        dns_type: dnsType.value,
        comment: comment.trim(),
      });
      setCreateModalVisible(false);
      setName('');
      setComment('');
      await fetchPolicies();
    } catch (err) {
      console.error('Failed to create traffic policy', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNewVersion = async () => {
    if (!selected[0]) return;
    try {
      setSubmitting(true);
      const res = await api.post<TrafficPolicy>(`/traffic-policies/${selected[0].id}/version`, {
        comment,
        document: documentDraft,
      });
      setEditModalVisible(false);
      setSelected([res.data]);
      await fetchPolicies();
    } catch (err) {
      console.error('Failed to update policy version', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected[0]) return;
    try {
      setSubmitting(true);
      await api.delete(`/traffic-policies/${selected[0].id}`);
      setSelected([]);
      setDeleteModalVisible(false);
      await fetchPolicies();
    } catch (err) {
      console.error('Failed to delete traffic policy', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/dashboard' },
        { text: 'Traffic policies', href: '/traffic-policies' },
      ]}
      contentType="default"
    >
      <SpaceBetween size="l">
        <Table
          columnDefinitions={[
            { id: 'name', header: 'Policy name', cell: (item) => item.name, isRowHeader: true },
            { id: 'id', header: 'Policy ID', cell: (item) => <Box variant="code">{item.id}</Box> },
            { id: 'version', header: 'Latest version', cell: (item) => <Badge color="blue">v{item.version}</Badge> },
            { id: 'type', header: 'DNS type', cell: (item) => item.dns_type },
            { id: 'comment', header: 'Comment', cell: (item) => item.comment || '-' },
            {
              id: 'createdAt',
              header: 'Created',
              cell: (item) => new Date(item.created_at).toLocaleDateString(),
            },
          ]}
          items={filtered}
          loading={loading}
          loadingText="Loading traffic policies..."
          selectionType="single"
          selectedItems={selected}
          onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
          trackBy="id"
          filter={
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="Find traffic policy"
              onChange={({ detail }) => setFilterText(detail.filteringText)}
              countText={filterText ? `${filtered.length} matches` : undefined}
            />
          }
          empty={
            <Box textAlign="center" color="inherit" margin={{ vertical: 'xs' }}>
              <SpaceBetween size="m">
                <b>No traffic policies</b>
                <Box color="text-status-inactive">
                  Traffic policies let you create complex routing trees with weighted, latency, and failover rules.
                </Box>
                <Button onClick={() => setCreateModalVisible(true)}>Create traffic policy</Button>
              </SpaceBetween>
            </Box>
          }
          header={
            <Header
              variant="awsui-h1-sticky"
              counter={`(${filtered.length})`}
              description="Define routing rules using visual policy trees and reuse them across multiple hosted zones."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={selected.length === 0}
                    onClick={() => {
                      if (!selected[0]) return;
                      setComment(selected[0].comment || '');
                      setDocumentDraft(selected[0].document || '');
                      setEditModalVisible(true);
                    }}
                  >
                    Create new version
                  </Button>
                  <Button disabled={selected.length === 0} onClick={() => setDeleteModalVisible(true)}>
                    Delete
                  </Button>
                  <Button variant="primary" onClick={() => setCreateModalVisible(true)}>
                    Create traffic policy
                  </Button>
                </SpaceBetween>
              }
            >
              Traffic policies
            </Header>
          }
        />

        {selected[0]?.document ? (
          <Container header={<Header variant="h2">Policy document (v{selected[0].version})</Header>}>
            <pre
              style={{
                background: '#f8f9fa',
                padding: 16,
                borderRadius: 6,
                overflowX: 'auto',
                fontSize: 13,
                margin: 0,
              }}
            >
              {selected[0].document}
            </pre>
          </Container>
        ) : null}
      </SpaceBetween>

      {/* Create Modal */}
      <Modal
        visible={createModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
        header="Create traffic policy"
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate} loading={submitting} disabled={!name.trim()}>
                Create traffic policy
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Policy name">
            <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="my-traffic-policy" />
          </FormField>
          <FormField label="DNS type">
            <Select
              selectedOption={dnsType}
              onChange={({ detail }) => setDnsType(detail.selectedOption as any)}
              options={[
                { label: 'A – IPv4 address', value: 'A' },
                { label: 'AAAA – IPv6 address', value: 'AAAA' },
                { label: 'CNAME – Canonical name', value: 'CNAME' },
              ]}
            />
          </FormField>
          <FormField label="Version description (optional)">
            <Textarea value={comment} onChange={({ detail }) => setComment(detail.value)} rows={2} />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* New Version / Edit Document Modal */}
      <Modal
        visible={editModalVisible}
        onDismiss={() => setEditModalVisible(false)}
        header={`Create version ${(selected[0]?.version || 1) + 1} for ${selected[0]?.name}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEditModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveNewVersion} loading={submitting}>
                Save as new version
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Version comment">
            <Input value={comment} onChange={({ detail }) => setComment(detail.value)} />
          </FormField>
          <FormField label="Traffic policy JSON document">
            <Textarea value={documentDraft} onChange={({ detail }) => setDocumentDraft(detail.value)} rows={12} />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={deleteModalVisible}
        onDismiss={() => setDeleteModalVisible(false)}
        header="Delete traffic policy"
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
        Are you sure you want to delete traffic policy <b>{selected[0]?.name}</b>?
      </Modal>
    </ConsoleLayout>
  );
}
