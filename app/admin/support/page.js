import { getServerUser } from "@/app/lib/supabase-server";
import SupportClient from "./SupportClient";
import { redirect } from "next/navigation";

export const metadata = { title: "Admin — Support Mail" };

export default async function AdminSupportPage() {
  const { user } = await getServerUser();
  if (!user) redirect("/admin/login");

  return <SupportClient />;
}
