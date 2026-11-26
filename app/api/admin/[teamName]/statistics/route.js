'use server';

import { NextResponse } from 'next/server';
import { getStatistics, getDistinctNuids, getDistinctVariantCategories } from '@services/statisticsService.js';
import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from "@/app/config/permissions";

export const GET = withTeamPermissionGuard(PERMISSIONS.STATISTICS_VIEW)(getHandler);

async function getHandler(request, { params }) {
  try {
    const { teamName } = await params;

    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    const flavor = searchParams.get('flavor');
    const dateRange = searchParams.get('dateRange');
    const assistantName = searchParams.get('assistantName');
    const nuid = searchParams.get('nuid');
    const variantCategory = searchParams.get('variantCategory');
    const listNuids = searchParams.get('listNuids');
    const listVariantCategories = searchParams.get('listVariantCategories');

    if (listNuids === 'true') {
      const nuids = await getDistinctNuids(teamName, assistantName || null);
      return NextResponse.json(nuids);
    }

    if (listVariantCategories === 'true') {
      const categories = await getDistinctVariantCategories(teamName, assistantName || null, nuid || null);
      return NextResponse.json(categories);
    }

    const statistics = await getStatistics(flavor, dateRange, teamName, assistantName, nuid, variantCategory || null);

    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.error();
  }
}