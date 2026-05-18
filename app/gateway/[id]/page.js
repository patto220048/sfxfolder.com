import { supabase } from "@/app/lib/supabase";
import ClientGateway from "./ClientGateway";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Download Gateway — SFXFolder",
  description: "Preparing your download...",
  robots: "noindex, nofollow", // Prevent bots from indexing the gateway page
};

async function getResource(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("resources")
    .select("id, name, file_name, file_format, file_size, category_id, slug, categories(name, slug)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function GatewayPage({ params }) {
  const { id } = await params;
  const resource = await getResource(id);

  if (!resource) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "10px" }}>Resource Not Found</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>The file you are trying to download does not exist or has been removed.</p>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary-color, #3b82f6)" }}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>
    );
  }

  return <ClientGateway resource={resource} />;
}
