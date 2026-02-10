"use client";

interface TrustLineBadge {
  currency: string;
  issuerAddress: string;
  isLocal: boolean;
}

interface TrustLineListProps {
  badges: TrustLineBadge[];
}

export function TrustLineList({ badges }: TrustLineListProps) {
  if (badges.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={`${badge.currency}:${badge.issuerAddress}`}
          title={badge.issuerAddress}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            badge.isLocal
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          }`}
        >
          {badge.currency}{!badge.isLocal && " (ext)"}
        </span>
      ))}
    </div>
  );
}
