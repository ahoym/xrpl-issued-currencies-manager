/** Standard text input styling (py-1.5 variant used in compact forms). */
export const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";

/** Form field label (text-xs variant used in compact forms). */
export const labelClass =
  "block text-xs font-medium text-zinc-700 dark:text-zinc-300";

/** Blue primary action button. */
export const primaryButtonClass =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

/** Outlined secondary button (border, neutral colors). */
export const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** Green success action button (for buy/confirm actions). */
export const successButtonClass =
  "rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600";

/** Red danger action button (for sell/destructive actions). */
export const dangerButtonClass =
  "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600";

/** Red error text for form errors. */
export const errorTextClass = "text-sm text-red-600 dark:text-red-400";

/** Green success banner (mt-3 variant). */
export const successBannerClass =
  "mt-3 rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400";

/** Duration (ms) to show success messages before auto-clearing. */
export const SUCCESS_MESSAGE_DURATION_MS = 2000;
