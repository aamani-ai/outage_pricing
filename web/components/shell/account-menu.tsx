"use client";

import { ChevronsUpDown, LogOut, type LucideIcon, UserPen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Placeholder identity until real auth lands — name/email from the methodology deck.
const NAME = "Christopher Lowell";
const EMAIL = "chris@infrasure.ai";
const INITIALS = "CL";

function MenuItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div
      aria-disabled
      className="text-muted-foreground/50 flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">soon</span>
    </div>
  );
}

function Group({ label }: { label: string }) {
  return <div className="text-muted-foreground/60 px-2 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wider">{label}</div>;
}

function Avatar({ size }: { size: "sm" | "md" }) {
  return (
    <span
      className={
        "bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-md font-semibold " +
        (size === "sm" ? "size-8 text-xs" : "size-9 text-sm")
      }
    >
      {INITIALS}
    </span>
  );
}

export function AccountMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="hover:bg-muted flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors">
          <Avatar size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{NAME}</span>
            <span className="text-muted-foreground block truncate text-xs">{EMAIL}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-64 p-1">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{NAME}</div>
            <div className="text-muted-foreground truncate text-xs">{EMAIL}</div>
          </div>
        </div>
        <div className="bg-border -mx-1 my-1 h-px" />
        <Group label="Account" />
        <MenuItem icon={UserPen} label="Edit profile" />
        <div className="bg-border -mx-1 my-1 h-px" />
        <MenuItem icon={LogOut} label="Log out" />
      </PopoverContent>
    </Popover>
  );
}
