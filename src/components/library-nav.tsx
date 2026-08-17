"use client";

import { useState, type ReactNode } from "react";
import {
  Clock,
  Folder,
  Heart,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { NavView } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { useLibrary } from "./library-provider";
import { IconButton, inputClass, useClickOutside } from "./ui";

interface LibraryNavProps {
  view: NavView;
  onViewChange: (view: NavView) => void;
  onNavigate?: () => void;
  showTitle?: boolean;
}

function SectionLabel({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-5 mb-1 flex h-7 items-center justify-between px-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-2)]">
        {children}
      </span>
      {action}
    </div>
  );
}

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
        "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] lg:min-h-8",
        active
          ? "bg-[var(--hover)] text-[var(--text)]"
          : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
      )}
    >
      <span className="shrink-0 text-[var(--muted-2)]">{icon}</span>
      <span className="truncate">{children}</span>
    </button>
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
    <nav className="flex h-full flex-col overflow-y-auto px-2 pb-6 pt-3">
      {showTitle && (
        <div className="px-2 pb-3 text-[13px] font-medium tracking-tight">
          Library
        </div>
      )}

      <NavButton
        active={view.type === "all"}
        icon={<LayoutGrid size={15} strokeWidth={1.75} />}
        onClick={() => go({ type: "all" })}
      >
        All References
      </NavButton>
      <NavButton
        active={view.type === "favorites"}
        icon={<Heart size={15} strokeWidth={1.75} />}
        onClick={() => go({ type: "favorites" })}
      >
        Favorites
      </NavButton>
      <NavButton
        active={view.type === "recent"}
        icon={<Clock size={15} strokeWidth={1.75} />}
        onClick={() => go({ type: "recent" })}
      >
        Recently Added
      </NavButton>

      <SectionLabel
        action={
          <IconButton
            label="New collection"
            className="h-8 w-8"
            onClick={() => {
              setCreating(true);
              setNewName("");
            }}
          >
            <Plus size={14} strokeWidth={1.75} />
          </IconButton>
        }
      >
        Collections
      </SectionLabel>

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
          <div key={collection.id} className="group relative flex items-center">
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
                setMenuId((id) => (id === collection.id ? null : collection.id))
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
    </nav>
  );
}

export function viewLabel(view: NavView, collections: { id: string; name: string }[]) {
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
