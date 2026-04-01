import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return { url, key };
}

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) {
    console.error(
      "[middleware] Faltan NEXT_PUBLIC_SUPABASE_URL o clave pública (ANON / PUBLISHABLE). Revisa variables en Vercel."
    );
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // No usar request.cookies.set en Edge (Vercel / Next.js 15+): puede lanzar y provocar
          // MIDDLEWARE_INVOCATION_FAILED. Solo escribir en la respuesta.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const publicPaths = ["/login", "/register", "/auth/callback"];
    const isPublicPath = publicPaths.some((path) =>
      request.nextUrl.pathname.startsWith(path)
    );

    if (!user && !isPublicPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    if (
      user &&
      (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register")
    ) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }

    return response;
  } catch {
    // Expected in Edge runtime when session cookies are stale/expired
    // and the refresh token fetch fails. Safe to ignore — user will
    // be treated as unauthenticated and redirected to /login if needed.
    const publicPaths = ["/login", "/register", "/auth/callback"];
    const isPublicPath = publicPaths.some((path) =>
      request.nextUrl.pathname.startsWith(path)
    );
    if (!isPublicPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next({ request });
  }
}
