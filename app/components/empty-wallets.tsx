import Link from "next/link";

interface EmptyWalletsProps {
  title: string;
  maxWidth?: string;
}

export function EmptyWallets({ title, maxWidth = "max-w-6xl" }: EmptyWalletsProps) {
  return (
    <div className={`mx-auto ${maxWidth} px-4 py-8`}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No recipient wallets found. Set up wallets on the{" "}
          <Link
            href="/"
            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Setup page
          </Link>{" "}
          first.
        </p>
      </div>
    </div>
  );
}
