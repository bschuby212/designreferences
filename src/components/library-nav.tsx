"use client";

import { useState, type ReactNode } from "react";
import {
  Folder,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { SOURCE_TYPES, type NavView } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { useLibrary } from "./library-provider";
import { IconButton, inputClass, useClickOutside } from "./ui";

interface LibraryNavProps {
  view: NavView;
  onViewChange: (view: NavView) => void;
  onNavigate?: () => void;
  showTitle?: boolean;
}

type NavTab = "collections" | "sources";

function NavButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius)] px-2.5 text-left text-[13px] lg:min-h-9",
        active
          ? "bg-[var(--hover)] font-medium text-[var(--text)]"
          : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
      )}
    >
      <span className="shrink-0 text-[var(--muted-2)]">{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

function Segmented({
  tab,
  onChange,
}: {
  tab: NavTab;
  onChange: (tab: NavTab) => void;
}) {
  const options: Array<[NavTab, string]> = [
    ["collections", "Collections"],
    ["sources", "Sources"],
  ];
  return (
    <div className="flex rounded-[var(--radius)] bg-[var(--hover)] p-0.5">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "flex-1 rounded-[calc(var(--radius)-3px)] py-1.5 text-[12px] font-medium transition-colors",
            tab === value
              ? "bg-[var(--surface)] text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]"
              : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function LibraryNav({
  view,
  onViewChange,
  onNavigate,
  showTitle = true,
}: LibraryNavProps) {
  const { collections, createCollection, renameCollection, deleteCollection } =
    useLibrary();
  const [tab, setTab] = useState<NavTab>(
    view.type === "source" ? "sources" : "collections",
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const menuRef = useClickOutside(Boolean(menuId), () => setMenuId(null));

  const go = (next: NavView) => {
    onViewChange(next);
    onNavigate?.();
  };

  async function submitNew() {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    const created = await createCollection(name);
    setNewName("");
    setCreating(false);
    go({ type: "collection", id: created.id });
  }

  async function submitRename() {
    if (!editingId) return;
    const name = editName.trim();
    if (name) await renameCollection(editingId, name);
    setEditingId(null);
  }

  return (
    <nav className="flex h-full flex-col overflow-y-auto px-3 pb-6 pt-3">
      {showTitle && (
        <button
          type="button"
          onClick={() => go({ type: "all" })}
          className="mb-3 flex items-center gap-2 px-1 text-left"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--text)] text-[11px] font-semibold text-white">
            L
          </span>
          <span className="text-[14px] font-semibold tracking-tight">
            Library
          </span>
        </button>
      )}

      <Segmented
        tab={tab}
        onChange={(next) => {
          setTab(next);
          if (next === "collections") go({ type: "all" });
        }}
      />

      {tab === "collections" ? (
        <div className="mt-3 flex flex-col gap-0.5">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-2)]">
              Collections
            </span>
            <IconButton
              label="New collection"
              className="h-7 w-7"
              onClick={() => {
                setCreating(true);
                setNewName("");
              }}
            >
              <Plus size={14} strokeWidth={1.75} />
            </IconButton>
          </div>

          {creating && (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => void submitNew()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitNew();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Name"
              className={cn(inputClass, "mb-1 h-9")}
            />
          )}

          {collections.map((collection) => {
            const active =
              view.type === "collection" && view.id === collection.id;
            if (editingId === collection.id) {
              return (
                <input
                  key={collection.id}
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => void submitRename()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className={cn(inputClass, "mb-1 h-9")}
                />
              );
            }
            return (
              <div
                key={collection.id}
                className="group relative flex items-center"
              >
                <NavButton
                  active={active}
                  icon={<Folder size={15} strokeWidth={1.75} />}
                  onClick={() => go({ type: "collection", id: collection.id })}
                >
                  {collection.name}
                </NavButton>
                <IconButton
                  label="Collection options"
                  className={cn(
                    "absolute right-0 h-8 w-8 shrink-0 text-[var(--muted-2)]",
                    menuId === collection.id
                      ? "opacity-100"
                      : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                  )}
                  onClick={() =>
                    setMenuId((id) =>
                      id === collection.id ? null : collection.id,
                    )
                  }
                >
                  <MoreHorizontal size={14} />
                </IconButton>
                {menuId === collection.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-1 top-9 z-20 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-sm"
                  >
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-2 px-3 text-left text-[13px] hover:bg-[var(--hover)]"
                      onClick={() => {
                        setEditingId(collection.id);
                        setEditName(collection.name);
                        setMenuId(null);
                      }}
                    >
                      <Pencil size={13} /> Rename
                    </button>
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-2 px-3 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                      onClick={() => {
                        void deleteCollection(collection.id);
                        if (active) go({ type: "all" });
                        setMenuId(null);
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-0.5">
          <div className="mb-1 px-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-2)]">
              Sources
            </span>
          </div>
          {SOURCE_TYPES.map((source) => (
            <NavButton
              key={source}
              active={view.type === "source" && view.source === source}
              icon={<Tag size={15} strokeWidth={1.75} />}
              onClick={() => go({ type: "source", source })}
            >
              {source}
            </NavButton>
          ))}
        </div>
      )}
    </nav>
  );
}

export function viewLabel(
  view: NavView,
  collections: { id: string; name: string }[],
) {
  if (view.type === "all") return "All References";
  if (view.type === "favorites") return "Favorites";
  if (view.type === "recent") return "Recently Added";
  if (view.type === "source") {
    if (view.source === "Website") return "Websites";
    if (view.source === "Upload") return "Uploads";
    return view.source;
  }
  return collections.find((c) => c.id === view.id)?.name ?? "Collection";
}
