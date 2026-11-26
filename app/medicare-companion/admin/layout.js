'use client';

import AdminLayout from "../../components/admin/AdminLayout";

export default function MedicareCompanionAdminLayout({ children }) {
    return (
        <AdminLayout teamName="medicare-companion">
            {children}
        </AdminLayout>
    );
}
