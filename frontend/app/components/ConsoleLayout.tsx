'use client';

import React, { useState } from 'react';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import AppLayout from '@cloudscape-design/components/app-layout';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import { useRouter, usePathname } from 'next/navigation';

interface ConsoleLayoutProps {
    children: React.ReactNode;
    breadcrumbs?: Array<{ text: string; href: string }>;
    contentType?: 'default' | 'table' | 'form' | 'cards';
}

export default function ConsoleLayout({
    children,
    breadcrumbs = [{ text: 'Route 53', href: '/' }, { text: 'Hosted zones', href: '/hosted-zones' }],
    contentType = 'table',
}: ConsoleLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [navigationOpen, setNavigationOpen] = useState(true);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* AWS Top Navigation Bar */}
            <TopNavigation
                identity={{
                    href: '/',
                    title: 'Amazon Route 53',
                }}
                utilities={[
                    {
                        type: 'button',
                        text: 'Global',
                        iconName: 'globe',
                        ariaLabel: 'Region: Global',
                    },
                    {
                        type: 'menu-dropdown',
                        text: 'Admin @ AWS-Account',
                        description: 'Account ID: 1234-5678-9012',
                        iconName: 'user-profile',
                        items: [
                            { id: 'account', text: 'Account details' },
                            { id: 'signout', text: 'Sign out' },
                        ],
                        onItemClick: (e) => {
                            if (e.detail.id === 'signout') {
                                localStorage.removeItem('auth_token');
                                alert('Signed out');
                            }
                        },
                    },
                ]}
            />

            {/* Cloudscape AWS App Layout */}
            <AppLayout
                contentType={contentType}
                navigationOpen={navigationOpen}
                onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
                breadcrumbs={<BreadcrumbGroup items={breadcrumbs} />}
                navigation={
                    <SideNavigation
                        activeHref={pathname}
                        header={{ href: '/', text: 'Route 53' }}
                        onFollow={(event) => {
                            event.preventDefault();
                            router.push(event.detail.href);
                        }}
                        items={[
                            { type: 'link', text: 'Dashboard', href: '/dashboard' },
                            { type: 'link', text: 'Hosted zones', href: '/hosted-zones' },
                            { type: 'divider' },
                            {
                                type: 'section',
                                text: 'Traffic management',
                                items: [
                                    { type: 'link', text: 'Traffic policies', href: '/traffic-policies' },
                                    { type: 'link', text: 'Policy records', href: '/policy-records' },
                                ],
                            },
                            {
                                type: 'section',
                                text: 'Availability monitoring',
                                items: [
                                    { type: 'link', text: 'Health checks', href: '/health-checks' },
                                ],
                            },
                            {
                                type: 'section',
                                text: 'DNS Firewall & Resolver',
                                items: [
                                    { type: 'link', text: 'Resolver', href: '/resolver' },
                                    { type: 'link', text: 'Profiles', href: '/profiles' },
                                ],
                            },
                        ]}
                    />
                }
                content={children}
            />
        </div>
    );
}