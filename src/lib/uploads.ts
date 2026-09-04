import { adminFetch } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";

export type AdminUploadPurpose = Parameters<typeof adminPaths.upload>[0];
export type UploadedFile = {
  publicId: string;
  url: string | null;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  status: string;
};

export async function uploadAdminFile(file: File, purpose: AdminUploadPurpose) {
  const body = new FormData();
  body.append("file", file);
  return adminFetch<UploadedFile>(adminPaths.upload(purpose), { method: "POST", body });
}
