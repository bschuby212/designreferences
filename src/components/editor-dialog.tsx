"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Clipboard, ImagePlus, Link2, LoaderCircle, Upload } from "lucide-react";
import type { LinkPreview } from "@/lib/preview/types";
import {
  SOURCE_TYPES,
  type CreateReferenceInput,
  type SourceType,
  type ThumbnailType,
} from "@/lib/storage/types";
import { base64ToBlob, cn, normalizeUrl } from "@/lib/utils";
import { useLibrary } from "./library-provider";
import { useBreakpoint, useObjectUrl } from "./hooks";
import { Modal } from "./sheet";
import { Sheet } from "./sheet";
import {
  Field,
  GhostButton,
  PrimaryButton,
  areaClass,
  inputClass,
} from "./ui";

export type EditorState =
  | { mode: "link" }
  | { mode: "upload"; file?: File }
  | { mode: "edit"; id: string };

interface EditorDialogProps {
  state: EditorState | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function EditorDialog({ state, onClose, onSaved }: EditorDialogProps) {
  const breakpoint = useBreakpoint();
  const mobile = breakpoint === "mobile";
  const title =
    state?.mode === "edit"
      ? "Edit"
      : state?.mode === "upload"
        ? "Upload image"
        : "Add link";

  const body = state ? (
    <EditorForm
      key={`${state.mode}-${state.mode === "edit" ? state.id : state.mode === "upload" ? state.file?.name ?? "new" : "link"}`}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : null;

  if (mobile) {
    return (
      <Sheet
        open={Boolean(state)}
        onClose={onClose}
        side="bottom"
        title={title}
        swipeToDismiss
        className="h-[94dvh]"
      >
        {body}
      </Sheet>
    );
  }

  return (
    <Modal open={Boolean(state)} onClose={onClose} title={title}>
      {body}
    </Modal>
  );
}

function EditorForm({
  state,
  onClose,
  onSaved,
}: {
  state: EditorState;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { collections, references, createReference, updateReference } =
    useLibrary();
  const existing =
    state.mode === "edit"
      ? references.find((r) => r.id === state.id)
      : undefined;
  const initialFile = state.mode === "upload" ? state.file : undefined;

  const [url, setUrl] = useState(existing?.url ?? "");
  const [title, setTitle] = useState(
    existing?.title ??
      (initialFile ? initialFile.name.replace(/\.[^.]+$/, "") : ""),
  );
  const [source, setSource] = useState<SourceType>(
    existing?.source ?? (state.mode === "upload" ? "Upload" : "Website"),
  );
  const [collectionId, setCollectionId] = useState(existing?.collectionId ?? "");
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [thumbnail, setThumbnail] = useState<Blob | null>(
    initialFile ?? existing?.thumbnail ?? null,
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(existing?.thumbnailUrl ?? "");
  const [thumbnailType, setThumbnailType] = useState<ThumbnailType>(
    existing?.thumbnailType ?? (state.mode === "upload" ? "upload" : "placeholder"),
  );
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPreviewed = useRef("");
  const urlRef = useRef<HTMLInputElement>(null);
  const blobPreview = useObjectUrl(thumbnail);
  const previewUrl = blobPreview || thumbnailUrl || null;

  useEffect(() => {
    if (state.mode === "link") {
      const t = window.setTimeout(() => urlRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [state.mode]);

  async function runPreview(raw: string) {
    const normalized = normalizeUrl(raw);
    if (!normalized || lastPreviewed.current === normalized) return;
    lastPreviewed.current = normalized;
    setPreviewing(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const data = (await res.json()) as LinkPreview & { error?: string };
      if (!res.ok) return;
      setUrl(data.url || normalized);
      if (data.title) setTitle((current) => current || data.title);
      if (data.source) setSource(data.source);
      if (data.thumbnail) {
        setThumbnail(base64ToBlob(data.thumbnail.data, data.thumbnail.mime));
        setThumbnailType(data.thumbnailType);
      }
      if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl);
    } finally {
      setPreviewing(false);
    }
  }

  useEffect(() => {
    if (state.mode !== "link") return;
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    const timer = window.setTimeout(() => void runPreview(url), 450);
    return () => window.clearTimeout(timer);
  }, [url, state.mode]);

  function onPick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setThumbnail(file);
    setThumbnailType("upload");
    setThumbnailUrl("");
    setTitle((current) => current || file.name.replace(/\.[^.]+$/, ""));
  }

  async function save() {
    setSaving(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: CreateReferenceInput = {
        title: title.trim(),
        url: normalizeUrl(url),
        thumbnail,
        thumbnailUrl: thumbnailUrl || null,
        thumbnailType: thumbnail || thumbnailUrl ? thumbnailType : "placeholder",
        source: state.mode === "upload" && source === "Website" ? "Upload" : source,
        collectionId: collectionId || null,
        tags: parsedTags,
        notes,
      };
      if (state.mode === "edit" && existing) {
        await updateReference(existing.id, payload);
        onSaved(existing.id);
      } else {
        const created = await createReference(payload);
        onSaved(created.id);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(thumbnail || normalizeUrl(url) || title.trim());

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {state.mode === "link" && (
          <Field label="URL">
            <input
              ref={urlRef}
              value={url}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="https://"
              className={inputClass}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text) window.setTimeout(() => void runPreview(text), 0);
              }}
            />
          </Field>
        )}

        <div className="overflow-hidden rounded-[var(--radius)] bg-[var(--hover)]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="block max-h-64 w-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 text-[12px] text-[var(--muted-2)]">
              {previewing ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Fetching preview
                </>
              ) : state.mode === "upload" || state.mode === "edit" ? (
                <UploadPicker onPick={onPick} />
              ) : (
                "Thumbnail appears after you paste a link"
              )}
            </div>
          )}
        </div>

        {(state.mode === "upload" || (state.mode === "edit" && thumbnail)) && (
          <UploadPicker onPick={onPick} compact />
        )}

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Optional"
          />
        </Field>
        <Field label="Source">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as SourceType)}
            className={inputClass}
          >
            {SOURCE_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        {state.mode !== "link" && (
          <Field label="Source URL">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </Field>
        )}
        <Field label="Collection">
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={inputClass}
            placeholder="comma separated"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={areaClass}
            placeholder="Optional"
          />
        </Field>
      </div>

      <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <GhostButton className="hidden sm:inline-flex" onClick={onClose}>
          Cancel
        </GhostButton>
        <PrimaryButton className="flex-1" disabled={!canSave || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function UploadPicker({
  onPick,
  compact,
}: {
  onPick: (file: File | undefined) => void;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function paste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        onPick(new File([blob], "pasted.png", { type: blob.type }));
        return;
      }
    } catch {
      // Clipboard may be blocked; paste events still work.
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) onPick(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPick]);

  return (
    <div className={cn("flex flex-wrap gap-2", compact && "justify-start")}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <MiniAction
        icon={<ImagePlus size={14} />}
        label="Photo library"
        onClick={() => fileRef.current?.click()}
      />
      <MiniAction
        icon={<Upload size={14} />}
        label="Files"
        onClick={() => fileRef.current?.click()}
      />
      <MiniAction
        icon={<Camera size={14} />}
        label="Camera"
        onClick={() => cameraRef.current?.click()}
      />
      <MiniAction
        icon={<Clipboard size={14} />}
        label="Paste"
        onClick={() => void paste()}
      />
    </div>
  );
}

function MiniAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-[12px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
    >
      {icon}
      {label}
    </button>
  );
}

export function AddMenu({
  open,
  onClose,
  onLink,
  onUpload,
  onPaste,
  mobile,
}: {
  open: boolean;
  onClose: () => void;
  onLink: () => void;
  onUpload: () => void;
  onPaste: () => void;
  mobile: boolean;
}) {
  if (!open) return null;

  const items = (
    <div className="py-1">
      <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-2)]">
        Create
      </div>
      <MenuItem icon={<Link2 size={15} />} onClick={onLink}>
        Add Link
      </MenuItem>
      <MenuItem icon={<ImagePlus size={15} />} onClick={onUpload}>
        Upload Image
      </MenuItem>
      {mobile && (
        <MenuItem icon={<Clipboard size={15} />} onClick={onPaste}>
          Paste Image
        </MenuItem>
      )}
    </div>
  );

  if (mobile) {
    return (
      <Sheet open={open} onClose={onClose} side="bottom" title="Add reference">
        <div className="px-2 pb-[max(16px,env(safe-area-inset-bottom))]">{items}</div>
      </Sheet>
    );
  }

  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-sm">
      {items}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-[13px] hover:bg-[var(--hover)]"
    >
      <span className="text-[var(--muted)]">{icon}</span>
      {children}
    </button>
  );
}
