import {
  AppWindow,
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
  Palette,
  Rocket,
  Smartphone,
  Sparkles,
  Type,
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
    case "Web":
      return <AppWindow {...props} />;
    case "Dashboards":
      return <LayoutDashboard {...props} />;
    case "Onboarding":
      return <Rocket {...props} />;
    case "Navigation":
      return <Compass {...props} />;
    case "Typography":
      return <Type {...props} />;
    case "Motion":
      return <Clapperboard {...props} />;
    case "Branding":
      return <Palette {...props} />;
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
