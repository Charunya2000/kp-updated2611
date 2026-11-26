import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Box, InputAdornment, TextField, Tooltip, Typography } from '@mui/material';

const MedCompanionMrnInput = ({ mrnInput, setMrnInput }) => {
  const normalizedMrn = mrnInput.trim();
  const isValidMrn = /^\d{2}-\d{9}$/.test(normalizedMrn);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mb: 1,
        mx: 2,
        backgroundColor: 'card.body.deep',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          flex: 1,
          minWidth: 0,
          borderRadius: 0.5,
          bgcolor: 'transparency.05',
          px: 1.25,
          py: 0.5
        }}
      >

        <TextField
          variant="outlined"
          placeholder="10-123456789"
          value={mrnInput}
          onChange={(e) => setMrnInput(e.target.value)}
          size="small"
          // slotProps={{
          //   input: {
          //     endAdornment: (
          //       <InputAdornment position="end">
          //         <Box
          //           aria-label={isValidMrn ? 'MRN is valid' : 'MRN is invalid'}
          //           sx={{
          //             width: 24,
          //             height: 24,
          //             borderRadius: '50%',
          //             display: 'flex',
          //             alignItems: 'center',
          //             justifyContent: 'center',
          //             bgcolor: isValidMrn ? '#1a8f46' : '#f0b429',
          //             color: isValidMrn ? '#ffffff' : '#1f1a00',
          //           }}
          //         >
          //           {isValidMrn ? <CheckIcon sx={{ fontSize: 18 }} /> : <CloseIcon sx={{ fontSize: 18 }} />}
          //         </Box>
          //       </InputAdornment>
          //     ),
          //   },
          // }}
          sx={{ flexGrow: 1, maxWidth: '200px' }}
        ></TextField>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            pl: 2,
            minWidth: 0,
            pt: { xs: 0.75, md: 0 },
          }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              lineHeight: 1.2,
              fontSize: { xs: '0.875rem' },
              whiteSpace: { xs: 'normal', md: 'nowrap' },
            }}
          >
            Enter an MRN or MBI to get responses with member specific data
          </Typography>
          <Tooltip
            arrow
            title="Without an MRN or MBI, responses will be generically pulled from DLP data. Entering an MRN or MBI here ensures you get information specific to this member."
          >
            <Box
              aria-label="More information about MRN/MBI entry"
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                color: 'text.secondary',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
                flexShrink: 0,
              }}
            >
              <HelpOutlineIcon sx={{ fontSize: 14 }} />
            </Box>
          </Tooltip>
        </Box>
      </Box>

    </Box>
  );
};

export default MedCompanionMrnInput;