'use client';

import React from 'react';
import ConsoleLayout from './components/ConsoleLayout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <ConsoleLayout
      breadcrumbs={[{ text: 'Route 53', href: '/' }, { text: 'Dashboard', href: '/' }]}
    >
      <Container
        header={
          <Header
            variant="h1"
            description="Scalable Domain Name System (DNS) and Domain Name Registration"
            actions={
              <Button
                variant="primary"
                onClick={() => router.push('/hosted-zones')}
              >
                Go to Hosted zones
              </Button>
            }
          >
            DNS management
          </Header>
        }
      >
        <SpaceBetween size="m">
          <p>
            Amazon Route 53 is a highly available and scalable cloud Domain Name System (DNS) web service.
            Manage your hosted zones and configure DNS records to route internet traffic.
          </p>
        </SpaceBetween>
      </Container>
    </ConsoleLayout>
  );
}