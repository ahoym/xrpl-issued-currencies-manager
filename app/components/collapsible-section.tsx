"use client";

import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  /** Content shown in the always-visible header bar. */
  title: ReactNode;
  /** Whether the section starts collapsed. */
  defaultCollapsed?: boolean;
  /** Content rendered when expanded. */
  children: ReactNode;
  /** Extra classes on the toggle button. */
  buttonClassName?: string;
}

/**
 * A section with a clickable header that toggles visibility of its children.
 * Uses the same chevron pattern (▸/▾) found across setup, transact, and compliance pages.
 */
export function CollapsibleSection({
  title,
  defaultCollapsed = false,
  children,
  buttonClassName = "flex w-full items-center justify-between p-4 text-left",
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className={buttonClassName}
      >
        {title}
        <span className="ml-4 text-zinc-400 dark:text-zinc-500">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && children}
    </>
  );
}
