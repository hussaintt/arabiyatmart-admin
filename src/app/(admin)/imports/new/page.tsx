import { redirect } from "next/navigation";

// All data ingestion begins from the audited Import Center; there is no
// unguarded secondary creation page.
export default function NewImportPage() { redirect("/imports"); }
