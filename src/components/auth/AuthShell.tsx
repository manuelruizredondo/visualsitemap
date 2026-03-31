"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/* ── Page wrapper ───────────────────────────────────────────────── */
export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--ec-background)" }}
    >
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

/* ── Brand / logo block ─────────────────────────────────────────── */
export function AuthBrand({
  brandName,
  subtitle,
}: {
  brandName: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center mb-8">
      <div
        className="inline-flex items-center justify-center w-12 h-12 rounded-[16px] mb-4"
        style={{ background: "var(--ec-primary-container)" }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ec-on-primary-container)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <h1
        className="text-[22px] font-bold tracking-tight"
        style={{ color: "var(--ec-on-surface)" }}
      >
        {brandName}
      </h1>
      {subtitle && (
        <p className="text-[13px] mt-1" style={{ color: "var(--ec-on-surface-variant)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── Card container ─────────────────────────────────────────────── */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-[20px] p-6"
      style={{
        background: "var(--ec-surface-container-lowest)",
        boxShadow: "var(--ec-shadow-elevated)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Field label ────────────────────────────────────────────────── */
export function AuthLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[13px] font-semibold mb-1.5"
      style={{ color: "var(--ec-on-surface-variant)" }}
    >
      {children}
    </label>
  );
}

/* ── Input — thin wrapper so auth pages keep using AuthInput name ── */
export function AuthInput(props: React.ComponentProps<typeof Input>) {
  return <Input shape="rounded" focusColor="purple" className="auth-ec-input text-[13px] px-3" {...props} />;
}

/* ── Primary button — thin wrapper ──────────────────────────────── */
export function AuthPrimaryButton({
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="primary"
      shape="rounded"
      fullWidth
      disabled={disabled}
      {...props}
    >
      {children}
    </Button>
  );
}

/* ── Error banner ───────────────────────────────────────────────── */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[13px] px-4 py-3 rounded-[12px]"
      style={{
        background: "var(--ec-error-container)",
        color: "var(--ec-error)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Footer link ────────────────────────────────────────────────── */
export function AuthFooterLink({
  href,
  label,
  linkText,
}: {
  href: string;
  label: string;
  linkText: string;
}) {
  return (
    <p
      className="text-center text-[13px] mt-4"
      style={{ color: "var(--ec-on-surface-variant)" }}
    >
      {label}{" "}
      <Link
        href={href}
        className="font-semibold transition-opacity hover:opacity-70"
        style={{ color: "var(--ec-secondary)" }}
      >
        {linkText}
      </Link>
    </p>
  );
}

/* ── Success panel ──────────────────────────────────────────────── */
export function AuthSuccessPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--ec-background)" }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="rounded-[20px] p-8"
          style={{
            background: "var(--ec-surface-container-lowest)",
            boxShadow: "var(--ec-shadow-elevated)",
          }}
        >
          <div
            className="w-12 h-12 rounded-[16px] flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--ec-primary-container)" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ec-on-primary-container)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2
            className="text-[18px] font-bold mb-2"
            style={{ color: "var(--ec-on-surface)" }}
          >
            {title}
          </h2>
          <p className="text-[13px]" style={{ color: "var(--ec-on-surface-variant)" }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
