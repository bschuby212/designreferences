"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Columns2,
  Columns3,
  Columns4,
  Filter,
  Plus,
  Search,
} from "lucide-react";
import { AppMark } from "./app-mark";
import {
  EMPTY_FILTERS,
  type ActiveFilters,
  type Density,
  type NavView,
  type Reference,
} from "@/lib/storage/types";
import { cn, imageAssetKey, uid } from "@/lib/utils";
import { AddMenu, EditorDialog, type EditorState } from "./editor-dialog";
import { DetailView, collectionNameOf } from "./detail-view";
import { FilterChips, FilterPanel } from "./filter-panel";
import { Gallery } from "./gallery";
import { useBreakpoint } from "./hooks";
import { LibraryNav } from "./library-nav";
import { useLibrary } from "./library-provider";
import { Modal } from "./sheet";
import { IconButton, inputClass, useClickOutside } from "./ui";

const RECENT_MS = 14 * 24 * 60 * 60 * 1000;
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

function shuffle<T>(items: T[], seed: number) {
  const next = [...items];
  let state = seed || 1;
  for (let i = next.length - 1; i > 0; i--) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    const current = next[i];
    next[i] = next[j];
    next[j] = current;
  }
  return next;
}

function matches(
  reference: Reference,
  view: NavView,
  search: string,
  filters: ActiveFilters,
  collectionName: string,
) {
  if (view.type === "favorites" && !reference.favorite) return false;
  if (view.type === "recent" && Date.now() - reference.createdAt > RECENT_MS) {
    return false;
  }
  if (view.type === "collection" && reference.collectionId !== view.id) return false;
  if (view.type === "source" && reference.source !== view.source) return false;
  if (filters.favorites && !reference.favorite) return false;
  if (filters.sources.length && !filters.sources.includes(reference.source)) {
    return false;
  }
  if (
    filters.collectionIds.length &&
    (!reference.collectionId ||
      !filters.collectionIds.includes(reference.collectionId))
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
    collectionName,
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
  const [feedKey, setFeedKey] = useState(0);
  const [search, setSearch] = useState("");
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
    const matched = references.filter((reference) =>
      matches(
        reference,
        view,
        search,
        filters,
        collectionNameOf(collections, reference.collectionId) ?? "",
      ),
    );
    const seen = new Set<string>();
    const unique = matched.filter((reference) => {
      const urlKey = imageAssetKey(reference.url);
      const imageKey = imageAssetKey(reference.thumbnailUrl);
      const keys = [
        urlKey && `url:${urlKey}`,
        imageKey && `img:${imageKey}`,
        reference.title.trim() &&
          `title:${reference.title.trim().toLowerCase()}`,
      ].filter(Boolean) as string[];
      if (keys.some((key) => seen.has(key))) return false;
      for (const key of keys) seen.add(key);
      return true;
    });
    if (view.type !== "feed") return unique;
    return shuffle(unique, feedKey + 1);
  }, [references, view, search, filters, collections, feedKey]);

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

  async function addComment(id: string, text: string) {
    const reference = references.find((item) => item.id === id);
    if (!reference) return;
    await updateReference(id, {
      comments: [
        ...reference.comments,
        { id: uid(), text, createdAt: Date.now() },
      ],
    });
  }

  async function deleteComment(id: string, commentId: string) {
    const reference = references.find((item) => item.id === id);
    if (!reference) return;
    await updateReference(id, {
      comments: reference.comments.filter((item) => item.id !== commentId),
    });
  }

  const selectCollection = useCallback((id: string) => {
    setView({ type: "collection", id });
    setSelectedId(null);
  }, []);

  function changeView(next: NavView) {
    if (next.type === "feed" && view.type !== "feed") {
      setFeedKey((key) => key + 1);
    }
    setView(next);
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
    filters.favorites ||
    filters.sources.length + filters.collectionIds.length + filters.tags.length >
      0;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--bg)]">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 pt-[env(safe-area-inset-top)] md:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => changeView({ type: "all" })}
          className="shrink-0"
          aria-label="All references"
        >
          <AppMark />
        </button>

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

        <div className="relative shrink-0" ref={filterRef}>
          <IconButton
            label="Filter"
            className={cn("h-10 w-10", filterActive && "text-[var(--text)]")}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <Filter size={16} strokeWidth={1.75} />
          </IconButton>
          {!mobile && (
            <FilterPanel
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              filters={filters}
              onChange={setFilters}
              tags={tags}
              mobile={false}
            />
          )}
        </div>

        {view.type !== "feed" ? (
          <DensityToggle density={density} onChange={setDensity} />
        ) : null}

        <div className="relative shrink-0" ref={addRef}>
          <IconButton
            label="Add reference"
            className="h-10 w-10"
            onClick={() => setAddOpen((v) => !v)}
          >
            <Plus size={18} strokeWidth={1.75} />
          </IconButton>
          {!mobile && (
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
          )}
        </div>
      </header>

      <LibraryNav view={view} onViewChange={changeView} />

      <FilterChips
        filters={filters}
        onChange={setFilters}
        collectionNames={collectionNames}
      />

      <main className="min-h-0 flex-1 pt-4">
        <Gallery
          references={visible}
          density={density}
          collectionNames={collectionNames}
          onOpen={openDetail}
          onFiles={(files) => setEditor({ mode: "upload", file: files[0] })}
          onSelectCollection={selectCollection}
          mode={view.type === "feed" ? "feed" : "grid"}
        />
      </main>

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

      <Modal
        open={Boolean(selected)}
        onClose={closeDetail}
        className="h-[92dvh] max-w-3xl sm:h-auto sm:max-h-[90vh]"
      >
        {selected && (
          <DetailView
            reference={selected}
            collectionName={collectionNameOf(collections, selected.collectionId)}
            onClose={closeDetail}
            onFavorite={() => void toggleFavorite(selected.id)}
            onEdit={() => setEditor({ mode: "edit", id: selected.id })}
            onDelete={() => {
              void deleteReference(selected.id);
              closeDetail();
            }}
            onNotes={(notes) => void updateReference(selected.id, { notes })}
            onAddComment={(text) => void addComment(selected.id, text)}
            onDeleteComment={(commentId) =>
              void deleteComment(selected.id, commentId)
            }
            onSelectCollection={selectCollection}
          />
        )}
      </Modal>

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
