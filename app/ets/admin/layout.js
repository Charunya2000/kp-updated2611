'use client';

import AdminLayout from "../../components/admin/AdminLayout";

export default function AdminLayoutWrapper({ children }) {
  return (
    <AdminLayout teamName="ets">
      {children}
    </AdminLayout>
  );
}
