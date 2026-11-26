'use client';

import { useParams } from "next/navigation";
import AdminLayout from "../../components/admin/AdminLayout";

export default function AdminLayoutWrapper({ children }) {
  const teamName = useParams()?.teamName;
  return (
    <AdminLayout teamName={teamName}>
      {children}
    </AdminLayout>
  );
}
