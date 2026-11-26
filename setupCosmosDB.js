const { MongoClient } = require('mongodb');

const uri = process.env.COSMOS_DB_CONNECTION_STRING; // Replace with your Cosmos DB connection string
const client = new MongoClient(uri);

async function connectToCosmosDB() {
  try {
    await client.connect();
    console.log("Connected to Azure Cosmos DB!");
    return client.db('ontologyDB'); // Replace with your database name
  } catch (error) {
    console.error("Error connecting to Cosmos DB:", error);
    throw error;
  }
}

module.exports = connectToCosmosDB;
