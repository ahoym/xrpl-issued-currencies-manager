"use client";

interface Tab<T extends string> {
  value: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (value: T) => void;
  /** Extra classes on the container div. */
  className?: string;
}

const activeClass =
  "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
const inactiveClass =
  "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";

/**
 * Horizontal tab bar with blue bottom-border active indicator.
 * Matches the pattern used on compliance and trade pages.
 */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className = "flex border-b border-zinc-200 dark:border-zinc-800",
}: TabBarProps<T>) {
  return (
    <div className={className}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            active === tab.value ? activeClass : inactiveClass
          }`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
