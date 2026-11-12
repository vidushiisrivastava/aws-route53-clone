import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HostedZonesPage from '../../app/hosted-zones/page';
import CreateHostedZonePage from '../../app/hosted-zones/create/page';
import { api, HostedZone } from '../../app/lib/api';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  usePathname: () => '/hosted-zones',
}));

// Keep ConsoleLayout light and focused in unit/integration tests
vi.mock('../../app/components/ConsoleLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="console-layout">{children}</div>
  ),
}));

vi.mock('../../app/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/lib/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const SAMPLE_ZONES: HostedZone[] = [
  {
    id: 101,
    name: 'prod.example.com',
    comment: 'Primary production domain',
    type: 'Public',
    zone_type: 'Public',
    record_count: 5,
    nameservers: ['ns-101.awsdns-10.com.'],
  },
  {
    id: 102,
    name: 'internal.corp',
    comment: 'Private VPC routing',
    type: 'Private',
    zone_type: 'Private',
    vpc_id: 'vpc-0a1b2c3d4e5f67890',
    vpc_region: 'us-east-1',
    record_count: 2,
    nameservers: ['ns-102.awsdns-12.net.'],
  },
];

describe('Hosted Zones Table & Creation Flow (Mocked API Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockReset().mockResolvedValue({ data: SAMPLE_ZONES });
    mockedApi.post.mockReset().mockResolvedValue({ data: {} });
    mockedApi.put.mockReset().mockResolvedValue({ data: {} });
    mockedApi.delete.mockReset().mockResolvedValue({ data: {} });
  });

  it('renders hosted zones from mocked API and filters by search query', async () => {
    const user = userEvent.setup();
    render(<HostedZonesPage />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/zones/');
    });

    expect(await screen.findByText('prod.example.com')).toBeInTheDocument();
    expect(screen.getByText('internal.corp')).toBeInTheDocument();
    expect(screen.getByText('Primary production domain')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Find hosted zone by name, ID, or description');
    await user.type(searchInput, 'internal');

    expect(screen.getByText('internal.corp')).toBeInTheDocument();
    expect(screen.queryByText('prod.example.com')).not.toBeInTheDocument();
  });

  it('edits a hosted zone description via the Edit modal and calls PUT /zones/{id}', async () => {
    const user = userEvent.setup();
    const updatedZone: HostedZone = {
      ...SAMPLE_ZONES[0],
      comment: 'Updated description via integration test',
    };
    mockedApi.get
      .mockResolvedValueOnce({ data: SAMPLE_ZONES })
      .mockResolvedValueOnce({ data: [updatedZone, SAMPLE_ZONES[1]] });

    render(<HostedZonesPage />);
    await screen.findByText('prod.example.com');

    // Select the first hosted zone row checkbox
    const row = screen.getByText('prod.example.com').closest('tr')!;
    const checkbox = within(row).getByRole('checkbox');
    await user.click(checkbox);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const modalHeading = await screen.findByRole('heading', {
      name: /Edit hosted zone: prod\.example\.com/i,
    });
    const dialog = modalHeading.closest('[role="dialog"]') as HTMLElement;

    const commentField = dialog.querySelector('textarea[name="edit_zone_comment"]') as HTMLTextAreaElement;
    await user.clear(commentField);
    await user.type(commentField, 'Updated description via integration test');

    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith('/zones/101', {
        name: 'prod.example.com',
        comment: 'Updated description via integration test',
      });
    });

    const table = screen.getByRole('table');
    expect(
      await within(table).findByText('Updated description via integration test')
    ).toBeInTheDocument();
  });

  it('confirms and deletes a selected hosted zone via the Delete modal', async () => {
    const user = userEvent.setup();
    mockedApi.get
      .mockResolvedValueOnce({ data: SAMPLE_ZONES })
      .mockResolvedValueOnce({ data: [SAMPLE_ZONES[1]] });

    render(<HostedZonesPage />);
    await screen.findByText('prod.example.com');

    const row = screen.getByText('prod.example.com').closest('tr')!;
    await user.click(within(row).getByRole('checkbox'));
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    const modalHeading = await screen.findByRole('heading', { name: 'Delete hosted zone' });
    const dialog = modalHeading.closest('[role="dialog"]') as HTMLElement;
    const confirmInput = within(dialog).getByPlaceholderText('prod.example.com');
    await user.type(confirmInput, 'prod.example.com');

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith('/zones/101');
    });

    await waitFor(() => {
      expect(screen.queryByText('prod.example.com')).not.toBeInTheDocument();
    });
  });

  it('imports a BIND zone file and creates a new hosted zone via the Import BIND modal', async () => {
    const user = userEvent.setup();
    mockedApi.post
      .mockResolvedValueOnce({ data: { id: 205, name: 'imported.dev' } })
      .mockResolvedValueOnce({ data: { imported: 4 } });

    render(<HostedZonesPage />);
    await screen.findByText('prod.example.com');

    await user.click(screen.getByRole('button', { name: 'Import BIND' }));
    const modalHeading = await screen.findByRole('heading', {
      name: 'Import DNS records from BIND zone file',
    });
    const dialog = modalHeading.closest('[role="dialog"]') as HTMLElement;

    const toggle = within(dialog).getByRole('checkbox', {
      name: /Create a new hosted zone for this BIND file/i,
    });
    await user.click(toggle);

    const domainInput = within(dialog).getByPlaceholderText('example.com');
    await user.type(domainInput, 'imported.dev');
    await user.click(within(dialog).getByRole('button', { name: 'Insert sample BIND file' }));
    await user.click(within(dialog).getByRole('button', { name: 'Import records' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/zones/', {
        name: 'imported.dev',
        comment: 'Imported from BIND zone file',
        type: 'Public',
        zone_type: 'Public',
      });
      expect(mockedApi.post).toHaveBeenNthCalledWith(
        2,
        '/zones/205/records/import-bind',
        expect.objectContaining({
          zone_file: expect.stringContaining('$ORIGIN imported.dev.'),
        })
      );
    });
  });

  it('validates domain input and submits CreateHostedZonePage to POST /zones/', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockResolvedValueOnce({
      data: { id: 301, name: 'newapp.io' },
    });

    render(<CreateHostedZonePage />);

    // Submitting with blank domain shows inline validation error and skips API
    await user.click(screen.getByRole('button', { name: 'Create hosted zone' }));
    expect(await screen.findByText('Domain name is required.')).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();

    // Fill valid domain & description and switch to Private hosted zone
    await user.type(screen.getByPlaceholderText('example.com'), 'newapp.io.');
    await user.type(screen.getByPlaceholderText('Enter a description'), 'Created via Vitest');
    await user.click(screen.getByText('Private hosted zone'));

    await user.click(screen.getByRole('button', { name: 'Create hosted zone' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/zones/', {
        name: 'newapp.io',
        comment: 'Created via Vitest',
        type: 'Private',
        zone_type: 'Private',
        vpc_id: 'vpc-0a1b2c3d4e5f67890',
        vpc_region: 'us-east-1',
      });
      expect(pushMock).toHaveBeenCalledWith('/hosted-zones/newapp.io');
    });
  });
});
