import { requireAdminCapability } from "@/lib/auth/server-session";
import { JobDetail } from "@/features/jobs/job-detail";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await requireAdminCapability("imports:read");
  const { jobId } = await params;
  return <JobDetail jobId={jobId} />;
}
