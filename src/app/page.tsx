"use client";

import { AppShell } from "@/components/app-shell";
import { LibraryProvider } from "@/components/library-provider";

export default function Home() {
  return (
    <LibraryProvider>
      <AppShell />
    </LibraryProvider>
  );
}
