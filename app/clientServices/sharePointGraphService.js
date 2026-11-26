'use client'

export const getAccessibleSharePointSites = async () => {
  let sites = [];
  try {
    const result = await fetch(`/api/sharepointGraph/sites`, {
      headers: {
        'Accept': 'application/json',
      }
    });

    sites = await result.json();
  } catch (error) {
    console.error(error);
  }

  return sites;
}

export const getFolderContents = async (site, folder, { useEnvSwitch = false } = {}) => {
  const query = new URLSearchParams({ site, folder });
  if (useEnvSwitch) query.set('useEnvSwitch', 'true');
  const result = await fetch(`/api/sharepointGraph/folder?${query.toString()}`)

  return await result.json();
}

export const getDocumentLibraries = async (site, { useEnvSwitch = false } = {}) => {
  const query = new URLSearchParams({ site });
  if (useEnvSwitch) query.set('useEnvSwitch', 'true');
  const result = await fetch(`/api/sharepointGraph/library?${query.toString()}`);
  return await result.json();
}
