import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_APP_DIR = path.resolve(__dirname, '../app');

function walkTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const tsxFiles = walkTsxFiles(FRONTEND_APP_DIR);

test('frontend TSX files discovered cleanly', () => {
  assert.ok(tsxFiles.length >= 5, `Expected multiple TSX files, found ${tsxFiles.length}`);
});

test('every TextFilter specifies controlId for label/input accessibility', () => {
  const missing: string[] = [];
  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.matchAll(/<TextFilter\b([\s\S]*?)\/>/g);
    for (const match of matches) {
      if (!/\bcontrolId=/.test(match[1])) {
        missing.push(path.relative(FRONTEND_APP_DIR, file));
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('every native <input> element has both id and name attributes', () => {
  const violations: string[] = [];
  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.matchAll(/<input\b([\s\S]*?)>/g);
    for (const match of matches) {
      const attrs = match[1];
      if (!/\bid=/.test(attrs) || !/\bname=/.test(attrs)) {
        violations.push(`${path.relative(FRONTEND_APP_DIR, file)}: <input ${attrs.trim().slice(0, 60)}>`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('FormField does not directly wrap Tiles or Toggle without explicit accessibility decoupling', () => {
  const violations: string[] = [];
  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const formFields = content.matchAll(/<FormField\b[^>]*>([\s\S]*?)<\/FormField>/g);
    for (const field of formFields) {
      const inner = field[1];
      if (/<Tiles\b/.test(inner) || /<Toggle\b/.test(inner)) {
        violations.push(path.relative(FRONTEND_APP_DIR, file));
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('root layout wraps application in ClientShell to avoid Cloudscape SSR hydration mismatch', () => {
  const layoutPath = path.join(FRONTEND_APP_DIR, 'layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  assert.match(layoutContent, /ClientShell/);
  assert.match(layoutContent, /<ClientShell>\{children\}<\/ClientShell>/);
});

test('API calls avoid bare collection trailing-slash omissions that trigger HTTP-to-HTTPS redirect issues', () => {
  const collectionEndpoints = [
    '/zones',
    '/health-checks',
    '/traffic-policies',
    '/policy-records',
    '/resolver-endpoints',
    '/resolver-rules',
    '/profiles',
  ];
  const violations: string[] = [];
  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const endpoint of collectionEndpoints) {
      const badCall = new RegExp(`api\\.(get|post)\\(\\s*['"]${endpoint}['"]`, 'g');
      if (badCall.test(content)) {
        violations.push(`${path.relative(FRONTEND_APP_DIR, file)} calls ${endpoint} without trailing '/'`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

