'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Select from '@cloudscape-design/components/select';
import Tiles from '@cloudscape-design/components/tiles';
import ColumnLayout from '@cloudscape-design/components/column-layout';

import ConsoleLayout from '../../components/ConsoleLayout';
import { api, notify, hostedZoneHref } from '../../lib/api';

const AWS_REGIONS = [
  { label: 'US East (N. Virginia) us-east-1', value: 'us-east-1' },
  { label: 'US East (Ohio) us-east-2', value: 'us-east-2' },
  { label: 'US West (Oregon) us-west-2', value: 'us-west-2' },
  { label: 'Europe (Ireland) eu-west-1', value: 'eu-west-1' },
  { label: 'Asia Pacific (Mumbai) ap-south-1', value: 'ap-south-1' },
  { label: 'Asia Pacific (Singapore) ap-southeast-1', value: 'ap-southeast-1' },
];

export default function CreateHostedZonePage() {
  const router = useRouter();
  const [domainName, setDomainName] = useState('');
  const [description, setDescription] = useState('');
  const [zoneType, setZoneType] = useState('public');
  const [vpcRegion, setVpcRegion] = useState(AWS_REGIONS[0]);
  const [vpcId, setVpcId] = useState('vpc-0a1b2c3d4e5f67890');
  const [error, setError] = useState('');
  const [domainNameError, setDomainNameError] = useState('');
  const [bindZoneText, setBindZoneText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateDomain = (value: string) => {
    if (!value.trim()) return 'Domain name is required.';
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/.test(value.trim())) {
      return 'Enter a valid domain name (e.g. example.com).';
    }
    return '';
  };

  const handleSubmit = async () => {
    const domainErr = validateDomain(domainName);
    if (domainErr) {
      setDomainNameError(domainErr);
      return;
    }
    setError('');

    try {
      setIsSubmitting(true);
      const cleanDomain = domainName.trim().replace(/\.$/, '');
      const res = await api.post('/zones/', {
        name: cleanDomain,
        comment: description.trim(),
        type: zoneType === 'private' ? 'Private' : 'Public',
        zone_type: zoneType === 'private' ? 'Private' : 'Public',
        vpc_id: zoneType === 'private' ? vpcId.trim() : undefined,
        vpc_region: zoneType === 'private' ? vpcRegion.value : undefined,
      });

      let importedCount = 0;
      if (bindZoneText.trim()) {
        const impRes = await api.post(`/zones/${res.data.id}/records/import-bind`, {
          zone_file: bindZoneText,
        });
        importedCount = impRes.data.imported ?? 0;
      }

      notify({
        type: 'success',
        header: `Hosted zone ${cleanDomain} created`,
        content: importedCount > 0 ? `Imported ${importedCount} BIND record(s).` : undefined,
      });
      router.push(hostedZoneHref(res.data));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create hosted zone. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConsoleLayout
      contentType="form"
      breadcrumbs={[
        { text: 'Route 53', href: '/dashboard' },
        { text: 'Hosted zones', href: '/hosted-zones' },
        { text: 'Create hosted zone', href: '/hosted-zones/create' },
      ]}
    >
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => router.push('/hosted-zones')}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSubmitting} onClick={handleSubmit}>
              Create hosted zone
            </Button>
          </SpaceBetween>
        }
        header={
          <Header
            variant="h1"
            description="A hosted zone is a container for records, which define how you want to route traffic for a domain, such as example.com, and its subdomains."
          >
            Create hosted zone
          </Header>
        }
        errorText={error}
      >
        <SpaceBetween size="l">
          <Container
            header={
              <Header
                variant="h2"
                description="Configure the basic settings for your hosted zone."
              >
                Hosted zone configuration
              </Header>
            }
          >
            <SpaceBetween size="l">
              <FormField
                label="Domain name"
                description="Enter the name of the domain that you want to route traffic for. Do not include www."
                errorText={domainNameError}
                constraintText="Enter a fully qualified domain name, for example, example.com. The trailing dot is optional."
              >
                <Input
                  name="domain_name"
                  value={domainName}
                  onChange={({ detail }) => {
                    setDomainName(detail.value);
                    if (domainNameError) setDomainNameError('');
                  }}
                  placeholder="example.com"
                />
              </FormField>

              <FormField
                label={
                  <>
                    Description{' '}
                    <Box display="inline" color="text-status-inactive">
                      - optional
                    </Box>
                  </>
                }
                description="A comment that you want to include about the hosted zone."
              >
                <Textarea
                  name="description"
                  value={description}
                  onChange={({ detail }) => setDescription(detail.value)}
                  placeholder="Enter a description"
                  rows={2}
                />
              </FormField>

              <SpaceBetween size="xs">
                <div id="hosted-zone-type-label">
                  <Box variant="awsui-key-label">Type</Box>
                  <Box variant="small" color="text-body-secondary">
                    Determines whether this hosted zone routes internet traffic or traffic within an Amazon VPC.
                  </Box>
                </div>
                <Tiles
                  ariaLabelledby="hosted-zone-type-label"
                  value={zoneType}
                  onChange={({ detail }) => setZoneType(detail.value)}
                  items={[
                    {
                      value: 'public',
                      label: 'Public hosted zone',
                      description:
                        'Route internet traffic to your resources. If you register a domain, Route 53 creates a public hosted zone automatically.',
                    },
                    {
                      value: 'private',
                      label: 'Private hosted zone',
                      description:
                        'Route traffic within an Amazon VPC. You can associate a private hosted zone with one or more VPCs.',
                    },
                  ]}
                />
              </SpaceBetween>
            </SpaceBetween>
          </Container>

          {zoneType === 'private' ? (
            <Container
              header={
                <Header
                  variant="h2"
                  description="Associate this private hosted zone with an Amazon VPC."
                >
                  VPCs to associate with the hosted zone
                </Header>
              }
            >
              <ColumnLayout columns={2}>
                <FormField label="Region">
                  <Select
                    selectedOption={vpcRegion}
                    onChange={({ detail }) => setVpcRegion(detail.selectedOption as any)}
                    options={AWS_REGIONS}
                  />
                </FormField>
                <FormField label="VPC ID" description="Enter the ID of the VPC to associate.">
                  <Input
                    value={vpcId}
                    onChange={({ detail }) => setVpcId(detail.value)}
                    placeholder="vpc-0a1b2c3d4e5f67890"
                  />
                </FormField>
              </ColumnLayout>
            </Container>
          ) : null}

          <ExpandableSection
            headerText="Import zone file (BIND format) - optional"
            headingTagOverride="h2"
          >
            <SpaceBetween size="s">
              <Box color="text-status-inactive">
                Optionally paste BIND zone file records to import automatically when creating this hosted zone.
              </Box>
              <FormField label="Zone file contents">
                <Textarea
                  value={bindZoneText}
                  onChange={({ detail }) => setBindZoneText(detail.value)}
                  rows={5}
                  placeholder={`$TTL 300\n@ IN A 203.0.113.10\nwww IN CNAME ${domainName || 'example.com'}.`}
                />
              </FormField>
            </SpaceBetween>
          </ExpandableSection>

          <ExpandableSection headerText="Tags - optional" headingTagOverride="h2">
            <Box color="text-status-inactive">
              Tags are key-value pairs that you can use to categorize and manage your hosted zones.
            </Box>
          </ExpandableSection>
        </SpaceBetween>
      </Form>
    </ConsoleLayout>
  );
}
