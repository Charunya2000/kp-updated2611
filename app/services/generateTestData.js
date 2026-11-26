'use server';

// filepath: /c:/Users/A257371/Documents/development/software/node/projects3/genai-portal-notebook/generateTestData.js
import { recordUserActive, recordSmartNoteCreated, recordUploadedDocument, recordWebURL, recordJiraIssue, recordAssistantPromptSubmitted, recordUserNoteAdded, recordSavedResponseAdded } from '../../app/services/statisticsService.js';
import { setProcessEnvironment } from '../../scripts/configActions.js';
import { connectToDatabase } from '../../db/connection.js'

const generateRandomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const generateTestData = async () => {
  setProcessEnvironment();
  const recordFunctions = [
    recordUserActive,
    recordSmartNoteCreated,
    recordUploadedDocument,
    recordWebURL,
    recordJiraIssue,
    recordAssistantPromptSubmitted,
    recordUserNoteAdded,
    recordSavedResponseAdded
  ];

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 2);
  const endDate = new Date();

  for (const recordFunction of recordFunctions) {
    for (let i = 0; i < 500; i++) {
      const randomDate = generateRandomDate(startDate, endDate);
      const nuid = `nuid-${Math.floor(Math.random() * 1000)}`;
      await recordFunction(nuid, randomDate, 'kpit-ai-portal-members', 'kp-smart-notes');
    }
  }
};

const deleteTestRecords = async () => {
  setProcessEnvironment();
  const db = await connectToDatabase();

  // Log the collection name and query for debugging
  const query = { type: 'Statistic', nuid: { $regex: '^nuid-' } };

  try {
    // Test the query with a find operation first
    const testResults = await db.collection('statistics').find(query).toArray();

    // Perform the delete operation
    const result = await db.collection('statistics').deleteMany(query);
  } catch (error) {
    console.error('Error deleting test records:', error);
  }
};

// deleteTestRecords().then(() => {
//   console.log('Test data deleted.');
//   process.exit(0);
// }).catch((error) => {
//   console.error('Error deleting test data:', error);
//   process.exit(1);
// });

generateTestData().then(() => {
  console.log('Test data generation complete.');
  process.exit(0);
}).catch((error) => {
  console.error('Error generating test data:', error);
  process.exit(1);
});
