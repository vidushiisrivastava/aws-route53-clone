import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface HostedZone {
  id: string;
  name: string;
  comment?: string;
  type?: string;
  record_count?: number;
}


export interface DNSRecord {
  id: string;
  hosted_zone_id: string;
  name: string;
  type: string;
  routing_policy: string;
  ttl: number;
  values: string;
  is_alias: boolean;
  created_at: string;
}