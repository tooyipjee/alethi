import '@testing-library/jest-dom/vitest';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@pan.local',
        daemonName: 'Pan',
      },
    },
    status: 'authenticated',
  })),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/hub'),
}));
