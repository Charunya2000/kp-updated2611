'use client';

export const getAllIndexNames = async () => {
  try {
    const result = await fetch(`/api/aiSearchIndex`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const results = await result.json();
    return results.indexes;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getFieldsNamesForIndex = async (indexName) => {
  try {
    const result = await fetch(`/api/aiSearchIndex/${indexName}/fields`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const results = await result.json();
    return results.fields;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export const getFieldMetadataForIndex = async (indexName) => {
  try {
    const result = await fetch(`/api/aiSearchIndex/${indexName}/fields/metadata`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const results = await result.json();
    return results.fields;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
