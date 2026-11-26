import { Box } from "@mui/material";
import FullCompare from "./FullCompare";

export const dynamic = 'force-dynamic';

const Page = async () => {
  // const smartNote = await cloneSmartNoteFromTemplate('cac-control-report');

  return (
    <Box id='ComparePage' sx={{ overflow: 'auto', height: '100%', position: 'relative' }}>
      <FullCompare envName={process.env.envName} />
      {/* <FloatingAssistantContainer smartNoteId={smartNote.id} /> */}
    </Box>
  );
}

export default Page;

