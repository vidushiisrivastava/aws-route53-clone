import axios from 'axios';

// Base URL for the FastAPI backend (adjust if you run on a different host/port)
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  withCredentials: true,
});

// Types for our resources – these should match the Pydantic schemas
export type HostedZone = {
  id: number;
  name: string;
  comment?: string;
  created_at: string;
  owner_id: number;
};

export type DnsRecord = {
  id: number;
  name: string;
  type: string; // A, AAAA, CNAME, etc.
  ttl: number;
  value: string;
  created_at: string;
  zone_id: number;
};

export { api };
