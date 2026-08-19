"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { SOURCE_TYPES, type NavView } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { AllIcon, CollectionIcon, SourceIcon } from "./category-icons";
import { useLibrary } from "./library-provider";
import { inputClass, useClickOutside } from "./ui";

interface LibraryNavProps {
  view: NavView;
  onViewChange: (view: NavView) => void;
}

type NavTab = "collections" | "sources" | "feed";

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-all",
        active
          ? "bg-[var(--chip-active)] font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)]"
          : "bg-transparent text-[var(--muted)] hover:text-[var(--text)]",
      )}
    >
      {children}
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
    ["feed", "Feed"],
  ];
  return (
    <div className="flex shrink-0 rounded-full bg-[var(--chip-track)] p-[3px]">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full px-3 py-[5px] text-[12px] font-medium whitespace-nowrap transition-all",
            tab === value
              ? "bg-[var(--chip-active)] text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)]"
              : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function LibraryNav({ view, onViewChange }: LibraryNavProps) {
  const { collections, createCollection, renameCollection, deleteCollection } =
    useLibrary();
  const [tab, setTab] = useState<NavTab>(
    view.type === "source" ? "sources" : view.type === "feed" ? "feed" : "collections",
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const menuRef = useClickOutside(Boolean(menuId), () => setMenuId(null));

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

  async function submitRename() {
    if (!editingId) return;
    const name = editName.trim();
    if (name) await renameCollection(editingId, name);
    setEditingId(null);
  }

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 md:px-6 lg:px-8">
      <Segmented
        tab={tab}
        onChange={(next) => {
          setTab(next);
          if (next === "collections") onViewChange({ type: "all" });
          if (next === "feed") onViewChange({ type: "feed" });
        }}
      />

      {tab !== "feed" ? (
      <>
      <div className="mx-1 h-5 w-px shrink-0 bg-[var(--border)]" />

      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-full bg-[var(--chip-track)] p-[3px]">
        <Pill active={view.type === "all"} onClick={() => onViewChange({ type: "all" })}>
          <AllIcon size={13} strokeWidth={1.75} />
          All
        </Pill>

        {tab === "collections"
          ? collections.map((collection) => {
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
                    className={cn(inputClass, "h-8 w-32 shrink-0 rounded-full")}
                  />
                );
              }
              return (
                <div key={collection.id} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onViewChange({ type: "collection", id: collection.id })
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenuId((id) =>
                        id === collection.id ? null : collection.id,
                      );
                    }}
                    title="Right-click to rename or delete"
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-all",
                      active
                        ? "bg-[var(--chip-active)] font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)]"
                        : "bg-transparent text-[var(--muted)] hover:text-[var(--text)]",
                    )}
                  >
                    <CollectionIcon
                      name={collection.name}
                      size={13}
                      strokeWidth={1.75}
                    />
                    {collection.name}
                  </button>
                  {menuId === collection.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-9 z-30 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-md"
                    >
                      <button
                        type="button"
                        className="flex h-10 w-full items-center gap-2 px-3 text-left text-[13px] text-[var(--text)] hover:bg-[var(--hover)]"
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
                          if (active) onViewChange({ type: "all" });
                          setMenuId(null);
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          : SOURCE_TYPES.map((source) => (
              <Pill
                key={source}
                active={view.type === "source" && view.source === source}
                onClick={() => onViewChange({ type: "source", source })}
              >
                <SourceIcon source={source} size={13} strokeWidth={1.75} />
                {source}
              </Pill>
            ))}

        {tab === "collections" &&
          (creating ? (
            <div className="flex shrink-0 items-center gap-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitNew();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="Name"
                className={cn(inputClass, "h-8 w-32 rounded-full")}
              />
              <button
                type="button"
                aria-label="Save collection"
                onClick={() => void submitNew()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setCreating(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="New collection"
              title="New collection"
              onClick={() => {
                setCreating(true);
                setNewName("");
              }}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-all hover:bg-[var(--chip-active)] hover:text-[var(--text)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
            >
              <Plus size={15} />
            </button>
          ))}
      </div>
      </>
      ) : null}
    </div>
  );
}
