'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';

import ConsoleLayout from '../../components/ConsoleLayout';
import { api } from '../../lib/api';

export default function CreateHostedZonePage() {
  const router = useRouter();
  const [domainName, setDomainName] = useState('');
  const [description, setDescription] = useState('');
  const [zoneType, setZoneType] = useState('Public');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!domainName.trim()) {
      setError('Domain name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/api/hosted-zones', {
        name: domainName.trim(),
        description: description.trim(),
        type: zoneType,
      });
      router.push(`/hosted-zones/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create hosted zone.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConsoleLayout
      contentType="form"
      breadcrumbs={[
        { text: 'Route 53', href: '/' },
        { text: 'Hosted zones', href: '/hosted-zones' },
        { text: 'Create hosted zone', href: '/hosted-zones/create' },
      ]}
    >
      <form onSubmit={handleSubmit}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => router.push('/hosted-zones')}>
                Cancel
              </Button>
              <Button variant="primary" loading={isSubmitting}>
                Create hosted zone
              </Button>
            </SpaceBetween>
          }
          errorText={error && <Alert type="error">{error}</Alert>}
        >
          <Container
            header={
              <Header
                variant="h2"
                description="A hosted zone tells Route 53 how to respond to DNS queries for a domain."
              >
                Hosted zone configuration
              </Header>
            }
          >
            <SpaceBetween size="l">
              <FormField
                label="Domain name"
                description="Enter a fully qualified domain name, such as example.com."
              >
                <Input
                  value={domainName}
                  onChange={({ detail }) => setDomainName(detail.value)}
                  placeholder="example.com"
                />
              </FormField>

              <FormField
                label="Description"
                description="Optional comment or notes about this hosted zone."
              >
                <Textarea
                  value={description}
                  onChange={({ detail }) => setDescription(detail.value)}
                  placeholder="Production domain"
                  rows={2}
                />
              </FormField>

              <FormField
                label="Type"
                description="Determines whether this zone routes internet traffic or traffic within an Amazon VPC."
              >
                <RadioGroup
                  value={zoneType}
                  onChange={({ detail }) => setZoneType(detail.value)}
                  items={[
                    {
                      value: 'Public',
                      label: 'Public hosted zone',
                      description: 'Routes traffic on the internet.',
                    },
                    {
                      value: 'Private',
                      label: 'Private hosted zone',
                      description: 'Routes traffic within an Amazon VPC.',
                    },
                  ]}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </ConsoleLayout>
  );
}