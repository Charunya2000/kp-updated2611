'use server'
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import UserActivityFeed from "../UserActivityFeed";

export default async function Page() {
    const nuid = await getCurrentUserNuid();
    const access = await getTeamAccess('medicare-companion', nuid);
    if (!access?.has(PERMISSIONS.MEDICARE_COMPANION_AUDIT_VIEW)) {
        return redirect('/');
    }

    return <UserActivityFeed />;
}
