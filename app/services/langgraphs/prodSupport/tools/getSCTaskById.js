import sql from 'mssql';

import {
  DEFAULT_ASSIGNMENT_GROUP,
  SCTASK_SELECT_FIELDS
} from '@/app/services/langgraphs/prodSupport/tools/getSCTasksByKeyword';
import { getSNOWRecords } from '@/app/services/smdwSqlDatabaseService';

export async function getSCTaskById({ scTaskId } = {}) {
  const normalizedScTaskId = String(scTaskId ?? '').trim();

  if (!normalizedScTaskId) {
    throw new Error('scTaskId is required.');
  }

  const query = `
    SELECT TOP (1)
      ${SCTASK_SELECT_FIELDS.join(', ')}
    FROM dbo.SCTaskDetailHistory
    WHERE AssignmentGroup = @assignmentGroup
      AND ScTaskIDSource = @scTaskId
    ORDER BY OpenedAt DESC;
  `;

  const records = await getSNOWRecords({
    query,
    parameters: [
      { name: 'assignmentGroup', type: sql.NVarChar, value: DEFAULT_ASSIGNMENT_GROUP },
      { name: 'scTaskId', type: sql.NVarChar, value: normalizedScTaskId }
    ]
  });

  return records[0] || null;
}