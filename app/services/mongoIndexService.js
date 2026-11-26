import { isDeepStrictEqual } from 'node:util';

function hasSameKey(actualKey, expectedKey) {
  return isDeepStrictEqual(Object.entries(actualKey || {}), Object.entries(expectedKey));
}

export async function createMongoCollectionWithIndexes(db, indexDefinitions) {
  const collectionName = indexDefinitions[0]?.collectionName;
  if (!collectionName || indexDefinitions.some((definition) => definition.collectionName !== collectionName)) {
    throw new Error('Index definitions must belong to one collection.');
  }

  const collections = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
  if (collections.length > 0) {
    for (const definition of indexDefinitions) {
      await applyMongoIndexDefinition(db, definition);
    }
    return { created: false };
  }

  const indexes = indexDefinitions.map((definition) => ({
    ...definition.options,
    name: definition.name,
    key: definition.key,
  }));
  if (!indexes.some((index) => hasSameKey(index.key, { _id: 1 }))) {
    indexes.unshift({ name: '_id_', key: { _id: 1 } });
  }

  await db.command({
    customAction: 'CreateCollection',
    collection: collectionName,
    indexes,
  });

  const storedIndexes = await db.collection(collectionName).listIndexes().toArray();
  for (const definition of indexDefinitions) {
    const stored = storedIndexes.find((index) => index.name === definition.name);
    if (!stored || !hasSameKey(stored.key, definition.key)
      || (!hasSameKey(stored.key, { _id: 1 }) && Boolean(stored.unique) !== Boolean(definition.options?.unique))) {
      throw new Error(`Collection was created, but index "${definition.name}" was not stored as requested. Verify the database provider's index support before loading data. The collection was not dropped.`);
    }
  }
  return { created: true };
}

export async function applyMongoIndexDefinition(db, indexDef) {
  const collection = db.collection(indexDef.collectionName);
  const indexes = await collection.listIndexes().toArray();
  const existing = indexes.find((index) => index.name === indexDef.name);
  const options = { ...indexDef.options, name: indexDef.name };

  if (existing && options.unique === true && existing.unique !== true
    && existing.name !== '_id_' && hasSameKey(existing.key, indexDef.key)) {
    const conflictingOption = Object.entries(indexDef.options).find(([option, value]) => (
      option !== 'unique' && option !== 'name' && !isDeepStrictEqual(existing[option], value)
    ));
    if (conflictingOption) {
      throw new Error(`Existing index "${indexDef.name}" has a different "${conflictingOption[0]}" option. No index was dropped or replaced.`);
    }

    try {
      await db.command({
        collMod: indexDef.collectionName,
        index: { name: indexDef.name, unique: true },
      });
    } catch (error) {
      throw new Error(`Existing index "${indexDef.name}" is not unique. Conversion to unique failed: ${error.message}. Resolve duplicate keys if present; if this database does not support collMod unique conversion, use a provider-supported index migration. No index was dropped.`);
    }
  } else {
    await collection.createIndex(indexDef.key, options);
  }

  const storedIndexes = await collection.listIndexes().toArray();
  const stored = storedIndexes.find((index) => index.name === indexDef.name);
  if (!stored || !hasSameKey(stored.key, indexDef.key)
    || (stored.name !== '_id_' && Boolean(stored.unique) !== Boolean(options.unique))) {
    throw new Error(`Index "${indexDef.name}" was not applied as requested: stored key or unique option does not match. Verify the database provider's index support.`);
  }
}