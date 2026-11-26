import { connectToDatabase } from '../db/connection.js';
import { setProcessEnvironment } from './configActions.js';
import { loadEnvLocal } from '../utils/envLoader.js';

async function getUniqueTypes() {
  try {
    const db = await connectToDatabase();

    console.log('Fetching unique type values...');

    // Use MongoDB aggregation to get distinct type values
    const uniqueTypes = await db.collection('user_collection').distinct('type');

    console.log('\n=== UNIQUE TYPE VALUES ===');
    console.log(`Found ${uniqueTypes.length} unique type(s):\n`);

    // Sort the types alphabetically for better readability
    uniqueTypes.sort().forEach((type, index) => {
      console.log(`${index + 1}. ${type}`);
    });

    console.log('\n=== SUMMARY ===');
    console.log(`Total unique types: ${uniqueTypes.length}`);

    // Optional: Get count of documents for each type
    console.log('\n=== DOCUMENT COUNTS BY TYPE ===');
    const pipeline = [
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];

    const typeCounts = await db.collection('user_collection').aggregate(pipeline).toArray();

    typeCounts.forEach(typeCount => {
      console.log(`${typeCount._id}: ${typeCount.count} documents`);
    });

    return uniqueTypes;

  } catch (error) {
    console.error('Error fetching unique types:', error);
    process.exit(1);
  } finally {
    // Close the connection
    process.exit(0);
  }
}

// Run the function
(async () => {
  console.log('Loading environment variables...');
  loadEnvLocal();

  console.log('Setting up environment configuration...');
  await setProcessEnvironment();

  console.log('Connecting to database...');
  await getUniqueTypes();
})();
