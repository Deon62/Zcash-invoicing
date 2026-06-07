import { redirect } from "next/navigation";

// "Disclosure" is now step 2 of the unified Compliance page.
export default async function DisclosureRedirect({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { invoice } = await searchParams;
  redirect(`/compliance?tab=share${invoice ? `&invoice=${invoice}` : ""}`);
}
