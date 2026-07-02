import { redirect } from "next/navigation";

// "Auditor" is now step 3 of the unified Compliance page.
export default function AuditorRedirect() {
  redirect("/compliance?tab=verify");
}
