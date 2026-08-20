"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Clipboard,
  ImagePlus,
  Link2,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import type { LinkPreview } from "@/lib/preview/types";
import {
  SOURCE_TYPES,
  type Aspect,
  type CreateReferenceInput,
  type ReferenceScreen,
  type SourceType,
  type ThumbnailType,
} from "@/lib/storage/types";
import { base64ToBlob, blobToDataUrl, cn, normalizeUrl } from "@/lib/utils";
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
  const [collectionIds, setCollectionIds] = useState<string[]>(
    existing?.collectionIds ?? [],
  );
  const [screens, setScreens] = useState<ReferenceScreen[]>(
    existing?.screens ?? [],
  );
  const [aspect, setAspect] = useState<Aspect>(existing?.aspect ?? "landscape");
  const [screenUrl, setScreenUrl] = useState("");
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
    // Uploads become carousel screens too, stored inline so they survive a
    // reload the same way seeded screens do.
    void blobToDataUrl(file).then((src) => addScreen(src));
  }

  function addScreen(src: string) {
    if (!src) return;
    setScreens((current) =>
      current.some((screen) => screen.src === src)
        ? current
        : [...current, { src, label: `Screen ${current.length + 1}` }],
    );
  }

  function removeScreen(src: string) {
    setScreens((current) =>
      current
        .filter((screen) => screen.src !== src)
        .map((screen, index) => ({ ...screen, label: `Screen ${index + 1}` })),
    );
  }

  function moveScreen(index: number, delta: number) {
    setScreens((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((screen, position) => ({
        ...screen,
        label: `Screen ${position + 1}`,
      }));
    });
  }

  async function save() {
    setSaving(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const resolved = screens.length
        ? screens
        : thumbnailUrl
          ? [{ src: thumbnailUrl, label: "Screen 1" }]
          : [];
      const payload: CreateReferenceInput = {
        title: title.trim(),
        url: normalizeUrl(url),
        thumbnail,
        thumbnailUrl: resolved[0]?.src ?? thumbnailUrl ?? null,
        thumbnailType: thumbnail || thumbnailUrl ? thumbnailType : "placeholder",
        source: state.mode === "upload" && source === "Website" ? "Upload" : source,
        collectionIds,
        screens: resolved,
        aspect,
        seedKey: existing?.seedKey ?? null,
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
        <Field label={`Screens (${screens.length})`}>
          <div className="space-y-2">
            {screens.length > 0 && (
              <ul className="space-y-1.5">
                {screens.map((screen, index) => (
                  <li
                    key={screen.src}
                    className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] p-1.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screen.src}
                      alt={screen.label}
                      className="h-10 w-10 shrink-0 rounded bg-[var(--hover)] object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--muted)]">
                      {screen.label}
                    </span>
                    <button
                      type="button"
                      aria-label={`Move ${screen.label} earlier`}
                      disabled={index === 0}
                      className="grid h-9 w-7 place-items-center rounded text-[var(--muted-2)] hover:bg-[var(--hover)] disabled:opacity-30"
                      onClick={() => moveScreen(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${screen.label} later`}
                      disabled={index === screens.length - 1}
                      className="grid h-9 w-7 place-items-center rounded text-[var(--muted-2)] hover:bg-[var(--hover)] disabled:opacity-30"
                      onClick={() => moveScreen(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${screen.label}`}
                      className="grid h-9 w-7 place-items-center rounded text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                      onClick={() => removeScreen(screen.src)}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={screenUrl}
                onChange={(e) => setScreenUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addScreen(normalizeUrl(screenUrl) || screenUrl.trim());
                  setScreenUrl("");
                }}
                placeholder="Screen image URL"
                className={inputClass}
              />
              <GhostButton
                className="shrink-0 border border-[var(--border)]"
                onClick={() => {
                  addScreen(normalizeUrl(screenUrl) || screenUrl.trim());
                  setScreenUrl("");
                }}
              >
                Add
              </GhostButton>
            </div>
            <p className="text-[11px] text-[var(--muted-2)]">
              {screens.length > 1
                ? `${screens.length} meaningful images will appear in the carousel.`
                : "One complete image is valid; add more only for a flow or longer page."}
            </p>
          </div>
        </Field>
        <Field label="Frame">
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as Aspect)}
            className={inputClass}
          >
            <option value="landscape">Landscape (web)</option>
            <option value="portrait">Portrait (mobile)</option>
          </select>
        </Field>
        <Field label="Collections">
          <div className="flex flex-wrap gap-1.5">
            {collections.map((collection) => {
              const active = collectionIds.includes(collection.id);
              return (
                <button
                  key={collection.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setCollectionIds((current) =>
                      current.includes(collection.id)
                        ? current.filter((id) => id !== collection.id)
                        : [...current, collection.id],
                    )
                  }
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-[12px]",
                    active
                      ? "border-[var(--text)] bg-[var(--text)] text-white"
                      : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)]",
                  )}
                >
                  {collection.name}
                </button>
              );
            })}
          </div>
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
