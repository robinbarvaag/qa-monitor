"use client";

import { Badge } from "@qa/ui/badge";
import { Button } from "@qa/ui/button";
import { Checkbox } from "@qa/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@qa/ui/command";
import { cn } from "@qa/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@qa/ui/popover";
import { ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";

export interface MultiSelectOption {
  label: string;
  value: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Velg…",
  searchPlaceholder = "Søk…",
  emptyText = "Ingen treff.",
  className,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className={cn("justify-between gap-2", className)} />
        }
      >
        <span className="truncate">{placeholder}</span>
        {value.length > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {value.length}
          </Badge>
        ) : (
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <CommandItem key={opt.value} value={opt.value} onSelect={() => toggle(opt.value)}>
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => onChange([])}
              >
                <X className="size-3.5" />
                Nullstill ({value.length})
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
