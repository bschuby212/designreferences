"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Columns2,
  Columns3,
  Columns4,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  EMPTY_FILTERS,
  type ActiveFilters,
  type Density,
  type NavView,
  type Reference,
} from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { AddMenu, EditorDialog, type EditorState } from "./editor-dialog";
import { DetailView, collectionNamesOf } from "./detail-view";
import { FilterChips, FilterPanel } from "./filter-panel";
import { Gallery } from "./gallery";
import { useBreakpoint } from "./hooks";
import { LibraryNav } from "./library-nav";
import { useLibrary } from "./library-provider";
import { Modal, Sheet } from "./sheet";
import { IconButton, inputClass, useClickOutside } from "./ui";

const DENSITY_KEY = "library-density";

function readDensity(): Density {
  const saved = window.localStorage.getItem(DENSITY_KEY);
  if (saved === "compact" || saved === "medium" || saved === "large") return saved;
  return "medium";
}

function subscribeDensity(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("library-density", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("library-density", onChange);
  };
}

function matches(
  reference: Reference,
  view: NavView,
  search: string,
  filters: ActiveFilters,
  collectionNames: string[],
) {
  if (view.type === "collection" && !reference.collectionIds.includes(view.id)) {
    return false;
  }
  if (view.type === "source" && reference.source !== view.source) return false;
  if (filters.sources.length && !filters.sources.includes(reference.source)) {
    return false;
  }
  if (
    filters.collectionIds.length &&
    !filters.collectionIds.some((id) => reference.collectionIds.includes(id))
  ) {
    return false;
  }
  if (
    filters.tags.length &&
    !filters.tags.some((tag) => reference.tags.includes(tag))
  ) {
    return false;
  }
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    reference.title,
    reference.notes,
    reference.tags.join(" "),
    collectionNames.join(" "),
    reference.source,
    reference.url,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function AppShell() {
  const { references, collections, updateReference, deleteReference } =
    useLibrary();
  const breakpoint = useBreakpoint();
  const mobile = breakpoint === "mobile";

  const [view, setView] = useState<NavView>({ type: "all" });
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const density = useSyncExternalStore<Density>(
    subscribeDensity,
    readDensity,
    () => "medium",
  );

  const setDensity = (value: Density) => {
    window.localStorage.setItem(DENSITY_KEY, value);
    window.dispatchEvent(new Event("library-density"));
  };

  const addRef = useClickOutside(addOpen && !mobile, () => setAddOpen(false));
  const filterRef = useClickOutside(filterOpen && !mobile, () =>
    setFilterOpen(false),
  );

  const visible = useMemo(() => {
    return references.filter((reference) =>
      matches(
        reference,
        view,
        search,
        filters,
        collectionNamesOf(collections, reference.collectionIds),
      ),
    );
  }, [references, view, search, filters, collections]);

  // Counts ignore the active view but respect search and filters, so each
  // navigation chip agrees with the references it will render.
  const counts = useMemo(() => {
    const collectionCounts: Record<string, number> = {};
    let all = 0;
    for (const reference of references) {
      const names = collectionNamesOf(collections, reference.collectionIds);
      if (!matches(reference, { type: "all" }, search, filters, names)) continue;
      all += 1;
      for (const id of reference.collectionIds) {
        if (collections.find((collection) => collection.id === id)?.name === "Typography") {
          continue;
        }
        collectionCounts[id] = (collectionCounts[id] ?? 0) + 1;
      }
    }
    return { all, collections: collectionCounts };
  }, [references, collections, search, filters]);

  const selected = references.find((r) => r.id === selectedId) ?? null;
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const reference of references) {
      for (const tag of reference.tags) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [references]);

  const collectionNames = useMemo(
    () => Object.fromEntries(collections.map((c) => [c.id, c.name])),
    [collections],
  );

  const openDetail = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (mobile) {
        window.history.pushState({ detail: id }, "");
      }
    },
    [mobile],
  );

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    if (mobile && window.history.state?.detail) {
      window.history.back();
    }
  }, [mobile]);

  useEffect(() => {
    const onPop = () => setSelectedId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function toggleFavorite(id: string) {
    const reference = references.find((item) => item.id === id);
    if (!reference) return;
    await updateReference(id, { favorite: !reference.favorite });
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        setEditor({
          mode: "upload",
          file: new File([blob], "pasted.png", { type: blob.type }),
        });
        return;
      }
    } catch {
      setEditor({ mode: "upload" });
    }
  }

  const filterActive =
    filters.sources.length + filters.collectionIds.length + filters.tags.length > 0;

  // The empty state has to say which of search, filters or an empty tab is
  // responsible, otherwise a correctly empty collection looks like a bug.
  const empty = useMemo(() => {
    const trimmed = search.trim();
    if (trimmed) {
      return {
        title: `No matches for “${trimmed}”`,
        hint: filterActive
          ? "Try different words, or clear the active filters."
          : "Try a different app name, collection or tag.",
      };
    }
    if (filterActive) {
      return {
        title: "No references match these filters",
        hint: "Clear a filter to widen the results.",
      };
    }
    if (view.type === "collection") {
      const name =
        collections.find((collection) => collection.id === view.id)?.name ??
        "this collection";
      return {
        title: `Nothing in ${name} yet`,
        hint: "Add a reference to this collection, or move an existing one into it.",
      };
    }
    return {
      title: "Your library is empty",
      hint: "Paste a link or upload a screenshot to start collecting references.",
    };
  }, [search, filterActive, view, collections]);

  return (
    <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--bg)]">
        {mobile ? (
          <header className="flex h-[var(--header-h)] items-center gap-0.5 border-b border-[var(--border)] bg-[var(--bg)] px-1 pt-[env(safe-area-inset-top)]">
            {searchOpen ? (
              <>
                <IconButton label="Back" onClick={() => setSearchOpen(false)}>
                  <ArrowLeft size={16} strokeWidth={1.75} />
                </IconButton>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search references…"
                  className={cn(inputClass, "h-10 border-transparent bg-transparent")}
                />
                {search && (
                  <IconButton label="Clear" onClick={() => setSearch("")}>
                    <X size={16} />
                  </IconButton>
                )}
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1 px-3 text-[14px] font-medium tracking-tight">
                  Library
                </div>
                <IconButton label="Search" onClick={() => setSearchOpen(true)}>
                  <Search size={16} strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label="Filter"
                  className={filterActive ? "text-[var(--text)]" : undefined}
                  onClick={() => setFilterOpen(true)}
                >
                  <Filter size={16} strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label="Add reference"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus size={18} strokeWidth={1.75} />
                </IconButton>
              </>
            )}
          </header>
        ) : (
          <header className="flex h-[var(--header-h)] items-center gap-2 border-b border-[var(--border)] px-3">
            <div className="relative min-w-0 flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted-2)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search references…"
                className={cn(inputClass, "h-10 pl-8")}
              />
            </div>
            <div className="relative" ref={filterRef}>
              <IconButton
                label="Filter"
                className={cn("h-10 w-10", filterActive && "text-[var(--text)]")}
                onClick={() => setFilterOpen((v) => !v)}
              >
                <Filter size={16} strokeWidth={1.75} />
              </IconButton>
              <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                filters={filters}
                onChange={setFilters}
                tags={tags}
                mobile={false}
              />
            </div>
            <DensityToggle density={density} onChange={setDensity} />
            <div className="relative" ref={addRef}>
              <IconButton
                label="Add reference"
                className="h-10 w-10"
                onClick={() => setAddOpen((v) => !v)}
              >
                <Plus size={18} strokeWidth={1.75} />
              </IconButton>
              <AddMenu
                open={addOpen}
                onClose={() => setAddOpen(false)}
                mobile={false}
                onLink={() => {
                  setAddOpen(false);
                  setEditor({ mode: "link" });
                }}
                onUpload={() => {
                  setAddOpen(false);
                  setEditor({ mode: "upload" });
                }}
                onPaste={() => {
                  setAddOpen(false);
                  void pasteImage();
                }}
              />
            </div>
          </header>
        )}

        <LibraryNav view={view} onViewChange={setView} counts={counts} />

        <FilterChips
          filters={filters}
          onChange={setFilters}
          collectionNames={collectionNames}
        />

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 pt-3">
            <Gallery
              references={visible}
              density={density}
              selectedId={selectedId}
              collectionNames={collectionNames}
              emptyTitle={empty.title}
              emptyHint={empty.hint}
              onOpen={openDetail}
              onFavorite={(id) => void toggleFavorite(id)}
              onEdit={(id) => setEditor({ mode: "edit", id })}
              onDelete={(id) => void deleteReference(id)}
              onSelectCollection={(id) => setView({ type: "collection", id })}
              onFiles={(files) =>
                setEditor({ mode: "upload", file: files[0] })
              }
            />
          </div>

        </div>

      {mobile && (
        <FilterPanel
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filters={filters}
          onChange={setFilters}
          tags={tags}
          mobile
        />
      )}

      {mobile && (
        <AddMenu
          open={addOpen}
          onClose={() => setAddOpen(false)}
          mobile
          onLink={() => {
            setAddOpen(false);
            setEditor({ mode: "link" });
          }}
          onUpload={() => {
            setAddOpen(false);
            setEditor({ mode: "upload" });
          }}
          onPaste={() => {
            setAddOpen(false);
            void pasteImage();
          }}
        />
      )}

      {!mobile && selected && (
        <Modal
          open
          onClose={closeDetail}
          title={selected.title || "Reference"}
          size="large"
        >
          <DetailView
            reference={selected}
            collectionNames={collectionNamesOf(collections, selected.collectionIds)}
            variant="modal"
            onClose={closeDetail}
            onFavorite={() => void toggleFavorite(selected.id)}
            onEdit={() => setEditor({ mode: "edit", id: selected.id })}
            onDelete={() => {
              void deleteReference(selected.id);
              setSelectedId(null);
            }}
            onNotes={(notes) => void updateReference(selected.id, { notes })}
          />
        </Modal>
      )}

      {mobile && selected && (
        <Sheet
          open
          onClose={closeDetail}
          side="bottom"
          swipeToDismiss
          className="h-[94dvh]"
        >
          <DetailView
            reference={selected}
            collectionNames={collectionNamesOf(collections, selected.collectionIds)}
            variant="sheet"
            onClose={closeDetail}
            onFavorite={() => void toggleFavorite(selected.id)}
            onEdit={() => setEditor({ mode: "edit", id: selected.id })}
            onDelete={() => {
              void deleteReference(selected.id);
              closeDetail();
            }}
            onNotes={(notes) => void updateReference(selected.id, { notes })}
          />
        </Sheet>
      )}

      <EditorDialog
        state={editor}
        onClose={() => setEditor(null)}
        onSaved={() => undefined}
      />
    </div>
  );
}

function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (density: Density) => void;
}) {
  const options: Array<[Density, typeof Columns4]> = [
    ["compact", Columns4],
    ["medium", Columns3],
    ["large", Columns2],
  ];
  return (
    <div className="hidden h-10 items-center rounded-md border border-[var(--border)] p-0.5 lg:flex">
      {options.map(([value, Icon]) => (
        <button
          key={value}
          type="button"
          aria-label={value}
          title={value}
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded text-[var(--muted)]",
            density === value && "bg-[var(--hover)] text-[var(--text)]",
          )}
        >
          <Icon size={14} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
