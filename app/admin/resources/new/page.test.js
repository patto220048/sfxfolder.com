import React from 'react';
import { render, screen } from '@testing-library/react';
import LegacyNewResource from './page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader">Loading</div>,
}));

describe('LegacyNewResource Component', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('renders redirect text', () => {
    render(<LegacyNewResource />);
    expect(screen.getByText(/Đang chuyển hướng/i)).toBeInTheDocument();
  });

  it('calls router.replace with /admin/resources on mount', () => {
    render(<LegacyNewResource />);
    expect(mockReplace).toHaveBeenCalledWith('/admin/resources');
  });
});
