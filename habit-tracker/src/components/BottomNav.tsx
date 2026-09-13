'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Сегодня', icon: '🏁' },
  { href: '/stats', label: 'Статы', icon: '📊' },
  { href: '/budgets', label: 'Бюджеты', icon: '⛽' },
  { href: '/trophies', label: 'Трофеи', icon: '🏆' },
  { href: '/shop', label: 'Магазин', icon: '🎁' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-racing' : 'text-ink-muted hover:text-white'
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
