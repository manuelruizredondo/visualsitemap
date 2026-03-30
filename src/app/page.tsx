import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";
import ProjectDashboard from "@/components/ProjectDashboard";

export default async function Home() {
  const user = await getUser();
  const allProjects = await listProjects();

  // Filter projects that belong to this user
  const projects = user
    ? allProjects.filter((p) => p.userId === user.id)
    : allProjects;

  return (
    <ProjectDashboard
      initialProjects={projects}
      userEmail={user?.email}
    />
  );
}
