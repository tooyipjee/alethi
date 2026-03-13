'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    daemonName?: string;
    googleConnected?: boolean;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const panName = user.daemonName || 'Pan';
  const [sources, setSources] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch('/api/integrations/google')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.sources) setSources(data.sources);
      })
      .catch(() => {});
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-neutral-900 shrink-0">
        <span className="text-[15px] font-semibold">Pan</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-2 text-neutral-500 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-4 min-h-0">
        <div className="px-3 mb-4">
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider px-2 mb-2">
            Your Pan
          </p>
          <NavItem href="/hub" active={pathname === '/hub'} icon="◉">
            {panName}
          </NavItem>
        </div>

        <div className="px-3 mb-4">
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider px-2 mb-2">
            Pan Channels
          </p>
          <NavItem href="/spectator" active={pathname === '/spectator'} icon="◎">
            Negotiations
          </NavItem>
        </div>

        {/* Context Sources */}
        <div className="px-3 mb-4">
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider px-2 mb-2">
            Context
          </p>
          {sources.length > 0 ? (
            sources.map(s => (
              <div key={s} className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-neutral-500">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {s}
              </div>
            ))
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              <span className="text-[12px]">+</span>
              Connect sources
            </Link>
          )}
        </div>

        <div className="px-3">
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider px-2 mb-2">
            Settings
          </p>
          <NavItem href="/settings" active={pathname === '/settings'} icon="⚙">
            Preferences
          </NavItem>
        </div>
      </div>

      {/* User */}
      <div className="p-3 border-t border-neutral-900 shrink-0">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-[12px] font-medium">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-[13px] font-medium">{user.name}</p>
              <p className="text-[11px] text-neutral-500">{panName} is active</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-[11px] text-neutral-500 hover:text-white transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button - fixed position */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center"
      >
        <span className="text-[16px]">☰</span>
      </button>

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 bg-neutral-950 border-r border-neutral-900 flex-col shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/80"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-neutral-950 flex flex-col">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

function NavItem({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[14px] transition-colors ${
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
      }`}
    >
      <span className="text-[12px] opacity-60">{icon}</span>
      {children}
    </Link>
  );
}
