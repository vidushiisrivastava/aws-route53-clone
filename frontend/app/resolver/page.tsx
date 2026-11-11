'use client';

import React, { useState, useEffect } from 'react';
import ConsoleLayout from '../components/ConsoleLayout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Tabs from '@cloudscape-design/components/tabs';
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import { api, ResolverEndpoint, ResolverRule } from '../lib/api';

export default function ResolverPage() {
  const [rules, setRules] = useState<ResolverRule[]>([]);
  const [endpoints, setEndpoints] = useState<ResolverEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<ResolverRule[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ResolverEndpoint[]>([]);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [endpointModalVisible, setEndpointModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rule form
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState({ label: 'Forward', value: 'FORWARD' });
  const [domainName, setDomainName] = useState('');
  const [targetIp, setTargetIp] = useState('192.168.1.1');
  const [ruleVpcId, setRuleVpcId] = useState('vpc-0a1b2c3d4e5f67890');

  // Endpoint form
  const [endpointName, setEndpointName] = useState('');
  const [direction, setDirection] = useState({ label: 'Outbound', value: 'OUTBOUND' });
  const [epVpcId, setEpVpcId] = useState('vpc-0a1b2c3d4e5f67890');
  const [ipAddresses, setIpAddresses] = useState('10.0.1.10, 10.0.2.10');

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [epRes, ruleRes] = await Promise.all([
        api.get<ResolverEndpoint[]>('/resolver/endpoints/'),
        api.get<ResolverRule[]>('/resolver/rules/'),
      ]);
      setEndpoints(epRes.data);
      setRules(ruleRes.data);
    } catch (err) {
      console.error('Failed to load resolver data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreateEndpoint = async () => {
    try {
      setSubmitting(true);
      await api.post('/resolver/endpoints/', {
        name: endpointName.trim(),
        direction: direction.value,
        vpc_id: epVpcId.trim(),
        ip_addresses: ipAddresses.trim(),
      });
      setEndpointModalVisible(false);
      setEndpointName('');
      await fetchAll();
    } catch (err) {
      console.error('Failed to create endpoint', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEndpoint = async () => {
    if (!selectedEndpoint[0]) return;
    try {
      setSubmitting(true);
      await api.delete(`/resolver/endpoints/${selectedEndpoint[0].id}`);
      setSelectedEndpoint([]);
      await fetchAll();
    } catch (err) {
      console.error('Failed to delete endpoint', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRule = async () => {
    try {
      setSubmitting(true);
      await api.post('/resolver/rules/', {
        name: ruleName.trim(),
        rule_type: ruleType.value,
        domain_name: domainName.trim(),
        target_ip: targetIp.trim(),
        vpc_id: ruleVpcId.trim(),
      });
      setRuleModalVisible(false);
      setRuleName('');
      setDomainName('');
      await fetchAll();
    } catch (err) {
      console.error('Failed to create rule', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedRule[0]) return;
    try {
      setSubmitting(true);
      await api.delete(`/resolver/rules/${selectedRule[0].id}`);
      setSelectedRule([]);
      await fetchAll();
    } catch (err) {
      console.error('Failed to delete rule', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/' },
        { text: 'Resolver', href: '/resolver' },
      ]}
      contentType="default"
    >
      <SpaceBetween size="l">
        <Header variant="h1" description="Route DNS queries between your VPCs and your network">
          Route 53 Resolver
        </Header>

        <Tabs
          tabs={[
            {
              label: `Inbound & Outbound endpoints (${endpoints.length})`,
              id: 'endpoints',
              content: (
                <Table
                  columnDefinitions={[
                    { id: 'name', header: 'Endpoint name', cell: (item) => item.name, isRowHeader: true },
                    { id: 'id', header: 'Endpoint ID', cell: (item) => <Box variant="code">rslvr-ep-{item.id}</Box> },
                    {
                      id: 'direction',
                      header: 'Direction',
                      cell: (item) => (
                        <Badge color={item.direction === 'INBOUND' ? 'blue' : 'green'}>
                          {item.direction}
                        </Badge>
                      ),
                    },
                    { id: 'vpc', header: 'VPC ID', cell: (item) => <Box variant="code">{item.vpc_id}</Box> },
                    { id: 'ips', header: 'IP addresses', cell: (item) => <Box variant="code">{item.ip_addresses}</Box> },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: (item) => <StatusIndicator type="success">{item.status}</StatusIndicator>,
                    },
                  ]}
                  items={endpoints}
                  loading={loading}
                  selectionType="single"
                  selectedItems={selectedEndpoint}
                  onSelectionChange={({ detail }) => setSelectedEndpoint(detail.selectedItems)}
                  trackBy="id"
                  empty={
                    <Box textAlign="center" margin={{ vertical: 'xs' }}>
                      <SpaceBetween size="m">
                        <b>No resolver endpoints</b>
                        <Button onClick={() => setEndpointModalVisible(true)}>Create endpoint</Button>
                      </SpaceBetween>
                    </Box>
                  }
                  header={
                    <Header
                      variant="h2"
                      counter={`(${endpoints.length})`}
                      actions={
                        <SpaceBetween direction="horizontal" size="xs">
                          <Button
                            disabled={selectedEndpoint.length === 0}
                            loading={submitting}
                            onClick={handleDeleteEndpoint}
                          >
                            Delete
                          </Button>
                          <Button variant="primary" onClick={() => setEndpointModalVisible(true)}>
                            Create endpoint
                          </Button>
                        </SpaceBetween>
                      }
                    >
                      Resolver endpoints
                    </Header>
                  }
                />
              ),
            },
            {
              label: `Rules (${rules.length})`,
              id: 'rules',
              content: (
                <Table
                  columnDefinitions={[
                    { id: 'name', header: 'Rule name', cell: (item) => item.name, isRowHeader: true },
                    { id: 'id', header: 'Rule ID', cell: (item) => <Box variant="code">rslvr-rr-{item.id}</Box> },
                    { id: 'type', header: 'Rule type', cell: (item) => item.rule_type },
                    { id: 'domain', header: 'Domain name', cell: (item) => <Box variant="code">{item.domain_name}</Box> },
                    { id: 'target', header: 'Target IP', cell: (item) => <Box variant="code">{item.target_ip}</Box> },
                    { id: 'vpc', header: 'VPC ID', cell: (item) => <Box variant="code">{item.vpc_id}</Box> },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: (item) => <StatusIndicator type="success">{item.status}</StatusIndicator>,
                    },
                  ]}
                  items={rules}
                  loading={loading}
                  selectionType="single"
                  selectedItems={selectedRule}
                  onSelectionChange={({ detail }) => setSelectedRule(detail.selectedItems)}
                  trackBy="id"
                  empty={
                    <Box textAlign="center" margin={{ vertical: 'xs' }}>
                      <SpaceBetween size="m">
                        <b>No resolver rules</b>
                        <Button onClick={() => setRuleModalVisible(true)}>Create rule</Button>
                      </SpaceBetween>
                    </Box>
                  }
                  header={
                    <Header
                      variant="h2"
                      counter={`(${rules.length})`}
                      actions={
                        <SpaceBetween direction="horizontal" size="xs">
                          <Button
                            disabled={selectedRule.length === 0}
                            loading={submitting}
                            onClick={handleDeleteRule}
                          >
                            Delete
                          </Button>
                          <Button variant="primary" onClick={() => setRuleModalVisible(true)}>
                            Create rule
                          </Button>
                        </SpaceBetween>
                      }
                    >
                      Resolver rules
                    </Header>
                  }
                />
              ),
            },
          ]}
        />
      </SpaceBetween>

      {/* Endpoint Modal */}
      <Modal
        visible={endpointModalVisible}
        onDismiss={() => setEndpointModalVisible(false)}
        header="Create resolver endpoint"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEndpointModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateEndpoint} loading={submitting} disabled={!endpointName.trim()}>
                Submit
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Endpoint name">
            <Input value={endpointName} onChange={({ detail }) => setEndpointName(detail.value)} placeholder="my-resolver-endpoint" />
          </FormField>
          <ColumnLayout columns={2}>
            <FormField label="Direction">
              <Select
                selectedOption={direction}
                onChange={({ detail }) => setDirection(detail.selectedOption as any)}
                options={[
                  { label: 'Inbound', value: 'INBOUND' },
                  { label: 'Outbound', value: 'OUTBOUND' },
                ]}
              />
            </FormField>
            <FormField label="VPC ID">
              <Input value={epVpcId} onChange={({ detail }) => setEpVpcId(detail.value)} />
            </FormField>
          </ColumnLayout>
          <FormField label="IP addresses (2 Availability Zones)">
            <Input value={ipAddresses} onChange={({ detail }) => setIpAddresses(detail.value)} />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Rule Modal */}
      <Modal
        visible={ruleModalVisible}
        onDismiss={() => setRuleModalVisible(false)}
        header="Create resolver rule"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setRuleModalVisible(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateRule}
                loading={submitting}
                disabled={!ruleName.trim() || !domainName.trim()}
              >
                Submit
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Rule name">
            <Input value={ruleName} onChange={({ detail }) => setRuleName(detail.value)} placeholder="corp-dns-forward" />
          </FormField>
          <ColumnLayout columns={2}>
            <FormField label="Rule type">
              <Select
                selectedOption={ruleType}
                onChange={({ detail }) => setRuleType(detail.selectedOption as any)}
                options={[
                  { label: 'Forward', value: 'FORWARD' },
                  { label: 'System', value: 'SYSTEM' },
                ]}
              />
            </FormField>
            <FormField label="VPC ID">
              <Input value={ruleVpcId} onChange={({ detail }) => setRuleVpcId(detail.value)} />
            </FormField>
          </ColumnLayout>
          <FormField label="Domain name">
            <Input value={domainName} onChange={({ detail }) => setDomainName(detail.value)} placeholder="corp.example.com" />
          </FormField>
          <FormField label="Target IP address">
            <Input value={targetIp} onChange={({ detail }) => setTargetIp(detail.value)} placeholder="192.168.1.1" />
          </FormField>
        </SpaceBetween>
      </Modal>
    </ConsoleLayout>
  );
}
