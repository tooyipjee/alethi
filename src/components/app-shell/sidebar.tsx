'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    daemonName?: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const panName = user.daemonName || 'Pan';

  return (
    <div className="w-64 bg-neutral-950 border-r border-neutral-900 flex flex-col">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-neutral-900">
        <span className="text-[15px] font-semibold">Pan</span>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-4">
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
      <div className="p-3 border-t border-neutral-900">
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
    </div>
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
