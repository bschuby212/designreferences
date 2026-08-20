"use client";

import { useState, type ComponentType } from "react";
import {
  Award,
  Check,
  ChevronDown,
  Clapperboard,
  Compass,
  Folder,
  Globe,
  Image,
  Layers,
  LayoutDashboard,
  Monitor,
  Palette,
  PanelTop,
  PenTool,
  Smartphone,
  Sparkles,
  Target,
  Upload,
  type LucideProps,
} from "lucide-react";
import {
  SOURCE_TYPES,
  type NavView,
  type SourceType,
} from "@/lib/storage/types";
import { cn, isHiddenNavCollection } from "@/lib/utils";
import { useLibrary } from "./library-provider";
import { useClickOutside } from "./ui";

export interface NavCounts {
  collections: Record<string, number>;
}

type Icon = ComponentType<LucideProps>;

const CATEGORY_ICONS: Record<string, Icon> = {
  "Mobile Apps": Smartphone,
  Web: Monitor,
  Dashboards: LayoutDashboard,
  "Landing Pages": PanelTop,
  Onboarding: Sparkles,
  Navigation: Compass,
  Motion: Clapperboard,
};

const SOURCE_ICONS: Record<string, Icon> = {
  "": Layers,
  Dribbble: Target,
  Behance: Palette,
  Figma: PenTool,
  Mobbin: Smartphone,
  Awwwards: Award,
  Pinterest: Image,
  Website: Globe,
  Upload: Upload,
};

function SourceGlyph({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  if (type === "X") {
    return (
      <span
        aria-hidden
        className={cn(
          "grid h-3.5 w-3.5 place-items-center text-[11px] font-semibold",
          className,
        )}
      >
        𝕏
      </span>
    );
  }
  const Glyph = SOURCE_ICONS[type] ?? Layers;
  return <Glyph size={14} strokeWidth={1.75} className={className} />;
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
  icon: Icon,
  count,
  children,
  onClick,
}: {
  active: boolean;
  icon: Icon;
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
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors",
        active
          ? "bg-[var(--hover)] font-medium !text-[var(--text)]"
          : "!text-[var(--muted-2)] hover:bg-[var(--hover)] hover:!text-[var(--muted)]",
      )}
    >
      <Icon
        size={14}
        strokeWidth={1.75}
        className={active ? "!text-[var(--text)]" : "!text-[var(--muted-2)]"}
      />
      <span>{children}</span>
      {count !== undefined && (
        <span
          className={cn(
            "text-[10px] tabular-nums",
            active ? "!text-[var(--muted)]" : "!text-[var(--muted-2)]",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SourceMenu({
  source,
  onChange,
}: {
  source: SourceType | "";
  onChange: (source: SourceType | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const label = source || "All sources";

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label="Source"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors",
          source
            ? "bg-[var(--hover)] font-medium !text-[var(--text)]"
            : "!text-[var(--muted-2)] hover:bg-[var(--hover)] hover:!text-[var(--muted)]",
        )}
      >
        <SourceGlyph type={source} />
        {label}
        <ChevronDown size={12} strokeWidth={1.75} className="opacity-70" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Source"
          className="absolute top-full left-0 z-30 mt-1 min-w-[11rem] rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-sm"
        >
          {["", ...SOURCE_TYPES].map((type) => {
            const value = type as SourceType | "";
            const selected = source === value;
            return (
              <button
                key={value || "all"}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]",
                  selected
                    ? "bg-[var(--hover)] text-[var(--text)]"
                    : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
                )}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                }}
              >
                <SourceGlyph type={value} />
                <span className="flex-1">{value || "All sources"}</span>
                {selected && <Check size={12} strokeWidth={2} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
      className="border-b border-[var(--border)] px-2 py-2 md:px-4"
    >
      <div className="flex w-max max-w-full items-center gap-1">
        <div className="no-scrollbar min-w-0 overflow-x-auto">
          <div className="flex w-max items-center gap-0.5">
            {collections
              .filter((collection) => !isHiddenNavCollection(collection.name))
              .map((collection) => (
                <Chip
                  key={collection.id}
                  active={view.type === "collection" && view.id === collection.id}
                  icon={CATEGORY_ICONS[collection.name] ?? Folder}
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
          <>
            <div className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />
            <SourceMenu source={source} onChange={onSourceChange} />
          </>
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
