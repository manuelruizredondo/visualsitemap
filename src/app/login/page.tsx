"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginEmail } from "@/lib/auth/resolve-demo-login";
import {
  AuthBrand,
  AuthCard,
  AuthError,
  AuthFooterLink,
  AuthInput,
  AuthLabel,
  AuthPageLayout,
  AuthPrimaryButton,
} from "@/components/auth/AuthShell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = resolveLoginEmail(email);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <AuthPageLayout>
      <AuthBrand brandName="Visual Sitemap" subtitle="Inicia sesión en tu cuenta" />

      <form onSubmit={handleLogin} noValidate>
        <AuthCard>
          <div className="space-y-5">
            {error && <AuthError>{error}</AuthError>}

            <div>
              <AuthLabel htmlFor="email">Email o usuario demo</AuthLabel>
              <AuthInput
                id="email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="prueba o tu@email.com"
              />
            </div>

            <div>
              <AuthLabel htmlFor="password">Contraseña</AuthLabel>
              <AuthInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                minLength={1}
              />
            </div>

            <AuthPrimaryButton disabled={loading}>
              {loading ? "Iniciando sesión…" : "Iniciar sesión"}
            </AuthPrimaryButton>
          </div>
        </AuthCard>
      </form>

      <AuthFooterLink href="/register" label="¿No tienes cuenta?" linkText="Regístrate" />
    </AuthPageLayout>
  );
}
