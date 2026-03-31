"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Elevated Canvas — unified Button component.
 *
 * Variants
 *   primary  — lime bg (#E2F162), olive text. Main CTA.
 *   secondary — subtle surface bg, dark text. For "Verificar", tab toggles, etc.
 *   ghost    — transparent bg, surface hover. For nav items, side buttons.
 *   danger   — red text, red hover bg. For destructive actions.
 *   icon     — square/circle icon button, no text.
 *
 * Shape
 *   pill     — rounded-full (default)
 *   rounded  — rounded-[60px]
 *
 * Size
 *   sm  — compact (py-1.5 px-3, text-xs)
 *   md  — default (py-2.5 px-4, text-sm)
 *   lg  — large  (py-3 px-6, text-sm font-semibold) — full width forms
 *
 * Props
 *   loading  — shows spinner + disables button
 *   fullWidth — w-full
 */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "icon";
  shape?: "pill" | "rounded";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  shape = "pill",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = "",
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  /* ── Shape ───────────────────────────────────────────────────────── */
  const shapeClass = shape === "pill" ? "rounded-full" : "rounded-[60px]";

  /* ── Size ─────────────────────────────────────────────────────────── */
  const sizeClass =
    size === "sm"
      ? "py-1.5 px-3 text-xs"
      : size === "lg"
      ? "py-3 px-6 text-sm"
      : "py-2.5 px-4 text-sm";

  /* ── Common ───────────────────────────────────────────────────────── */
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold border-none cursor-pointer " +
    "transition-all select-none " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    (fullWidth ? "w-full " : "") +
    shapeClass +
    " " +
    sizeClass;

  /* ── Variant styles ──────────────────────────────────────────────── */
  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? {
          background: "var(--ec-primary-container)",
          color: "var(--ec-on-primary-container)",
        }
      : variant === "secondary"
      ? {
          background: "var(--ec-surface-container-low)",
          color: "var(--ec-on-surface)",
        }
      : variant === "ghost"
      ? {
          background: "transparent",
          color: "var(--ec-on-surface-variant)",
        }
      : variant === "danger"
      ? {
          background: "transparent",
          color: "#ef4444",
        }
      : /* icon */
        {
          background: "var(--ec-surface-container-low)",
          color: "var(--ec-on-surface-variant)",
        };

  function handleMouseEnter(e: React.MouseEvent<HTMLButtonElement>) {
    if (!isDisabled) {
      if (variant === "primary") {
        e.currentTarget.style.filter = "brightness(0.93)";
      } else if (variant === "secondary" || variant === "icon") {
        e.currentTarget.style.background = "var(--ec-surface-container)";
      } else if (variant === "ghost") {
        e.currentTarget.style.background = "var(--ec-surface-container-low)";
        e.currentTarget.style.color = "var(--ec-on-surface)";
      } else if (variant === "danger") {
        e.currentTarget.style.background = "rgba(239,68,68,0.08)";
      }
    }
    onMouseEnter?.(e);
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.filter = "none";
    Object.assign(e.currentTarget.style, variantStyle);
    onMouseLeave?.(e);
  }

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={`${base} ${className}`}
      style={{ ...variantStyle, ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {loading ? (
        <>
          <span
            className="border-2 border-t-transparent rounded-full animate-spin flex-shrink-0"
            style={{
              width: size === "lg" ? 18 : 14,
              height: size === "lg" ? 18 : 14,
              borderColor:
                variant === "primary"
                  ? "var(--ec-on-primary-container)"
                  : "currentColor",
              borderTopColor: "transparent",
            }}
          />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
