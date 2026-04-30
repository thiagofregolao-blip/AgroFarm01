import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number;
  onValueChange: (rawValue: string) => void;
  prefix?: string;
  decimals?: number;
}

/** Format a number for display in pt-BR style (dot=thousands, comma=decimal) */
function formatForDisplay(numStr: string, decimals: number): string {
  const num = parseFloat(numStr);
  if (isNaN(num) || num === 0) return "";
  if (decimals === 0) {
    return Math.round(num).toLocaleString("pt-BR");
  }
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Parse display string back to numeric string (removes thousand separators, normalises decimal) */
function parseDisplayToRaw(display: string, decimals: number): string {
  let s = display.replace(/[^\d.,]/g, "");
  if (decimals === 0) return s.replace(/\D/g, "") || "0";

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);

  if (decimalPos !== -1) {
    const intPart = s.slice(0, decimalPos).replace(/[.,]/g, "") || "0";
    const decPart = s.slice(decimalPos + 1).replace(/[.,]/g, "").slice(0, decimals);
    return decPart ? `${intPart}.${decPart}` : `${intPart}.`;
  }

  return s.replace(/[.,]/g, "") || "0";
}

// Kept for backward-compat exports (not used internally anymore)
export function formatCurrencyValue(raw: string, decimals: number): string {
  return formatForDisplay(raw, decimals);
}
export function toRawNumber(formatted: string, decimals: number): string {
  return parseDisplayToRaw(formatted, decimals);
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, prefix = "$ ", decimals = 2, ...props }, ref) => {
    const [display, setDisplay] = React.useState("");
    const [focused, setFocused] = React.useState(false);

    // Sync from external value when not focused
    React.useEffect(() => {
      if (focused) return;
      const numStr = String(value ?? "");
      const num = parseFloat(numStr);
      if (!numStr || isNaN(num) || num === 0) {
        setDisplay("");
      } else {
        setDisplay(formatForDisplay(numStr, decimals));
      }
    }, [value, decimals, focused]);

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      setFocused(true);
      // Show raw number on focus (without formatting)
      const raw = parseDisplayToRaw(display, decimals);
      const num = parseFloat(raw);
      if (!isNaN(num) && num !== 0) {
        const rawDisplay = decimals > 0 ? num.toFixed(decimals) : String(Math.round(num));
        setDisplay(rawDisplay);
        // Select all after short delay (browser quirk)
        setTimeout(() => e.target.select(), 0);
      }
      props.onFocus?.(e);
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      setFocused(false);
      const raw = parseDisplayToRaw(display, decimals);
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) {
        setDisplay(formatForDisplay(String(num), decimals));
        onValueChange(decimals > 0 ? num.toFixed(decimals) : String(Math.round(num)));
      } else {
        setDisplay("");
        onValueChange("0");
      }
      props.onBlur?.(e);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      let raw = e.target.value;
      if (decimals === 0) {
        // Only allow digits
        raw = raw.replace(/\D/g, "");
        setDisplay(raw);
        onValueChange(raw || "0");
      } else {
        raw = parseDisplayToRaw(raw, decimals);
        setDisplay(raw);
        onValueChange(raw || "0");
      }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      const allowed = [
        "Backspace", "Delete", "Tab", "Escape", "Enter",
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
      ];
      if (allowed.includes(e.key)) return;
      if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
      // Allow digits
      if (/^\d$/.test(e.key)) return;
      // Allow decimal separator (only if decimals > 0)
      if (decimals > 0 && (e.key === "." || e.key === ",")) return;
      e.preventDefault();
    }

    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode={decimals === 0 ? "numeric" : "decimal"}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            prefix ? "pl-7" : "",
            className
          )}
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
