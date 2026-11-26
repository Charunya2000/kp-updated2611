'use client';

import React, { useState } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

const ROM_PROJECT_OPTIONS = [
  { id: '6e19e18b31a243bea8fa5055560fa0f6', name: 'POS Tier1 Deductible Phase2' },
  { id: 'ab21b9158e3a4ca7b37c6f7e31ffcf0f', name: 'Medicare Advantage OTC Card Modernization' },
  { id: '46ab08c33296481eac17fa6c31500286', name: 'HI_POS_Expansion' },
  { id: '5a77accc73704e8ca4f8a3ea2a9d3afa', name: 'Medicare Supplemental Benefits 2026 OTC/HFC' },
  { id: '01c5a56a28f44cb7808ffe16b77652ba', name: 'Rewards and Incentives Program' },
  { id: '581530a45c0141ef999d98960439b0c2', name: 'IT Costs Estimation for KPWA, NCAL, and SCAL Regions' },
  { id: '3fbe9e2fcaf44383a30b371ff27fa437', name: 'Integration of Data iSight into Claims Pricing Hierarchy' },
  { id: 'd99232139b6341c4a116f6e55eacfdd1', name: 'HI Added Choice Network Expansion' },
  { id: '267484bec6ea40369b93ed2421da829c', name: 'MAS Choice Redesign - Phase 1' },
  { id: '101cc6ad3069478cada2876dc5a7445a', name: 'Medicare DSNP 2026' },
  { id: '56d25e9ac843400884775924c7c46266', name: 'CO Medicaid OCI Change' },
  { id: '3b982d6835e64af48ff6a9dd3324745c', name: 'Medicare PPO Expansion' },
  { id: '161e6f2a51eb400c9de24cc22ccc054a', name: 'Medicare Part B Premium Reduction' },
  { id: '35ae4833a2534bc5b6b5872e69a99af8', name: 'Medicare PPO Expansion' },
  { id: 'd37ef7f518a547b19d2f6bc77b3075c3', name: 'National Dental Enhancements' },
  { id: '81f21c08fa674cd4a5834a6579bd8958', name: 'POS_Tier1_Deductible' },
  { id: '09dbde9c02684d498dfd826866e4de78', name: 'HRA Garner' },
  { id: 'f2b233fe6149440f99ac0f4579750f01', name: 'ROM-2023-001' },
  { id: 'fbc171c2c0914e028e489bc58bef80ec', name: 'Re-Launch Self Funded Program - CO' },
  { id: 'e9ff1806ded94906831a7503f9c15117', name: 'Standalone Implementation for Dental Service' },
  { id: 'bc05ed45bbc847b4a7c3517242225d0c', name: 'Rewards and Incentives Program for KP Members' },
  { id: '1c72927e7922417caae547768f4bc74e', name: '2026 Medicare Supplemental Implementation' },
  { id: '79c0eb01a49d452b953560cd60bdf81c', name: 'HI POS Expansion 2025' },
  { id: 'ece3e41991714a2199c88be0c2989e44', name: 'National Dental Vendor Implementation for Medicare' },
  { id: 'ba12ba84e41744eda249b0b7fdb37ef1', name: 'POS Tier1 Deductible' },
  { id: '5d3554f3063e42d0a27f794eae8eba84', name: 'Fitness Allowance Optum' },
  { id: 'e8929a88136d4f9ea988402d231fc795', name: 'Industry Specific Program – First Responder' },
  { id: 'c851948d0bf243d6bb8c3f2fa5965787', name: 'Level Funded Expansion' },
  { id: 'bda88806fc1f4c19b450a2b72abdf7cd', name: 'Medicare PPO Expansion' },
  { id: 'c10613c7d5414f1697e1cc67c4609eb9', name: 'HI POS Expansion' },
  { id: '97160af249c140adaff6d94c87bf4484', name: 'New CDHC Vendor Implementatio' },
  { id: 'b87ce38bfb9149f5b76f2c950077dd0d', name: 'OTC Enhancement' },
  { id: '9a1f0e6450e9467eb4f5dc89e7e246cc', name: 'Level Funded Program-KPWA' },
  { id: 'ec91692641f3497792d7ea9d07a35d50', name: 'OTC-Medicare-Modernization' },
];

