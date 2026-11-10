import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getMyMemberships, requireUser } from "@/lib/auth-guards";

export default async function DashboardIndex() {
  await requireUser("/dashboard");
  const memberships = await getMyMemberships();
  if (memberships.length === 0) redirect("/dashboard/new-organization");
  const last = (await cookies()).get("active_org")?.value;
  const target = memberships.find((m) => m.organization.slug === last) ?? memberships[0];
  redirect(`/dashboard/${target.organization.slug}`);
}
