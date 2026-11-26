'use server';

export const getMetadataFromGitHubNode2 = async ({ state }) => {
  try {
    const githubToken = process.env.GITHUB_ACCESS_TOKEN;
    const organization = state.organization || 'default-org';
    const repository = state.repository || 'default-repo';
    const branch = state.branch || 'main';
    const targetFile = state.targetFile;

    if (!githubToken) {
      throw new Error('GitHub access token not found in environment variables');
    }

    if (!targetFile) {
      throw new Error('No target file specified in state');
    }

    // Construct the GitHub API URL for getting the specific file
    const apiUrl = `https://api.github.com/repos/${organization}/${repository}/contents/${targetFile}?ref=${branch}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Node.js'
      }
    });

    if (response.status === 404) {
      return {
        ...state,
        githubMetadata: {
          organization,
          repository,
          branch,
          fileFound: false,
          message: `File '${targetFile}' not found in repository`,
          timestamp: new Date().toISOString()
        },
        searchSuccess: false
      };
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const fileData = await response.json();

    // Get the file content if it's not too large
    let content = null;
    if (fileData.encoding === 'base64' && fileData.size < 1000000) { // 1MB limit
      content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    }

    return {
      ...state,
      githubMetadata: {
        organization,
        repository,
        branch,
        fileFound: true,
        file: {
          name: fileData.name,
          path: fileData.path,
          size: fileData.size,
          url: fileData.html_url,
          download_url: fileData.download_url,
          content: content,
          sha: fileData.sha
        },
        timestamp: new Date().toISOString()
      },
      searchSuccess: true
    };

  } catch (error) {
    console.error('Error fetching GitHub metadata:', error);
    return {
      ...state,
      githubMetadata: {
        organization,
        repository,
        branch,
        fileFound: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      searchSuccess: false
    };
  }
};