const ProjectInputForm = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    project_title: '',
    project_description: '',
    confidence_level: 10,
    constraints: '',
    additional: '',
    in_scope: '',
    out_scope: '',
    risks: '',
    markets: [],
    selected_project_ids: [],
    selected_project_titles: [],
    files: []
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.project_title.trim()) {
      newErrors.project_title = 'Project title is required';
    }
    
    if (!formData.project_description.trim()) {
      newErrors.project_description = 'Project description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleSelectChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const MAX_FILE_SIZE_MB = 30;

  const onDrop = (acceptedFiles) => {
    const validFiles = acceptedFiles.filter(file => {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['pptx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'].includes(extension)) return false;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setErrors(prev => ({ ...prev, files: `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit` }));
        setTimeout(() => setErrors(prev => ({ ...prev, files: null })), 5000);
        return false;
      }
      return true;
    });

    if (validFiles.length !== acceptedFiles.length && !acceptedFiles.some(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)) {
      setErrors(prev => ({
        ...prev,
        files: 'Only PPTX, XLSX, XLS and image files (PNG, JPG, JPEG) are allowed'
      }));
      setTimeout(() => {
        setErrors(prev => ({
          ...prev,
          files: null
        }));
      }, 5000);
    }

    setFormData(prev => ({
      ...prev,
      files: [...prev.files, ...validFiles]
    }));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    multiple: true,
    disabled: isLoading
  });

  const handleRemoveFile = (fileToRemove) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter(file => file !== fileToRemove)
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log('📝 ProjectInputForm: Form submission started');
    
    if (validateForm()) {
      // For markets, make sure we're submitting a clean string without extra spaces
      const marketsString = formData.markets.length > 0 ? formData.markets.join(',') : '';
      
      const submitData = {
        ...formData,
        markets: marketsString,
        selected_project_ids: formData.selected_project_ids || [],
        selected_project_titles: formData.selected_project_titles || [],
      };
      
      console.log('✅ ProjectInputForm: Form validation passed');
      console.log('📤 ProjectInputForm: Submitting data:', {
        project_title: submitData.project_title,
        project_description: submitData.project_description?.substring(0, 100) + '...',
        confidence_level: submitData.confidence_level,
        files_count: submitData.files ? submitData.files.length : 0,
        files_names: submitData.files ? submitData.files.map(f => f.name) : []
      });
      
      onSubmit(submitData);
    } else {
      console.log('❌ ProjectInputForm: Form validation failed');
    }
  };

  return (
    <Box sx={{ 
      width: '100%',
      bgcolor: '#f5f5f5',
      pb: 4,
      height: 'auto',
      overflowY: 'visible'
    }}>
      {/* Main Content Container - Fully Scrollable */}
      <Box sx={{ 
        px: 3, 
        pt: 3,
        width: '100%',
        overflowY: 'visible'
      }}>
        <form id="rom-form" onSubmit={handleSubmit} style={{ height: 'auto', overflow: 'visible' }}>
          <Box sx={{ 
            maxWidth: 1000, 
            mx: 'auto',
            width: '100%',
            height: 'auto',
            overflow: 'visible'
          }}>
            
            {/* Essential Project Information */}
            <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
              <Typography variant="h5" sx={{ mb: 4, color: 'primary.main', fontWeight: 'bold', borderBottom: '2px solid', borderColor: 'primary.main', pb: 2 }}>
                Project Overview
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  fullWidth
                  label="Project Title"
                  required
                  value={formData.project_title}
                  onChange={handleInputChange('project_title')}
                  error={!!errors.project_title}
                  helperText={errors.project_title}
                  disabled={isLoading}
                  variant="outlined"
                  size="medium"
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      backgroundColor: 'white',
                      fontSize: '1.1rem',
                      '&:hover': { backgroundColor: '#fafafa' }
                    }
                  }}
                />

                <TextField
                  fullWidth
                  label="Project Description"
                  required
                  multiline
                  rows={6}
                  value={formData.project_description}
                  onChange={handleInputChange('project_description')}
                  error={!!errors.project_description}
                  helperText={errors.project_description}
                  disabled={isLoading}
                  variant="outlined"
                  placeholder="Describe your project in detail, including objectives, scope, and expected outcomes..."
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      backgroundColor: 'white',
                      fontSize: '1rem',
                      '&:hover': { backgroundColor: '#fafafa' }
                    }
                  }}
                />

                {/* Confidence Level - Moved right after Project Description */}
                <FormControl fullWidth size="medium">
                  <InputLabel>Confidence Level</InputLabel>
                  <Select
                    value={formData.confidence_level}
                    label="Confidence Level"
                    onChange={handleSelectChange('confidence_level')}
                    disabled={isLoading}
                    sx={{ 
                      backgroundColor: 'white',
                      fontSize: '1rem'
                    }}
                  >
                    <MenuItem value={10}>10%</MenuItem>
                    <MenuItem value={25}>25%</MenuItem>
                    <MenuItem value={50}>50%</MenuItem>
                    <MenuItem value={75}>75%</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Paper>

            {/* Optional Project Details - Container */}
            <Paper elevation={2} sx={{ mb: 4 }}>
            
              {/* Optional Details Fields */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'primary.50' }}>
                  <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                    📋 Optional Project Details
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField
                      fullWidth
                      label="In Scope"
                      multiline
                      rows={4}
                      value={formData.in_scope}
                      onChange={handleInputChange('in_scope')}
                      disabled={isLoading}
                      placeholder="Features, functionality, and deliverables included in this project..."
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          backgroundColor: 'white',
                          fontSize: '1rem',
                          '&:hover': { backgroundColor: '#fafafa' }
                        }
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Out of Scope"
                      multiline
                      rows={3}
                      value={formData.out_scope}
                      onChange={handleInputChange('out_scope')}
                      disabled={isLoading}
                      placeholder="What is explicitly excluded from this project..."
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          backgroundColor: 'white',
                          fontSize: '1rem',
                          '&:hover': { backgroundColor: '#fafafa' }
                        }
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Constraints"
                      multiline
                      rows={3}
                      value={formData.constraints}
                      onChange={handleInputChange('constraints')}
                      disabled={isLoading}
                      placeholder="Budget, time, resource, or technical constraints..."
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          backgroundColor: 'white',
                          fontSize: '1rem',
                          '&:hover': { backgroundColor: '#fafafa' }
                        }
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Additional Information"
                      multiline
                      rows={3}
                      value={formData.additional}
                      onChange={handleInputChange('additional')}
                      disabled={isLoading}
                      placeholder="Any additional context, stakeholder requirements, or special considerations..."
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          backgroundColor: 'white',
                          fontSize: '1rem',
                          '&:hover': { backgroundColor: '#fafafa' }
                        }
                      }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Target Markets"
                      multiline
                      rows={3}
                      value={formData.markets.join(', ')}
                      onChange={(e) => {
                        // Convert comma-separated string to array
                        const marketsArray = e.target.value
                          .split(',')
                          .map(item => item.trim())
                          .filter(item => item.length > 0);
                        setFormData(prev => ({
                          ...prev,
                          markets: marketsArray
                        }));
                      }}
                      disabled={isLoading}
                      placeholder="List target markets separated by commas (e.g., Healthcare, Finance, Education)"
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          backgroundColor: 'white',
                          fontSize: '1rem',
                          '&:hover': { backgroundColor: '#fafafa' }
                        }
                      }}
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Paper>

            {/* Optional Knowledge Base Selection */}
            <Paper elevation={2} sx={{ mb: 3, p: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
                Optional Knowledge Base Selection
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                Select up to 3 ROMs to use directly. If selected, semantic search is bypassed.
              </Alert>

              <Autocomplete
                multiple
                options={ROM_PROJECT_OPTIONS}
                value={ROM_PROJECT_OPTIONS.filter(option =>
                  (formData.selected_project_ids || []).includes(option.id)
                )}
                onChange={(_, selectedOptions) => {
                  const trimmedOptions = (selectedOptions || []).slice(0, 3);
                  const selectedIds = trimmedOptions.map(option => option.id);
                  const selectedTitles = trimmedOptions.map(option => option.name);
                  setFormData(prev => ({
                    ...prev,
                    selected_project_ids: selectedIds,
                    selected_project_titles: selectedTitles,
                  }));
                }}
                getOptionLabel={(option) => option?.name || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterSelectedOptions
                disabled={isLoading}
                renderOption={(props, option) => {
                  const { key: _muiKey, ...optionProps } = props;
                  return (
                    <li {...optionProps} key={option.id}>
                      {option.name}
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select ROM Projects"
                    placeholder="Type to search project names"
                    helperText="Maximum 3 projects"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.name}
                      size="small"
                    />
                  ))
                }
              />
            </Paper>

            {/* File Upload Section - Non-Collapsible */}
            <Paper elevation={2} sx={{ mb: 3, p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'primary.200', pb: 2 }}>
                📎 Supporting Documents (Optional)
              </Typography>
              <Box
                {...getRootProps()}
                    sx={{
                      border: '2px dashed',
                      borderColor: isDragActive ? 'primary.main' : 'grey.300',
                      borderRadius: 2,
                      p: 4,
                      textAlign: 'center',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      bgcolor: isDragActive ? 'action.hover' : 'white',
                      minHeight: 120,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: isLoading ? 'white' : 'action.hover',
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    <input {...getInputProps()} />
                    <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="body1" gutterBottom sx={{ fontWeight: 500 }}>
                      {isDragActive ? 'Drop files here...' : 'Drop files or click to browse'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      PPTX, XLSX, XLS, PNG, JPG, JPEG files • Max 30MB each
                    </Typography>
                  </Box>

                  {errors.files && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {errors.files}
                    </Alert>
                  )}

                  {formData.files.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Uploaded Files ({formData.files.length}):
                      </Typography>
                      <Box sx={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        maxHeight: 200,
                        overflow: 'auto',
                        p: 2,
                        bgcolor: '#f8f9fa',
                        borderRadius: 2
                      }}>
                        {formData.files.map((file, index) => (
                          <Box
                            key={index}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.5,
                              bgcolor: 'white',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'grey.200'
                            }}
                          >
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                                {file.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </Typography>
                            </Box>
                            <IconButton
                              onClick={() => handleRemoveFile(file)}
                              size="small"
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
            </Paper>

            {/* Submit Button - Compact and Accessible */}
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading}
                startIcon={!isLoading && <DescriptionIcon />}
                sx={{
                  minWidth: 280,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  boxShadow: 3,
                  '&:hover': {
                    boxShadow: 6,
                    transform: 'translateY(-1px)'
                  },
                  '&:disabled': {
                    boxShadow: 1
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {isLoading ? 'Processing ROM Request...' : 'Generate ROM Estimate'}
              </Button>
            </Box>
          </Box>


        </form>
      </Box>


    </Box>

  );
};

export default ProjectInputForm;