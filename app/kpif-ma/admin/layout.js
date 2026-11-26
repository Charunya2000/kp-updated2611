'use client';

import AdminLayout from "../../components/admin/AdminLayout";

export default function KpifMaAdminLayout({ children }) {
    return (
        <AdminLayout teamName="kpif-ma">
            {children}
        </AdminLayout>
    );
}
