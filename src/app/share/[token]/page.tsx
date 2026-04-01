import { notFound } from "next/navigation";
import { getProjectByShareToken } from "@/lib/projects";
import ShareView from "@/components/ShareView";

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const project = await getProjectByShareToken(token);
  if (!project) notFound();

  return <ShareView project={project} />;
}
