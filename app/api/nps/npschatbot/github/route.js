
export async function POST(req) {
    try{
  const { targetFile } = await req.json();

   const githubToken = '';
    const organization = 'HP-OPS';
    const repository = 'NPS2UIAutomation';
    const branch = 'master';
    //const targetFile = 'src/test/java'
    //const root='src/main/java/nps2NGPages'
      const root='src/test/java/CPQAutomation'

//    https://github.kp.org/HP-OPS/NPGUIAutomation/tree/master/src/test/java
    if (!githubToken) {
      throw new Error('GitHub access token not found in environment variables');
    }

    if (!targetFile) {
      throw new Error('No target file specified in state');
    }

    // Construct the GitHub API URL for getting the specific file
    const apiUrl = `https://github.kp.org/api/v3/repos/${organization}/${repository}/contents/${root}/${targetFile}?ref=${branch}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Node.js'
      }
    });
    const fileData = await response.json();

    // Get the file content if it's not too large
    let content = null;
    if (fileData.encoding === 'base64' && fileData.size < 1000000) { // 1MB limit
      content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    }

    // const githubResponse = await fetch(`http://localhost:3000/api/parsePOMFile`, {
    //       method: "POST",
    //       headers: { "Content-Type": "application/json" },
    //       body: JSON.stringify({javaContent:content})
    //     });
    // const fileRata = await githubResponse.json();
    //     console.log(fileRata)

  console.log(content)
     return Response.json({ success: true, results: content });
      } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }


}



