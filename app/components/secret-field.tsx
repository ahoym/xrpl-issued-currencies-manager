"use client";

import { useState } from "react";

interface SecretFieldProps {
  label: string;
  value: string;
}

export function SecretField({ label, value }: SecretFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500 dark:text-zinc-400">{label}: </span>
      {show ? (
        <span className="break-all">{value}</span>
      ) : (
        <span>••••••••••••</span>
      )}
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? "Hide secret" : "Show secret"}
        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
