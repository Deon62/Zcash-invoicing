import { AppShell } from "@/components/AppShell";

/** Layout for the authenticated app — wraps every dashboard route in the
 *  sidebar shell. The marketing landing page at "/" sits outside this group. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
