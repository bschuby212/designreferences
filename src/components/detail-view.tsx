"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Heart, Pencil, Trash2, X } from "lucide-react";
import type { Collection, Reference } from "@/lib/storage/types";
import { formatSavedDate, productName } from "@/lib/utils";
import { ReferenceCarousel } from "./reference-carousel";
import { areaClass, GhostButton, IconButton } from "./ui";

interface DetailViewProps {
  reference: Reference;
  collectionNames?: string[];
  onClose: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNotes: (notes: string) => void;
  variant: "modal" | "sheet";
}

export function DetailView({
  reference,
  collectionNames,
  onClose,
  onFavorite,
  onEdit,
  onDelete,
  onNotes,
  variant,
}: DetailViewProps) {
  const modal = variant === "modal";
  const company = productName(reference.title || "Untitled");
  const [companyExtract, setCompanyExtract] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCompanyExtract("");
    const params = new URLSearchParams({ name: company });
    void fetch(`/api/company?${params}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { extract?: string } | null) => {
        if (!cancelled) setCompanyExtract(data?.extract?.trim() ?? "");
      })
      .catch(() => {
        if (!cancelled) setCompanyExtract("");
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[var(--surface)]">
      {!modal && (
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-2">
          <div className="flex items-center gap-0.5">
            <IconButton
              label={reference.favorite ? "Unfavorite" : "Favorite"}
              onClick={onFavorite}
            >
              <Heart
                size={16}
                strokeWidth={1.75}
                fill={reference.favorite ? "currentColor" : "none"}
              />
            </IconButton>
            <IconButton label="Edit" onClick={onEdit}>
              <Pencil size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton label="Delete" onClick={onDelete}>
              <Trash2 size={16} strokeWidth={1.75} />
            </IconButton>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      )}

      <div
        className={
          modal
            ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]"
            : "min-h-0 flex-1 overflow-y-auto overscroll-contain"
        }
      >
        <section
          aria-label="Reference media"
          className={
            modal
              ? "flex min-h-0 items-center justify-center overflow-hidden bg-[var(--hover)]"
              : "p-4 pb-0"
          }
        >
          <div
            className={
              modal ? "h-full w-full" : "mx-auto w-full max-w-[420px]"
            }
          >
            <ReferenceCarousel
              screens={reference.screens}
              aspect={reference.aspect}
              title={reference.title || "Reference"}
              variant="detail"
              bleed={modal}
              fit={
                collectionNames?.includes("Mobile Apps")
                  ? "phone"
                  : collectionNames?.includes("Dashboards")
                    ? "dashboard"
                    : "default"
              }
            />
          </div>
        </section>

        <section
          aria-label="Reference details"
          className={
            modal
              ? "min-h-0 overflow-y-auto border-l border-[var(--border)] p-5"
              : "p-4 pb-8"
          }
        >
          {!modal && (
            <h1 className="text-[18px] leading-snug font-medium tracking-tight">
              {reference.title || "Untitled"}
            </h1>
          )}

          <dl className={modal ? "space-y-2 text-[13px]" : "mt-4 space-y-2 text-[13px]"}>
            <Row label="Source">{reference.source}</Row>
            {collectionNames && collectionNames.length > 0 && (
              <Row label={collectionNames.length > 1 ? "Categories" : "Category"}>
                {collectionNames.join(", ")}
              </Row>
            )}
            <Row label="Images">{reference.screens.length}</Row>
            <Row label="Company">{company}</Row>
            <Row label="Saved">{formatSavedDate(reference.createdAt)}</Row>
          </dl>

          {companyExtract && (
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
              {companyExtract}
            </p>
          )}

          {reference.url && (
            <a
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--text)] text-[13px] font-medium text-white"
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              Open source
            </a>
          )}

          <label className="mt-5 flex flex-col gap-1.5">
            <span className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
              Notes
            </span>
            <textarea
              defaultValue={reference.notes}
              key={reference.id + reference.updatedAt}
              className={areaClass}
              placeholder="Add notes or a description…"
              onBlur={(event) => {
                if (event.target.value !== reference.notes) {
                  onNotes(event.target.value);
                }
              }}
            />
          </label>

          {!modal && (
            <div className="mt-4 flex gap-2">
              <GhostButton className="flex-1" onClick={onEdit}>
                Edit
              </GhostButton>
              <GhostButton className="flex-1 text-[var(--danger)]" onClick={onDelete}>
                Delete
              </GhostButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-2">
      <dt className="text-[var(--muted-2)]">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function collectionNamesOf(
  collections: Collection[],
  ids: string[] | undefined,
) {
  if (!ids?.length) return [];
  const byId = new Map(collections.map((collection) => [collection.id, collection.name]));
  return ids
    .map((id) => byId.get(id))
    .filter((name): name is string => Boolean(name));
}
