import { setProcessEnvironment } from '../scripts/configActions.js';
import { connectToDatabase } from '../db/connection.js';

const updateMedicaidIndex = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const designIndexQuery = { app: 'SmartNotes', type: 'DesignIndex', indexName: 'medicaid-001' };
  console.log(`designIndexes count: ${await db.collection('user_collection').countDocuments(designIndexQuery)}`);
  // const designIndexes = await db.collection('user_collection').find(designIndexQuery);
  // const designIndexesArray = await designIndexes.toArray();
  // for (const designIndex of designIndexesArray) {
  //   delete designIndex._id;
  //   designIndex.indexName = 'medicaid-002';
  //   designIndex.updatedAt = new Date();
  //   await db.collection('user_collection').updateOne(
  //     {
  //       id: designIndex.id,
  //       parentId: designIndex.parentId,
  //       type: designIndex.type,
  //       nuid: designIndex.nuid
  //     },
  //     { $set: designIndex }
  //   );
  // }
};

const main = async () => {
  await updateMedicaidIndex();
  process.exit(0);
};

main().catch(err => {
  console.error('Error executing main function:', err);
  process.exit(1);
});