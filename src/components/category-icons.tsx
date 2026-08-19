import {
  AtSign,
  Award,
  Brush,
  Clapperboard,
  Compass,
  Folder,
  Globe,
  Hash,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  MousePointer2,
  Rocket,
  Smartphone,
  Sparkles,
  Upload,
} from "lucide-react";
import type { SourceType } from "@/lib/storage/types";

// A distinct icon per category, kept constant everywhere it appears
// (top-nav tabs, card chips, detail modal). No icon is reused across
// different category types. Rendered via switch statements so each icon is a
// statically-defined component (no dynamic component selection during render).

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CollectionIcon({
  name,
  ...props
}: IconProps & { name?: string | null }) {
  switch (name) {
    case "Mobile Apps":
      return <Smartphone {...props} />;
    case "Product Design":
    case "Dashboards":
      return <LayoutDashboard {...props} />;
    case "Website":
    case "Marketing":
    case "Web":
    case "Typography":
    case "Branding":
      return <Globe {...props} />;
    case "Onboarding":
      return <Rocket {...props} />;
    case "Navigation":
      return <Compass {...props} />;
    case "Motion":
      return <Clapperboard {...props} />;
    default:
      return <Folder {...props} />;
  }
}

export function SourceIcon({
  source,
  ...props
}: IconProps & { source: SourceType }) {
  switch (source) {
    case "X":
      return <AtSign {...props} />;
    case "Dribbble":
      return <Brush {...props} />;
    case "Behance":
      return <Layers {...props} />;
    case "Figma":
      return <MousePointer2 {...props} />;
    case "Mobbin":
      return <Sparkles {...props} />;
    case "Awwwards":
      return <Award {...props} />;
    case "Pinterest":
      return <ImageIcon {...props} />;
    case "Upload":
      return <Upload {...props} />;
    default:
      return <Globe {...props} />;
  }
}

export function TagIcon(props: IconProps) {
  return <Hash {...props} />;
}

export function AllIcon(props: IconProps) {
  return <LayoutGrid {...props} />;
}

export function CollectionChip({
  name,
  onClick,
}: {
  name: string;
  onClick?: () => void;
}) {
  const className =
    "inline-flex h-[22px] min-w-0 max-w-[46%] shrink items-center gap-1 overflow-hidden rounded-full bg-[var(--chip-track)] px-1.5 text-[11px] font-normal whitespace-nowrap text-[var(--muted)]";
  const body = (
    <>
      <CollectionIcon name={name} size={11} strokeWidth={1.75} className="shrink-0" />
      <span className="min-w-0 truncate">{name}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} hover:text-[var(--text)]`}
      >
        {body}
      </button>
    );
  }
  return <span className={className}>{body}</span>;
}

export function CompanyHeading({
  name,
  onClick,
}: {
  name: string;
  onClick?: () => void;
}) {
  const className =
    "min-w-0 flex-1 truncate text-left text-[16px] leading-tight font-medium text-[var(--text)]";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {name}
      </button>
    );
  }
  return <span className={className}>{name}</span>;
}
