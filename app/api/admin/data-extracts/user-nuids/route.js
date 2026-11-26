import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { getUserDetailNuidsCsv } from '@/app/services/dataExtractsService';

export const GET = await withAppAdminGuard(getHandler);

async function getHandler() {
  try {
    const { csv, nuidCount } = await getUserDetailNuidsCsv();

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'exportUserDetailNuids',
        detail: { nuidCount },
      },
    }));

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="user-nuids.csv"',
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'exportUserDetailNuidsError',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json(
      { error: error.message || 'Failed to export user NUIDs.' },
      { status: 500 }
    );
  }
}
