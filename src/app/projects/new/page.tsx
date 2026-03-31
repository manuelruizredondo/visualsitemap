import CreateProjectForm from "@/components/CreateProjectForm";
import NewProjectPage from "@/components/NewProjectPage";
import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";

export default async function NewProjectRoute() {
  const user = await getUser();
  const allProjects = await listProjects();
  const projects = user
    ? allProjects.filter((p) => p.userId === user.id)
    : allProjects;

  return (
    <NewProjectPage projects={projects} userEmail={user?.email}>
      <CreateProjectForm />
    </NewProjectPage>
  );
}
