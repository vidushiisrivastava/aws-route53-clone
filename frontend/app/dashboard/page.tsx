'use client';

import React, { useEffect, useState } from 'react';
import ConsoleLayout from '../components/ConsoleLayout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Button from '@cloudscape-design/components/button';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Link from '@cloudscape-design/components/link';
import Badge from '@cloudscape-design/components/badge';
import Table from '@cloudscape-design/components/table';
import { useRouter } from 'next/navigation';
import {
  api,
  HostedZone,
  HealthCheck,
  TrafficPolicy,
  PolicyRecord,
  ResolverEndpoint,
  ResolverRule,
  Route53Profile,
  getHostedZoneType,
  hostedZoneHref,
} from '../lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [zones, setZones] = useState<HostedZone[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [policies, setPolicies] = useState<TrafficPolicy[]>([]);
  const [policyRecords, setPolicyRecords] = useState<PolicyRecord[]>([]);
  const [endpoints, setEndpoints] = useState<ResolverEndpoint[]>([]);
  const [rules, setRules] = useState<ResolverRule[]>([]);
  const [profiles, setProfiles] = useState<Route53Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<HostedZone[]>('/zones/'),
      api.get<HealthCheck[]>('/health-checks/'),
      api.get<TrafficPolicy[]>('/traffic-policies/'),
      api.get<PolicyRecord[]>('/policy-records/'),
      api.get<ResolverEndpoint[]>('/resolver/endpoints/'),
      api.get<ResolverRule[]>('/resolver/rules/'),
      api.get<Route53Profile[]>('/profiles/'),
    ])
      .then(([zRes, hcRes, tpRes, prRes, epRes, rRes, profRes]) => {
        if (zRes.status === 'fulfilled') setZones(zRes.value.data);
        if (hcRes.status === 'fulfilled') setHealthChecks(hcRes.value.data);
        if (tpRes.status === 'fulfilled') setPolicies(tpRes.value.data);
        if (prRes.status === 'fulfilled') setPolicyRecords(prRes.value.data);
        if (epRes.status === 'fulfilled') setEndpoints(epRes.value.data);
        if (rRes.status === 'fulfilled') setRules(rRes.value.data);
        if (profRes.status === 'fulfilled') setProfiles(profRes.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const healthyCount = healthChecks.filter((h) => h.status === 'Healthy').length;
  const unhealthyCount = healthChecks.filter((h) => h.status === 'Unhealthy').length;

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'Route 53', href: '/dashboard' },
        { text: 'Dashboard', href: '/dashboard' },
      ]}
      contentType="default"
    >
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="Amazon Route 53 is a highly available and scalable cloud Domain Name System (DNS) web service."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => router.push('/health-checks')}>
                Create health check
              </Button>
              <Button variant="primary" onClick={() => router.push('/hosted-zones/create')}>
                Create hosted zone
              </Button>
            </SpaceBetween>
          }
        >
          Route 53 Dashboard
        </Header>

        {/* DNS Management & Traffic Summary */}
        <Container header={<Header variant="h2">DNS management</Header>}>
          <ColumnLayout columns={4} variant="text-grid">
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Hosted zones</Box>
              <Box variant="h1" color="text-status-info">
                {loading ? '...' : zones.length}
              </Box>
              <Link onFollow={() => router.push('/hosted-zones')}>View hosted zones</Link>
            </SpaceBetween>

            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Health checks</Box>
              <Box variant="h1">
                {loading ? '...' : healthChecks.length}
              </Box>
              <Box variant="small" color="text-status-inactive">
                {healthyCount} healthy, {unhealthyCount} unhealthy
              </Box>
              <Link onFollow={() => router.push('/health-checks')}>View health checks</Link>
            </SpaceBetween>

            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Traffic policies</Box>
              <Box variant="h1">{loading ? '...' : policies.length}</Box>
              <Link onFollow={() => router.push('/traffic-policies')}>View traffic policies</Link>
            </SpaceBetween>

            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Policy records</Box>
              <Box variant="h1">{loading ? '...' : policyRecords.length}</Box>
              <Link onFollow={() => router.push('/policy-records')}>View policy records</Link>
            </SpaceBetween>
          </ColumnLayout>
        </Container>

        {/* Resolver & Profiles Summary */}
        <ColumnLayout columns={2}>
          <Container header={<Header variant="h2">Route 53 Resolver &amp; Profiles</Header>}>
            <ColumnLayout columns={3} variant="text-grid">
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Resolver endpoints</Box>
                <Box variant="h2">{loading ? '...' : endpoints.length}</Box>
                <Link onFollow={() => router.push('/resolver')}>View endpoints</Link>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Resolver rules</Box>
                <Box variant="h2">{loading ? '...' : rules.length}</Box>
                <Link onFollow={() => router.push('/resolver')}>View rules</Link>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Profiles</Box>
                <Box variant="h2">{loading ? '...' : profiles.length}</Box>
                <Link onFollow={() => router.push('/profiles')}>View profiles</Link>
              </SpaceBetween>
            </ColumnLayout>
          </Container>

          <Container header={<Header variant="h2">Service health</Header>}>
            <SpaceBetween size="s">
              <StatusIndicator type="success">Amazon Route 53 (Global) – Service is operating normally</StatusIndicator>
              <StatusIndicator type="success">Route 53 Health Checks – Operational</StatusIndicator>
              <StatusIndicator type="success">Route 53 Resolver – Operational</StatusIndicator>
            </SpaceBetween>
          </Container>
        </ColumnLayout>

        {/* Recent Hosted Zones */}
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: 'Hosted zone name',
              cell: (item) => (
                <Link onFollow={() => router.push(hostedZoneHref(item, zones))}>
                  {item.name}
                </Link>
              ),
              isRowHeader: true,
            },
            {
              id: 'type',
              header: 'Type',
              cell: (item) => {
                const zType = getHostedZoneType(item);
                return (
                  <Badge color={zType === 'Public' ? 'blue' : 'grey'}>
                    {zType === 'Public' ? 'Public hosted zone' : 'Private hosted zone'}
                  </Badge>
                );
              },
            },
            {
              id: 'record_count',
              header: 'Record count',
              cell: (item) => item.record_count ?? '-',
            },
            {
              id: 'comment',
              header: 'Description',
              cell: (item) => item.comment || '-',
            },
          ]}
          items={zones.slice(0, 5)}
          loading={loading}
          loadingText="Loading hosted zones..."
          empty={
            <Box textAlign="center" color="text-status-inactive" margin={{ vertical: 'xs' }}>
              <SpaceBetween size="s">
                <Box>No hosted zones found.</Box>
                <Button variant="primary" onClick={() => router.push('/hosted-zones/create')}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            </Box>
          }
          header={
            <Header
              variant="h2"
              counter={`(${zones.length})`}
              actions={<Button onClick={() => router.push('/hosted-zones')}>View all hosted zones</Button>}
            >
              Hosted zones
            </Header>
          }
        />

        {/* Getting Started */}
        <Container header={<Header variant="h2">Getting started with Route 53</Header>}>
          <ColumnLayout columns={3}>
            <SpaceBetween size="s">
              <Box variant="h3">DNS management</Box>
              <Box color="text-status-inactive">
                Route internet traffic to your resources by creating a public or private hosted zone and adding DNS records.
              </Box>
              <Button onClick={() => router.push('/hosted-zones/create')}>Create hosted zone</Button>
            </SpaceBetween>
            <SpaceBetween size="s">
              <Box variant="h3">Traffic management</Box>
              <Box color="text-status-inactive">
                Use traffic policies to build sophisticated routing configurations with weighted, failover, and latency rules.
              </Box>
              <Button onClick={() => router.push('/traffic-policies')}>Create traffic policy</Button>
            </SpaceBetween>
            <SpaceBetween size="s">
              <Box variant="h3">Availability monitoring</Box>
              <Box color="text-status-inactive">
                Monitor the health and performance of your web applications, web servers, and other resources.
              </Box>
              <Button onClick={() => router.push('/health-checks')}>Create health check</Button>
            </SpaceBetween>
          </ColumnLayout>
        </Container>
      </SpaceBetween>
    </ConsoleLayout>
  );
}
