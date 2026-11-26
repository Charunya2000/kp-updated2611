'use server';

import { NextResponse } from 'next/server';
import { getApplicationStatistics, getDistinctNuids } from '@services/statisticsService.js';
import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.LLM_STATISTICS_VIEW)(getHandler);

async function getHandler(request, { params }) {
  try {
    const { teamName } = await params;

    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    const flavor = searchParams.get('flavor');
    const dateRange = searchParams.get('dateRange');
    const assistantName = searchParams.get('assistantName');
    const nuid = searchParams.get('nuid');
    const listNuids = searchParams.get('listNuids');

    if (listNuids === 'true') {
      const nuids = await getDistinctNuids(teamName, assistantName || null);
      return NextResponse.json(nuids);
    }

    const statistics = await getApplicationStatistics({
      flavor,
      dateRange,
      teamName,
      assistantName,
      category: 'llm-consumption',
      nuid
    });

    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.error();
  }
}