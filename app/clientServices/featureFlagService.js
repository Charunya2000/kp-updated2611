// Get all feature flags
export const getAllFeatureFlags = async () => {
  try {
    const result = await fetch(`/api/admin/feature-flags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to fetch feature flags: ${result.status} ${errorText}` };
    }

    return await result.json();
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return { error: error.message };
  }
};

// Create a new feature flag
export const createFeatureFlag = async (flagData) => {
  try {
    const result = await fetch(`/api/admin/feature-flags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flagData),
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to create feature flag: ${result.status} ${errorText}` };
    }

    return await result.json();
  } catch (error) {
    console.error('Error creating feature flag:', error);
    return { error: error.message };
  }
};

// Update a feature flag by ID
export const updateFeatureFlag = async (id, flagData) => {
  try {
    const result = await fetch(`/api/admin/feature-flags/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flagData),
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to update feature flag: ${result.status} ${errorText}` };
    }

    return await result.json();
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return { error: error.message };
  }
};

// Delete a feature flag by ID
export const deleteFeatureFlag = async (id) => {
  try {
    const result = await fetch(`/api/admin/feature-flags/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to delete feature flag: ${result.status} ${errorText}` };
    }

    return await result.json();
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return { error: error.message };
  }
};
