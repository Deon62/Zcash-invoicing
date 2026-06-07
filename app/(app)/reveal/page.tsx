import { redirect } from "next/navigation";

// "The reveal" is now step 1 of the unified Compliance page.
export default function RevealRedirect() {
  redirect("/compliance?tab=privacy");
}
