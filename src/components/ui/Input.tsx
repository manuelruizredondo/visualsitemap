"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Elevated Canvas — unified Input component.
 *
 * Shape
 *   pill    — rounded-full (default, used in main app forms)
 *   rounded — rounded-[60px] (used in auth pages)
 *
 * Focus glow
 *   lime    — rgba(226,241,98,0.35)  ← default, matches primary-container
 *   purple  — var(--ec-secondary)    ← used in auth inputs
 */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  shape?: "pill" | "rounded";
  focusColor?: "lime" | "purple";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    shape = "pill",
    focusColor = "lime",
    className = "",
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const shapeClass = shape === "pill" ? "rounded-full" : "rounded-[60px]";
  const focusGlow =
    focusColor === "purple"
      ? "inset 0 0 0 2px var(--ec-secondary)"
      : "inset 0 0 0 2px rgba(226,241,98,0.35)";
  const blurShadow = "inset 0 0 0 1px transparent";

  return (
    <input
      ref={ref}
      {...rest}
      className={`w-full px-4 py-2.5 text-sm bg-[#eff1f2] focus:outline-none transition-all ${shapeClass} ${className}`}
      style={{
        color: "var(--ec-on-surface)",
        boxShadow: blurShadow,
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = focusGlow;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = blurShadow;
        onBlur?.(e);
      }}
    />
  );
});

/**
 * Elevated Canvas — unified Textarea component.
 * Same visual language as Input, always shape "rounded" (rounded-2xl for multi-line).
 */

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  focusColor?: "lime" | "purple";
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      focusColor = "lime",
      mono = false,
      className = "",
      style,
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) {
    const focusGlow =
      focusColor === "purple"
        ? "inset 0 0 0 2px var(--ec-secondary)"
        : "inset 0 0 0 2px rgba(226,241,98,0.35)";
    const blurShadow = "inset 0 0 0 1px transparent";

    return (
      <textarea
        ref={ref}
        {...rest}
        className={`w-full p-4 text-sm bg-[#eff1f2] rounded-2xl resize-none focus:outline-none transition-all ${
          mono ? "font-mono" : ""
        } ${className}`}
        style={{
          color: "var(--ec-on-surface)",
          boxShadow: blurShadow,
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = focusGlow;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = blurShadow;
          onBlur?.(e);
        }}
      />
    );
  }
);
