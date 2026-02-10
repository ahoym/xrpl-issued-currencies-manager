"use client";

import { useState } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { EXPLORER_URLS } from "@/lib/xrpl/networks";

interface ExplorerLinkProps {
  address: string;
}

export function ExplorerLink({ address }: ExplorerLinkProps) {
  const { state } = useAppState();
  const [copied, setCopied] = useState(false);
  const href = `${EXPLORER_URLS[state.network]}/accounts/${address}`;

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-blue-600 hover:underline dark:text-blue-400"
      >
        {address}
      </a>
      <span
        role="button"
        tabIndex={0}
        onClick={handleCopy}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCopy(e as unknown as React.MouseEvent); }}
        className="inline-flex shrink-0 cursor-pointer items-center text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        title="Copy address"
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-green-500">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
            <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
          </svg>
        )}
      </span>
    </span>
  );
}
