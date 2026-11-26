'use server';

import { deleteAll } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';

export async function deleteAppDocuments(query) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  query.app = 'SmartNotes';
  await deleteAll(query); // must uncomment the function to use this
  return { result: 'success' };
}
