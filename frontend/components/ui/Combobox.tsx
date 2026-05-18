"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;   // unique id / key
  label: string;   // primary display text
  sub?: string;    // optional secondary hint text
}

interface ComboboxProps {
  options: ComboboxOption[];
  /** The currently displayed text in the input */
  inputValue: string;
  /** Called on every change — selectedOption is undefined when user types freely */
  onChange: (inputValue: string, selectedOption?: ComboboxOption) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  /** If true, shows a small "custom" pill when typed value doesn't match any option */
  allowCustom?: boolean;
  /** Label shown above the hint row when no match found */
  customHint?: string;
}

export function Combobox({
  options,
  inputValue,
  onChange,
  placeholder = "Search or type…",
  className,
  required,
  disabled,
  allowCustom = true,
  customHint = "Use custom value",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter options based on current input
  const filtered = inputValue.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        (o.sub?.toLowerCase().includes(inputValue.toLowerCase()) ?? false)
      )
    : options;

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === inputValue.trim().toLowerCase()
  );
  const showCustomRow =
    allowCustom && inputValue.trim() && !exactMatch;

  const totalItems = filtered.length + (showCustomRow ? 1 : 0);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  const selectOption = useCallback(
    (opt: ComboboxOption) => {
      onChange(opt.label, opt);
      setOpen(false);
      setHighlighted(-1);
    },
    [onChange]
  );

  const confirmCustom = useCallback(() => {
    onChange(inputValue, undefined);
    setOpen(false);
    setHighlighted(-1);
  }, [inputValue, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        setHighlighted(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, totalItems - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlighted >= 0 && highlighted < filtered.length) {
          selectOption(filtered[highlighted]);
        } else if (showCustomRow && highlighted === filtered.length) {
          confirmCustom();
        } else if (inputValue.trim()) {
          confirmCustom();
          setOpen(false);
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlighted(-1);
        break;
    }
  };

  const handleClear = () => {
    onChange("", undefined);
    inputRef.current?.focus();
    setOpen(true);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input row */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value, undefined);
            setOpen(true);
            setHighlighted(-1);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-900",
            "placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all",
            disabled && "cursor-not-allowed bg-gray-50 text-gray-400"
          )}
        />

        {/* Clear / chevron */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {inputValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-gray-400 transition-transform duration-150",
                open && "rotate-180"
              )}
            />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          className={cn(
            "absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto",
            "rounded-xl border border-gray-100 bg-white py-1 shadow-lg shadow-gray-200/60",
            "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
          )}
        >
          {filtered.length === 0 && !showCustomRow && (
            <li className="px-3 py-2.5 text-xs text-gray-400 text-center">
              No results found
            </li>
          )}

          {filtered.map((opt, idx) => {
            const isActive = highlighted === idx;
            const isSelected =
              opt.label.toLowerCase() === inputValue.toLowerCase();
            return (
              <li
                key={opt.value}
                onMouseDown={() => selectOption(opt)}
                onMouseEnter={() => setHighlighted(idx)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                <span className="flex-1 truncate text-gray-900">
                  {opt.label}
                </span>
                {opt.sub && (
                  <span className="text-xs text-gray-400 truncate max-w-[120px]">
                    {opt.sub}
                  </span>
                )}
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                )}
              </li>
            );
          })}

          {/* Custom value row */}
          {showCustomRow && (
            <li
              onMouseDown={confirmCustom}
              onMouseEnter={() => setHighlighted(filtered.length)}
              className={cn(
                "flex cursor-pointer items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm transition-colors",
                highlighted === filtered.length ? "bg-blue-50" : "hover:bg-gray-50"
              )}
            >
              <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                Custom
              </span>
              <span className="flex-1 truncate text-gray-700">
                &ldquo;{inputValue}&rdquo;
              </span>
              <span className="text-[10px] text-gray-400">{customHint}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
