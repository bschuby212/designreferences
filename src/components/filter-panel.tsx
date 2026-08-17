"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";
import { SOURCE_TYPES, type ActiveFilters } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { useLibrary } from "./library-provider";
import { Sheet } from "./sheet";
import { GhostButton, PrimaryButton } from "./ui";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  tags: string[];
  mobile: boolean;
}

export function FilterPanel({
  open,
  onClose,
  filters,
  onChange,
  tags,
  mobile,
}: FilterPanelProps) {
  const { collections } = useLibrary();

  const body = (
    <div className="space-y-4 p-4">
      <Toggle
        label="Favorites"
        on={filters.favorites}
        onClick={() => onChange({ ...filters, favorites: !filters.favorites })}
      />
      <Group label="Source">
        {SOURCE_TYPES.map((source) => (
          <Chip
            key={source}
            active={filters.sources.includes(source)}
            onClick={() =>
              onChange({
                ...filters,
                sources: toggle(filters.sources, source),
              })
            }
          >
            {source}
          </Chip>
        ))}
      </Group>
      <Group label="Collection">
        {collections.map((collection) => (
          <Chip
            key={collection.id}
            active={filters.collectionIds.includes(collection.id)}
            onClick={() =>
              onChange({
                ...filters,
                collectionIds: toggle(filters.collectionIds, collection.id),
              })
            }
          >
            {collection.name}
          </Chip>
        ))}
      </Group>
      {tags.length > 0 && (
        <Group label="Tags">
          {tags.map((tag) => (
            <Chip
              key={tag}
              active={filters.tags.includes(tag)}
              onClick={() =>
                onChange({
                  ...filters,
                  tags: toggle(filters.tags, tag),
                })
              }
            >
              {tag}
            </Chip>
          ))}
        </Group>
      )}
      <div className="flex gap-2 pt-1">
        <GhostButton
          className="flex-1"
          onClick={() =>
            onChange({
              sources: [],
              collectionIds: [],
              tags: [],
              favorites: false,
            })
          }
        >
          Clear
        </GhostButton>
        {mobile && (
          <PrimaryButton className="flex-1" onClick={onClose}>
            Done
          </PrimaryButton>
        )}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <Sheet open={open} onClose={onClose} side="bottom" title="Filter">
        {body}
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-[min(360px,calc(100vw-24px))] rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      {body}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-md border px-2.5 text-[12px]",
        active
          ? "border-[var(--text)] bg-[var(--text)] text-white"
          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center justify-between text-[13px]"
    >
      {label}
      <span
        className={cn(
          "flex h-5 w-9 items-center rounded-full px-0.5 transition-colors",
          on ? "bg-[var(--text)]" : "bg-[var(--border-strong)]",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-transform",
            on && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterChips({
  filters,
  onChange,
  collectionNames,
}: {
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  collectionNames: Record<string, string>;
}) {
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.favorites) {
    chips.push({
      key: "fav",
      label: "Favorites",
      clear: () => onChange({ ...filters, favorites: false }),
    });
  }
  for (const source of filters.sources) {
    chips.push({
      key: `s-${source}`,
      label: source,
      clear: () =>
        onChange({ ...filters, sources: filters.sources.filter((s) => s !== source) }),
    });
  }
  for (const id of filters.collectionIds) {
    chips.push({
      key: `c-${id}`,
      label: collectionNames[id] ?? "Collection",
      clear: () =>
        onChange({
          ...filters,
          collectionIds: filters.collectionIds.filter((item) => item !== id),
        }),
    });
  }
  for (const tag of filters.tags) {
    chips.push({
      key: `t-${tag}`,
      label: tag,
      clear: () =>
        onChange({ ...filters, tags: filters.tags.filter((item) => item !== tag) }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2 md:px-4">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--muted)]"
        >
          {chip.label}
          <X size={12} />
        </button>
      ))}
    </div>
  );
}
