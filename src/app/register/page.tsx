"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AuthBrand,
  AuthCard,
  AuthError,
  AuthFooterLink,
  AuthInput,
  AuthLabel,
  AuthPageLayout,
  AuthPrimaryButton,
  AuthSuccessPanel,
} from "@/components/auth/AuthShell";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 2000);
  }

  if (success) {
    return (
      <AuthSuccessPanel
        title="¡Cuenta creada!"
        description="Revisa tu email para confirmar tu cuenta. Si la confirmación por email está desactivada, serás redirigido automáticamente."
      />
    );
  }

  return (
    <AuthPageLayout>
      <AuthBrand brandName="Visual Sitemap" subtitle="Crea tu cuenta" />

      <form onSubmit={handleRegister}>
        <AuthCard>
          <div className="space-y-5">
            {error && <AuthError>{error}</AuthError>}

            <div>
              <AuthLabel htmlFor="email">Email</AuthLabel>
              <AuthInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
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
                autoComplete="new-password"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <div>
              <AuthLabel htmlFor="confirmPassword">Confirmar contraseña</AuthLabel>
              <AuthInput
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <AuthPrimaryButton disabled={loading}>
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </AuthPrimaryButton>
          </div>
        </AuthCard>
      </form>

      <AuthFooterLink href="/login" label="¿Ya tienes cuenta?" linkText="Inicia sesión" />
    </AuthPageLayout>
  );
}
