"use client";

import { Folder } from "lucide-react";
import {
  SOURCE_TYPES,
  type NavView,
  type SourceType,
} from "@/lib/storage/types";
import { cn, isHiddenNavCollection } from "@/lib/utils";
import { useLibrary } from "./library-provider";

export interface NavCounts {
  collections: Record<string, number>;
}

interface LibraryNavProps {
  view: NavView;
  onViewChange: (view: NavView) => void;
  counts?: NavCounts;
  source?: SourceType | "";
  onSourceChange?: (source: SourceType | "") => void;
}

function Chip({
  active,
  icon,
  count,
  children,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-nav-label={typeof children === "string" ? children : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-all",
        active
          ? "bg-[var(--surface)] font-medium text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]"
          : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
      )}
    >
      {icon}
      <span>{children}</span>
      {count !== undefined && (
        <span
          className={cn(
            "ml-0.5 text-[10px] tabular-nums",
            active ? "text-[var(--muted)]" : "text-[var(--muted-2)]",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function LibraryNav({
  view,
  onViewChange,
  counts,
  source = "",
  onSourceChange,
}: LibraryNavProps) {
  const { collections } = useLibrary();

  return (
    <nav
      aria-label="Library categories"
      className="flex items-center gap-2 border-b border-[var(--border)] px-2 py-2 md:px-4"
    >
      <div className="no-scrollbar min-w-0 overflow-x-auto">
        <div className="inline-flex w-max items-center gap-1 rounded-full bg-[var(--chip-track)] p-1">
          {collections
            .filter((collection) => !isHiddenNavCollection(collection.name))
            .map((collection) => (
              <Chip
                key={collection.id}
                active={view.type === "collection" && view.id === collection.id}
                icon={<Folder size={13} strokeWidth={1.75} />}
                count={counts?.collections[collection.id] ?? 0}
                onClick={() =>
                  onViewChange({ type: "collection", id: collection.id })
                }
              >
                {collection.name}
              </Chip>
            ))}
        </div>
      </div>
      {onSourceChange && (
        <select
          aria-label="Source"
          value={source}
          onChange={(event) =>
            onSourceChange((event.target.value || "") as SourceType | "")
          }
          className="h-10 w-auto shrink-0 rounded-full bg-[var(--chip-track)] px-3 text-[13px] text-[var(--text)] outline-none"
        >
          <option value="">All sources</option>
          {SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      )}
    </nav>
  );
}

export function viewLabel(
  view: NavView,
  collections: { id: string; name: string }[],
) {
  if (view.type === "all") return "All references";
  if (view.type === "source") return view.source;
  return collections.find((collection) => collection.id === view.id)?.name ?? "Collection";
}
