import { isAppAdmin } from "@/app/services/applicationRoleService";
import { notFound } from 'next/navigation';
import UsageReport from "./UsageReport";

const UsageReportPage = async () => {
    const isAdmin = await isAppAdmin();

    if (!isAdmin) {
        notFound();
    }

    // Pass the deployment environment to the client so it can restrict
    const envName = process.env['envName'];

    // Render the UsageReport client component with the deployment env name.
    return <UsageReport envName={envName} />;
}

export default UsageReportPage;
