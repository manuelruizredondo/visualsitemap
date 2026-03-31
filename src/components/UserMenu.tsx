"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface UserMenuProps {
  email: string;
}

export default function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = email.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2  py-2 rounded-full hover:bg-white/8 transition-colors w-full text-left"
      >
        <span className="w-7 h-7 rounded-full bg-[#E2F162] text-[#535c00] flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </span>
        <span className="text-sm text-[#9ba0a2] truncate flex-1">{email}</span>
        <svg className="w-4 h-4 text-[#6b7072] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 rounded-2xl overflow-hidden z-20" style={{ background: "rgba(26, 28, 30, 0.9)", backdropFilter: "blur(20px)" }}>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#9ba0a2] hover:bg-white/8 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {loading ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
