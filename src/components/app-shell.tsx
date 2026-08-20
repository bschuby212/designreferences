"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  EMPTY_FILTERS,
  type ActiveFilters,
  type NavView,
  type Reference,
} from "@/lib/storage/types";
import { cn, isHiddenNavCollection } from "@/lib/utils";
import { EditorDialog, type EditorState } from "./editor-dialog";
import { DetailView, collectionNamesOf } from "./detail-view";
import { FilterChips, FilterPanel } from "./filter-panel";
import { Gallery } from "./gallery";
import { useBreakpoint } from "./hooks";
import { LibraryNav } from "./library-nav";
import { useLibrary } from "./library-provider";
import { Modal, Sheet } from "./sheet";
import { IconButton, inputClass, useClickOutside } from "./ui";

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

  const mobileAppsId =
    collections.find((collection) => collection.name === "Mobile Apps")?.id ??
    null;
  const [view, setView] = useState<NavView | null>(null);
  const activeView = useMemo<NavView>(
    () =>
      view ??
      (mobileAppsId
        ? { type: "collection", id: mobileAppsId }
        : { type: "all" }),
    [view, mobileAppsId],
  );
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterRef = useClickOutside(filterOpen && !mobile, () =>
    setFilterOpen(false),
  );

  const visible = useMemo(() => {
    return references.filter((reference) =>
      matches(
        reference,
        activeView,
        search,
        filters,
        collectionNamesOf(collections, reference.collectionIds),
      ),
    );
  }, [references, activeView, search, filters, collections]);

  // Counts ignore the active view but respect search and filters, so each
  // navigation chip agrees with the references it will render.
  const counts = useMemo(() => {
    const collectionCounts: Record<string, number> = {};
    for (const reference of references) {
      const names = collectionNamesOf(collections, reference.collectionIds);
      if (!matches(reference, { type: "all" }, search, filters, names)) continue;
      for (const id of reference.collectionIds) {
        const name = collections.find((collection) => collection.id === id)?.name;
        if (!name || isHiddenNavCollection(name)) continue;
        collectionCounts[id] = (collectionCounts[id] ?? 0) + 1;
      }
    }
    return { collections: collectionCounts };
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
    if (activeView.type === "collection") {
      const name =
        collections.find((collection) => collection.id === activeView.id)?.name ??
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
  }, [search, filterActive, activeView, collections]);

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
                  onClick={() => setEditor({ mode: "link" })}
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
            <IconButton
              label="Add reference"
              className="h-10 w-10"
              onClick={() => setEditor({ mode: "link" })}
            >
              <Plus size={18} strokeWidth={1.75} />
            </IconButton>
          </header>
        )}

        <LibraryNav view={activeView} onViewChange={setView} counts={counts} />

        <FilterChips
          filters={filters}
          onChange={setFilters}
          collectionNames={collectionNames}
        />

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 pt-3">
            <Gallery
              references={visible}
              selectedId={selectedId}
              laptop={
                activeView.type === "collection" &&
                ["Web", "Dashboards", "Landing Pages"].includes(
                  collections.find((collection) => collection.id === activeView.id)
                    ?.name ?? "",
                )
              }
              emptyTitle={empty.title}
              emptyHint={empty.hint}
              onOpen={openDetail}
              onFavorite={(id) => void toggleFavorite(id)}
              onEdit={(id) => setEditor({ mode: "edit", id })}
              onDelete={(id) => void deleteReference(id)}
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
        defaultCollectionIds={
          activeView.type === "collection" ? [activeView.id] : []
        }
        onClose={() => setEditor(null)}
        onSaved={() => undefined}
      />
    </div>
  );
}
