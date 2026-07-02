import { redirect } from "next/navigation";

// A single pack's verification now opens inside the Compliance page (step 3).
export default async function AuditorPackRedirect({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const { packId } = await params;
  redirect(`/compliance?tab=verify&pack=${packId}`);
}
