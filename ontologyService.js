const connectToCosmosDB = require('./setupCosmosDB');

async function createEntity(collectionName, entity) {
  const db = await connectToCosmosDB();
  const collection = db.collection(collectionName);

  // Validate entity type
  const validTypes = ['Basic', 'Function', 'Interface', 'Data'];
  if (!validTypes.includes(entity.type)) {
    throw new Error(`Invalid type. Supported types are: ${validTypes.join(', ')}`);
  }

  // If type is 'Function', ensure a functionName is provided
  if (entity.type === 'Function' && !entity.functionName) {
    throw new Error("Function type requires a 'functionName' property.");
  }

  const result = await collection.insertOne({
    name: entity.name,
    description: entity.description,
    parentId: entity.parentId,
    type: entity.type,
    functionName: entity.functionName || null, // Store function name if type is 'Function'
  });
  return result;
}

async function getEntity(collectionName, query) {
  const db = await connectToCosmosDB();
  const collection = db.collection(collectionName);
  const result = await collection.findOne(query);
  return result;
}

async function updateEntity(collectionName, query, update) {
  const db = await connectToCosmosDB();
  const collection = db.collection(collectionName);

  // Validate type if being updated
  if (update.type) {
    const validTypes = ['Basic', 'Function', 'Interface', 'Data'];
    if (!validTypes.includes(update.type)) {
      throw new Error(`Invalid type. Supported types are: ${validTypes.join(', ')}`);
    }
  }

  const result = await collection.updateOne(query, { $set: update });
  return result;
}

async function deleteEntity(collectionName, query) {
  const db = await connectToCosmosDB();
  const collection = db.collection(collectionName);
  const result = await collection.deleteOne(query);
  return result;
}

async function resolveFunction(functionName) {
  try {
    const functions = {
      exampleFunction: () => console.log("Example function executed!"),
      // Add more functions here
    };

    if (!functions[functionName]) {
      throw new Error(`Function '${functionName}' not found.`);
    }

    return functions[functionName];
  } catch (error) {
    console.error("Error resolving function:", error);
    throw error;
  }
}

module.exports = {
  createEntity,
  getEntity,
  updateEntity,
  deleteEntity,
  resolveFunction,
};
