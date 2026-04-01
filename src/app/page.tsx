import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";
import ProjectDashboard from "@/components/ProjectDashboard";

export default async function Home() {
  const user = await getUser();
  const allProjects = await listProjects();

  // Filter projects that belong to this user, and fill missing thumbnailUrl
  // from the home page screenshot if available
  const projects = (user ? allProjects.filter((p) => p.userId === user.id) : allProjects)
    .map((p) => {
      if (p.thumbnailUrl) return p;
      // Find the root URL in pageMeta (path "/" or "")
      const homeKey = Object.keys(p.pageMeta ?? {}).find((url) => {
        try { const { pathname } = new URL(url); return pathname === "/" || pathname === ""; }
        catch { return false; }
      });
      const homeMeta = homeKey ? p.pageMeta[homeKey] : undefined;
      const fallback = homeMeta?.thumbnailPath || homeMeta?.screenshotPath;
      return fallback ? { ...p, thumbnailUrl: fallback } : p;
    });

  return (
    <ProjectDashboard
      initialProjects={projects}
      userEmail={user?.email}
    />
  );
}
