import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import {
  getKpifCompareResultConfig,
  saveKpifCompareResultConfig,
  getSqlColumnsForInvoiceType,
} from '@/app/services/kpifCompareResultConfigService';

export const GET = withTeamPermissionGuard(PERMISSIONS.KPIF_AUDIT_TEMPLATE_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.KPIF_AUDIT_TEMPLATE_MANAGE)(putHandler);

async function getHandler() {
  try {
    const config = await getKpifCompareResultConfig();

    const [caColumns, mocColumns] = await Promise.all([
      getSqlColumnsForInvoiceType('ca'),
      getSqlColumnsForInvoiceType('moc'),
    ]);

    return NextResponse.json({
      config: config || null,
      sqlColumns: { ca: caColumns, moc: mocColumns },
    }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: KpifCompareResultConfig',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req) {
  try {
    const config = await req.json();

    if (!config) {
      return NextResponse.json(
        { error: 'invalid config' },
        { status: 400 },
      );
    }

    for (const key of ['ca', 'moc']) {
      const invoiceConfig = config[key];
      if (!invoiceConfig.sqlFile || !invoiceConfig.worksheetName || !invoiceConfig.filenameLabel) {
        return NextResponse.json(
          { error: `Invoice type "${key}" is missing required fields (sqlFile, worksheetName, filenameLabel).` },
          { status: 400 },
        );
      }
      if (!Array.isArray(invoiceConfig.columnHeaders) || invoiceConfig.columnHeaders.length === 0) {
        return NextResponse.json(
          { error: `Invoice type "${key}" must have at least one column header.` },
          { status: 400 },
        );
      }
    }

    const saved = await saveKpifCompareResultConfig(config);
    if (!saved) {
      return NextResponse.json({ error: 'Failed to save config.' }, { status: 500 });
    }

    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'PUT: KpifCompareResultConfig',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
