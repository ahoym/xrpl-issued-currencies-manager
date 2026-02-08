'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppState } from '@/lib/hooks/use-app-state';
import { NetworkSelector } from './network-selector';

const links = [
  { href: '/', label: 'Setup' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/transact', label: 'Transact' },
  { href: '/trade', label: 'Trade' },
];

export function NavBar() {
  const pathname = usePathname();
  const { state, setNetwork } = useAppState();

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          XRPL Manager
        </span>
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`text-sm font-medium ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <div className="ml-auto">
          <NetworkSelector network={state.network} onChange={setNetwork} />
        </div>
      </div>
    </nav>
  );
}
