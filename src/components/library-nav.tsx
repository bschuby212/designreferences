"use client";

import { useState } from "react";
import { Folder, Plus } from "lucide-react";
import type { NavView } from "@/lib/storage/types";
import { cn, isHiddenNavCollection } from "@/lib/utils";
import { useLibrary } from "./library-provider";
import { inputClass } from "./ui";

export interface NavCounts {
  collections: Record<string, number>;
}

interface LibraryNavProps {
  view: NavView;
  onViewChange: (view: NavView) => void;
  counts?: NavCounts;
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
}: LibraryNavProps) {
  const { collections, createCollection } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function submitNew() {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    const created = await createCollection(name);
    setNewName("");
    setCreating(false);
    onViewChange({ type: "collection", id: created.id });
  }

  return (
    <nav
      aria-label="Library categories"
      className="border-b border-[var(--border)] px-2 py-2 md:px-4"
    >
      <div className="no-scrollbar flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-full bg-[var(--chip-track)] p-1">
        {collections.filter((collection) => !isHiddenNavCollection(collection.name)).map((collection) => (
          <Chip
            key={collection.id}
            active={view.type === "collection" && view.id === collection.id}
            icon={<Folder size={13} strokeWidth={1.75} />}
            count={counts?.collections[collection.id] ?? 0}
            onClick={() => onViewChange({ type: "collection", id: collection.id })}
          >
            {collection.name}
          </Chip>
        ))}

        {creating ? (
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onBlur={() => void submitNew()}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitNew();
              if (event.key === "Escape") setCreating(false);
            }}
            placeholder="Collection name"
            className={cn(inputClass, "h-8 w-36 shrink-0 rounded-full bg-[var(--surface)]")}
          />
        ) : (
          <button
            type="button"
            aria-label="New collection"
            title="New collection"
            onClick={() => setCreating(true)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <Plus size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>
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
