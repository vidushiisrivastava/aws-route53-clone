'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ConsoleLayout from './components/ConsoleLayout';

function Shield53Icon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path
        d="M32 6L12 14V30C12 43.5 20.5 54 32 58C43.5 54 52 43.5 52 30V14L32 6Z"
        stroke="#ffffff"
        strokeWidth="2.5"
        fill="#161d26"
      />
      <path
        d="M32 10.5L16 17V30C16 41 23 49.8 32 53.5C41 49.8 48 41 48 30V17L32 10.5Z"
        stroke="#8d99a6"
        strokeWidth="1.2"
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="19"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
      >
        53
      </text>
    </svg>
  );
}

export default function Home() {
  const router = useRouter();

  return (
    <ConsoleLayout
      defaultNavOpen={false}
      hideBreadcrumbs={true}
      disableContentPaddings={true}
      contentType="default"
    >
      <div style={{ backgroundColor: '#0f141a', color: '#e5e7eb', minHeight: '100%' }}>
        {/* Hero Banner */}
        <section className="aws-hero-banner">
          <div
            style={{
              maxWidth: 1180,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)',
              gap: 36,
              alignItems: 'start',
            }}
          >
            {/* Left Hero Text */}
            <div style={{ paddingTop: 12 }}>
              <div style={{ fontSize: 13, color: '#aab7b8', marginBottom: 8 }}>
                Network &amp; Content Delivery
              </div>
              <h1 style={{ fontSize: 40, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0', lineHeight: 1.15 }}>
                Amazon Route 53
              </h1>
              <div style={{ fontSize: 30, fontWeight: 300, color: '#e5e7eb', margin: '0 0 18px 0', lineHeight: 1.25 }}>
                A reliable way to route users to internet applications
              </div>
              <p style={{ fontSize: 14, color: '#aab7b8', margin: 0, lineHeight: 1.55, maxWidth: 560 }}>
                Amazon Route 53 is a highly available and scalable cloud Domain Name System (DNS) web service.
              </p>
            </div>

            {/* Right Hero Action Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="aws-card">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 10px 0' }}>
                  Get started with Route 53
                </h2>
                <p style={{ fontSize: 13, color: '#d1d5db', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  Get started by registering a domain, configuring DNS, or using another Route 53 feature.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="aws-orange-btn"
                    onClick={() => router.push('/hosted-zones')}
                  >
                    Get started
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    style={{
                      background: 'transparent',
                      border: '1px solid #539fe5',
                      color: '#539fe5',
                      borderRadius: 20,
                      padding: '7px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open Dashboard
                  </button>
                </div>
              </div>

              <div className="aws-card" style={{ padding: '18px 24px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                  Pricing (US)
                </h3>
                <a
                  className="aws-link"
                  style={{ fontSize: 14 }}
                  href="https://aws.amazon.com/route53/pricing/"
                  target="_blank"
                  rel="noreferrer"
                >
                  View pricing ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Grid */}
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '32px 48px 56px 48px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)',
            gap: 36,
            alignItems: 'start',
          }}
        >
          {/* Left Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {/* How it works */}
            <section>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                How it works
              </h2>
              <div className="aws-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #414d5c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    aws
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Amazon Route 53</div>
                    <div style={{ fontSize: 11, color: '#9ba7b6' }}>Amazon Web Services</div>
                  </div>
                </div>

                {/* Architecture Flow SVG */}
                <svg viewBox="0 0 640 210" width="100%" style={{ display: 'block', background: '#0f141a', borderRadius: 8 }}>
                  {/* Dashed Connections */}
                  <line x1="150" y1="75" x2="290" y2="120" stroke="#e5a00d" strokeWidth="2" strokeDasharray="5,5" />
                  <line x1="490" y1="75" x2="350" y2="120" stroke="#e5a00d" strokeWidth="2" strokeDasharray="5,5" />
                  <line x1="320" y1="155" x2="320" y2="188" stroke="#539fe5" strokeWidth="2" strokeDasharray="4,4" />

                  {/* Left node: Application / DNS Client */}
                  <rect x="85" y="42" width="60" height="44" rx="4" fill="#161d26" stroke="#8d99a6" strokeWidth="2" />
                  <rect x="93" y="50" width="44" height="28" rx="2" fill="#0f141a" stroke="#539fe5" strokeWidth="1.5" />
                  <text x="115" y="106" textAnchor="middle" fill="#aab7b8" fontSize="12">DNS Resolver / Client</text>

                  {/* Right node: Internet */}
                  <circle cx="515" cy="64" r="24" fill="#161d26" stroke="#ffffff" strokeWidth="2" />
                  <ellipse cx="515" cy="64" rx="11" ry="24" fill="none" stroke="#8d99a6" strokeWidth="1.4" />
                  <line x1="491" y1="64" x2="539" y2="64" stroke="#8d99a6" strokeWidth="1.4" />
                  <text x="515" y="106" textAnchor="middle" fill="#aab7b8" fontSize="12">Internet Users</text>

                  {/* Center Shield: Route 53 */}
                  <path
                    d="M320 74L280 88V118C280 144 297 165 320 172C343 165 360 144 360 118V88L320 74Z"
                    fill="#dd344c"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                  <text x="320" y="132" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700">
                    53
                  </text>
                  <text x="320" y="200" textAnchor="middle" fill="#e5e7eb" fontSize="12" fontWeight="600">
                    Hosted Zones • Health Checks • Traffic Flow
                  </text>
                </svg>
              </div>
            </section>

            {/* Products */}
            <section>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                Products
              </h2>
              <div className="aws-card" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                {/* Domain names */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div style={{ width: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }}>
                    <Shield53Icon size={48} />
                    <svg width="72" height="44" viewBox="0 0 72 44" fill="none">
                      <path d="M2 14C20 8 36 8 54 14" stroke="#539fe5" strokeWidth="1.5" strokeDasharray="3,3" />
                      <path d="M2 24C20 20 36 20 54 24" stroke="#539fe5" strokeWidth="1.5" strokeDasharray="3,3" />
                      <rect x="24" y="4" width="44" height="32" rx="3" stroke="#ffffff" strokeWidth="1.8" fill="#161d26" />
                      <line x1="24" y1="12" x2="68" y2="12" stroke="#8d99a6" strokeWidth="1.2" />
                    </svg>
                  </div>
                  <div>
                    <a
                      className="aws-link"
                      style={{ fontSize: 16, fontWeight: 700 }}
                      onClick={() => router.push('/hosted-zones/create')}
                    >
                      Domain names
                    </a>
                    <p style={{ fontSize: 13, color: '#d1d5db', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      A domain is the name, such as example.com, that your users use to access your application.
                    </p>
                  </div>
                </div>

                {/* Hosted zones */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div style={{ width: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
                    <Shield53Icon size={32} />
                    <Shield53Icon size={48} />
                    <Shield53Icon size={32} />
                  </div>
                  <div>
                    <a
                      className="aws-link"
                      style={{ fontSize: 16, fontWeight: 700 }}
                      onClick={() => router.push('/hosted-zones')}
                    >
                      Hosted zones
                    </a>
                    <p style={{ fontSize: 13, color: '#d1d5db', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Specify how you want Route 53 to respond to DNS queries for a domain such as example.com.
                    </p>
                  </div>
                </div>

                {/* Health checks */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div style={{ width: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
                    <svg width="160" height="44" viewBox="0 0 160 44" fill="none">
                      <polyline
                        points="4,22 24,22 30,8 38,38 46,14 52,22 108,22 114,8 122,38 130,14 136,22 156,22"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                    <div style={{ position: 'absolute' }}>
                      <Shield53Icon size={46} />
                    </div>
                  </div>
                  <div>
                    <a
                      className="aws-link"
                      style={{ fontSize: 16, fontWeight: 700 }}
                      onClick={() => router.push('/health-checks')}
                    >
                      Health checks
                    </a>
                    <p style={{ fontSize: 13, color: '#d1d5db', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Monitor your applications and web resources, and direct DNS queries to healthy resources.
                    </p>
                  </div>
                </div>

                {/* Traffic flow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div style={{ width: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
                    <Shield53Icon size={46} />
                    <svg width="86" height="46" viewBox="0 0 86 46" fill="none">
                      <path d="M4 23C24 23 28 8 48 8M4 23C24 23 28 38 48 38M48 8L78 4M48 8L78 16M48 38L78 30M48 38L78 42" stroke="#539fe5" strokeWidth="1.5" strokeDasharray="3,3" />
                      <circle cx="80" cy="4" r="3" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx="80" cy="16" r="3" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx="80" cy="30" r="3" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx="80" cy="42" r="3" stroke="#ffffff" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div>
                    <a
                      className="aws-link"
                      style={{ fontSize: 16, fontWeight: 700 }}
                      onClick={() => router.push('/traffic-policies')}
                    >
                      Traffic flow
                    </a>
                    <p style={{ fontSize: 13, color: '#d1d5db', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Use a visual tool to create policies for multiple endpoints in complex configurations.
                    </p>
                  </div>
                </div>

                {/* Resolver */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div style={{ width: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }}>
                    <svg width="38" height="42" viewBox="0 0 38 42" fill="none">
                      <rect x="4" y="4" width="30" height="10" rx="2" stroke="#ffffff" strokeWidth="1.6" />
                      <rect x="4" y="16" width="30" height="10" rx="2" stroke="#ffffff" strokeWidth="1.6" />
                      <rect x="4" y="28" width="30" height="10" rx="2" stroke="#ffffff" strokeWidth="1.6" />
                    </svg>
                    <Shield53Icon size={46} />
                    <svg width="38" height="42" viewBox="0 0 38 42" fill="none">
                      <path d="M10 28C6 28 3 25 3 21C3 17.5 5.5 14.5 9 14C10.5 9.5 15 7 20 8C24.5 9 27.5 12.5 28 16.5C31.5 17 34 19.5 34 23C34 26 31.5 28 28.5 28H10Z" stroke="#ffffff" strokeWidth="1.6" />
                    </svg>
                  </div>
                  <div>
                    <a
                      className="aws-link"
                      style={{ fontSize: 16, fontWeight: 700 }}
                      onClick={() => router.push('/resolver')}
                    >
                      Resolver
                    </a>
                    <p style={{ fontSize: 13, color: '#d1d5db', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Route DNS queries between your VPCs and your network.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Benefits and features */}
            <section>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                Benefits and features
              </h2>
              <div
                className="aws-card"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 28,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Highly available and reliable
                  </h3>
                  <p style={{ fontSize: 13, color: '#d1d5db', margin: 0, lineHeight: 1.55 }}>
                    Amazon Route 53 is built using AWS&apos;s highly available and reliable infrastructure. Our distributed DNS servers ensure that you can consistently route your end users to your application.
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Designed for use with other AWS services
                  </h3>
                  <p style={{ fontSize: 13, color: '#d1d5db', margin: 0, lineHeight: 1.55 }}>
                    You can use Amazon Route 53 to map domain names to your Amazon EC2 instances, Amazon S3 buckets, Amazon CloudFront distributions, and other AWS resources.
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Simple
                  </h3>
                  <p style={{ fontSize: 13, color: '#d1d5db', margin: 0, lineHeight: 1.55 }}>
                    You can quickly sign up, and Amazon Route 53 can start to answer your DNS queries within minutes.
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Flexible
                  </h3>
                  <p style={{ fontSize: 13, color: '#d1d5db', margin: 0, lineHeight: 1.55 }}>
                    Amazon Route 53 routes traffic based on multiple criteria, such as endpoint health, geographic location, and latency.
                  </p>
                </div>
              </div>
            </section>

            {/* Use cases */}
            <section>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                Use cases
              </h2>
              <div
                className="aws-card"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 28,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Global traffic management
                  </h3>
                  <p style={{ fontSize: 13, color: '#d1d5db', margin: 0, lineHeight: 1.55 }}>
                    Route 53 Traffic Flow helps you construct sophisticated routing configurations for resources in multiple AWS and non-AWS locations.{' '}
                    <a className="aws-link" onClick={() => router.push('/traffic-policies')}>
                      Learn more ↗
                    </a>
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                    Alias to AWS resources
                  </h3>
                  <p style={{ fontSize: 13, color: '#d1d5db', margin: 0, lineHeight: 1.55 }}>
                    You can use Route 53 alias records to map your zone apex (such as example.com) or a subdomain to selected AWS resources. For example, you can route traffic to ELB load balancers, CloudFront distributions, or S3 buckets.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar: More resources */}
          <aside>
            <div className="aws-card">
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', margin: '0 0 14px 0' }}>
                More resources ↗
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <a className="aws-link" href="https://docs.aws.amazon.com/route53/" target="_blank" rel="noreferrer">
                  Documentation
                </a>
                <a className="aws-link" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
                  API reference
                </a>
                <a className="aws-link" href="https://aws.amazon.com/route53/faqs/" target="_blank" rel="noreferrer">
                  FAQs
                </a>
                <a className="aws-link" onClick={() => router.push('/health-checks')}>
                  Forum - DNS and health checks
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </ConsoleLayout>
  );
}
