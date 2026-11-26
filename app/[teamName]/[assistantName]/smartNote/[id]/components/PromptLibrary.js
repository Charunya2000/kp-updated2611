import { Box, List, ListItem, ListItemText, ListSubheader, Tooltip, Typography } from '@mui/material';

const PromptLibrary = ({ onPromptSelected, prompts = [], isCase360 = false, mrnInput = '', epdsEnabled = false }) => {
  const mrnMissing = isCase360 && !mrnInput.trim() && !epdsEnabled;
  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', padding: 0, position: 'relative' }}>
      {mrnMissing && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'form.background',
          backdropFilter: 'blur(2px)',
          borderRadius: 1,
          px: 3,
          textAlign: 'center',
        }}>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
            Please enter a Medical Record Number in the input box above to use prompts.
          </Typography>
        </Box>
      )}
      <PinnedSubheaderList prompts={prompts} onPromptSelected={mrnMissing ? () => { } : onPromptSelected} isCase360={isCase360} mrnMissing={mrnMissing} />
    </Box>
  );
}

export default PromptLibrary;


const PinnedSubheaderList = ({ prompts, onPromptSelected, isCase360 = false, mrnMissing = false }) => {
  // Transform MongoDB data to match the expected format
  const transformedPrompts = prompts.map(prompt => ({
    id: prompt.id,
    title: prompt.name,
    prompt: prompt.details,
    section: prompt.category,
  }));

  const sections = transformedPrompts.reduce((promptList, prompt) => {
    if (!promptList[prompt.section]) {
      promptList[prompt.section] = [];
    }
    promptList[prompt.section].push(prompt);
    return promptList;
  }, {});

  const sectionNames = Object.keys(sections);

  return (
    <Box
      sx={{
        width: '100%',
        position: 'relative',
        overflow: 'auto',
        '& ul': { padding: 0 },
      }}
    >
      {sectionNames.map((section, index) => (
        <List key={`section-${index}`}>
          <ListSubheader sx={{ color: 'text.primary' }}>{section}</ListSubheader>
          {sections[section].map((prompt) => (
            <Tooltip key={prompt.id} title={prompt.prompt} placement="left" arrow>
              <ListItem onClick={() => onPromptSelected(prompt)} button="true" sx={{ cursor: mrnMissing ? 'default' : 'pointer', opacity: mrnMissing ? 0.4 : 1 }}>
                <ListItemText primary={prompt.title} />
              </ListItem>
            </Tooltip>
          ))}
        </List>
      ))}
    </Box>
  );
}