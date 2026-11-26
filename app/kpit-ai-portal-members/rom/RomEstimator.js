'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Fade,
  Paper
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Search as SearchIcon,
  Inventory as ExtractIcon,
  RateReview as ReviewIcon,
  Check as CheckIcon,
  AutoAwesome as GenerateIcon,
  Summarize as SummaryIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  ErrorOutline as ErrorOutlineIcon
} from '@mui/icons-material';
import ProjectInputForm from './components/ProjectInputForm';
import ReviewSection from './components/ReviewSection';
import ResultDisplay from './components/ResultDisplay';
import StatusIndicator from './components/StatusIndicator';
import RomLandingPage from './components/RomLandingPage';
import FinalResultsDisplay from './components/FinalResultsDisplay';
import { parseK } from './utils/formatters';
// Import both real and mock API services
import { romApiService } from './clientServices/romApiService';
import { mockRomApiService } from './clientServices/mockRomApiService';

// Test mode toggle - set to false when backend is ready
const USE_MOCK_API = false; // Changed to false for real API testing
const apiService = USE_MOCK_API ? mockRomApiService : romApiService;

const WORKFLOW_STEPS = [
  { key: 'initiated', label: 'Project Input', icon: <DescriptionIcon /> },
  { key: 'input_processed', label: 'Input Processed', icon: <DescriptionIcon /> },
  { key: 'similar_rom_found', label: 'Similar ROMs Found', icon: <SearchIcon /> },
  { key: 'extracting_details_waiting', label: 'Extracting Details', icon: <ExtractIcon /> },
  { key: 'details_extracted', label: 'Details Ready', icon: <ExtractIcon /> },
  { key: 'details_review', label: 'Details Review', icon: <ReviewIcon /> },
  { key: 'detailed_rom_generated', label: 'ROM Generated', icon: <GenerateIcon /> },
  { key: 'rom_review', label: 'ROM Review', icon: <ReviewIcon /> },
  { key: 'final_summary_generated', label: 'Summary Generated', icon: <SummaryIcon /> },
  { key: 'completed', label: 'Completed', icon: <CheckIcon /> }
];

const RomEstimator = () => {
  // Cancellation ref — incremented on each reset to invalidate stale async callbacks
  const cancelGenRef = useRef(0);

  // View state management
  const [view, setView] = useState('landing'); // 'landing', 'form', 'workflow'

  const [sessionId, setSessionId] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('initiated');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [workflowError, setWorkflowError] = useState(null);
  
  // Data states
  const [processedInput, setProcessedInput] = useState(null);
  const [similarRom, setSimilarRom] = useState(null);
  const [extractedDetails, setExtractedDetails] = useState(null);
  const [detailedRom, setDetailedRom] = useState(null);
  const [summaryRom, setSummaryRom] = useState(null);
  const [finalWorkflowData, setFinalWorkflowData] = useState(null);
  
  // Review states
  const [reviewData, setReviewData] = useState(null);
  const [awaitingReview, setAwaitingReview] = useState(false);
  const [reviewType, setReviewType] = useState(null);

  const getCurrentStepIndex = () => {
    // Map backend statuses to display steps, including review phases
    let displayStatus = currentStatus;
    
    // Handle review phases specially - map to proper step keys
    if (awaitingReview && reviewType === 'details') {
      displayStatus = 'details_review'; // Maps to "Details Review" step
    } else if (awaitingReview && reviewType === 'detailed_rom') {
      displayStatus = 'rom_review'; // Maps to "ROM Review" step  
    }
    
    // Enhanced status mapping for better progression display
    const statusMap = {
      'initiated': 0,
      'input_processed': 1,
      'similar_rom_found': 2,
      'extracting_details_waiting': 3,
      'details_extracted': 4,
      'details_review': 5,
      'generating_rom': 6,
      'detailed_rom_generated': 7,
      'rom_review': 8,
      'generating_summary': 9,
      'final_summary_generated': 9,
      'completed': 9
    };
    
    return statusMap[displayStatus] || 0;
  };

  const handleError = (errorMessage) => {
    console.error('ROM Estimator Error:', errorMessage);
    // Map technical errors to user-friendly messages
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      setError('Unable to connect to the server. Please check your network connection and try again.');
    } else if (errorMessage.includes('Timed out')) {
      setError('Processing is taking longer than expected. Please click "Check Status" to see the latest progress, or start a new estimate.');
    } else if (errorMessage.includes('Expected SIMILAR_ROM_FOUND') || errorMessage.includes('Invalid state')) {
      setError('A temporary processing issue occurred. Please try submitting your project again.');
    } else if (errorMessage.includes('Background processing failed')) {
      setError('The server encountered an error while generating your estimate. Please start a new estimate or contact support.');
    } else {
      setError(errorMessage);
    }
    setIsLoading(false);
  };

  const handleSuccess = (message) => {
    setSuccess(message);
    setError(null);
    setTimeout(() => setSuccess(null), 5000);
  };

  const resetWorkflow = () => {
    cancelGenRef.current++; // Invalidate any in-flight async callbacks
    setSessionId(null);
    setProjectId(null);
    setCurrentStatus('initiated');
    setIsLoading(false);
    setProcessedInput(null);
    setSimilarRom(null);
    setExtractedDetails(null);
    setDetailedRom(null);
    setSummaryRom(null);
    setFinalWorkflowData(null);
    setReviewData(null);
    setAwaitingReview(false);
    setReviewType(null);
    setError(null);
    setSuccess(null);
    setWorkflowError(null);
    setView('landing'); // Return to landing page
  };
  
  // Handle starting a new estimate from landing page
  const startNewEstimate = () => {
    // Clear all stale state from any previous session before showing the form
    cancelGenRef.current++;
    setSessionId(null);
    setProjectId(null);
    setCurrentStatus('initiated');
    setIsLoading(false);
    setProcessedInput(null);
    setSimilarRom(null);
    setExtractedDetails(null);
    setDetailedRom(null);
    setSummaryRom(null);
    setFinalWorkflowData(null);
    setReviewData(null);
    setAwaitingReview(false);
    setReviewType(null);
    setError(null);
    setSuccess(null);
    setWorkflowError(null);
    setView('form');
  };

  // Handle initial project input submission
  const handleProjectSubmit = async (formData) => {
    console.log('🚀 ROM Estimator: Starting project submission - Following Postman flow exactly');
    console.log('📋 Form data received:', {
      project_title: formData.project_title,
      project_description: formData.project_description?.substring(0, 100) + '...',
      confidence_level: formData.confidence_level,
      files_count: formData.files ? formData.files.length : 0,
      api_service: USE_MOCK_API ? 'MOCK' : 'REAL'
    });
    
    setIsLoading(true);
    setError(null);
    setView('workflow'); // Switch to workflow view

    // Capture generation — if user cancels, cancelGenRef increments and we bail out
    const myGen = ++cancelGenRef.current;
    const isCancelled = () => cancelGenRef.current !== myGen;
    
    try {
      // Step 1: POST /process-input
      console.log('📡 Step 1: Process Input');
      const inputResponse = await apiService.processInput(formData);
      if (isCancelled()) return;
      
      console.log('📥 Step 1 Response:', inputResponse);

      // Always check for rich error_message first (covers both success:false and status:error)
      const effectiveStatus = inputResponse.status || inputResponse.workflow_state?.status;
      const errorMsg = inputResponse.error_message || inputResponse.workflow_state?.error_message;
      if (!inputResponse.success || effectiveStatus === 'error') {
        if (errorMsg) {
          console.warn('⚠️ Step 1: Backend returned error with message — showing graceful view');
          setSessionId(inputResponse.session_id);
          setProjectId(inputResponse.project_id || inputResponse.workflow_state?.project_id);
          setCurrentStatus('error');
          setWorkflowError(errorMsg);
          setIsLoading(false);
          return; // Stop workflow — don't proceed to step 2
        }
        throw new Error(inputResponse.message || 'Failed to process input');
      }

      console.log('✅ Step 1 Complete - Status:', inputResponse.status);
      const sessionIdFromInput = inputResponse.session_id;
      setSessionId(sessionIdFromInput);
      setProjectId(inputResponse.project_id);
      setCurrentStatus(inputResponse.status);
      setProcessedInput(inputResponse.processed_input);
      
      handleSuccess('Input processed — searching for similar projects...');

      // Step 2: POST /search-similar-rom/{sessionId}
      console.log('📡 Step 2: Search Similar ROM');
      const searchResponse = await apiService.searchSimilarRom(sessionIdFromInput);
      if (isCancelled()) return;

      if (!searchResponse.success) {
        throw new Error(searchResponse.message || 'Failed to search similar ROMs');
      }

      console.log('✅ Step 2 Complete - Status:', searchResponse.status);
      setCurrentStatus(searchResponse.status);
      setSimilarRom(searchResponse.similar_rom);

      // Soft-warning when no similar ROMs found — still continue to extraction
      if (searchResponse.warning_message) {
        console.warn('⚠️ Step 2 Warning:', searchResponse.warning_message);
        handleSuccess('No similar projects found — generating estimate from domain knowledge...');
      }
      
      // Step 3: Only proceed to extract-details if status is SIMILAR_ROM_FOUND
      if (searchResponse.status === 'similar_rom_found') {
        console.log('📡 Step 3: Extract Details (status is similar_rom_found)');
        
        // Backend self-heals: if it sees INPUT_PROCESSED it runs search inline.
        // A single call is sufficient; add a small delay for DB propagation.
        await new Promise(resolve => setTimeout(resolve, 1500));
        const extractResponse = await apiService.extractDetails(sessionIdFromInput);
        
        if (!extractResponse || (extractResponse.success === false && extractResponse.error)) {
          throw new Error(extractResponse?.message || extractResponse?.error || 'Failed to start detail extraction');
        }

        console.log('✅ Step 3 Complete - Status:', extractResponse.status);
        
        // Update status to show we're waiting for backend processing
        setCurrentStatus('extracting_details_waiting');
        handleSuccess('Extracting project details — this may take a minute...');
        
        // Step 4: Poll GET /status/{sessionId} until is_reviewable = true
        console.log('⏳ Step 4: Polling /status until is_reviewable...');
        const finalStatus = await apiService.pollUntilReady(sessionIdFromInput, {
          interval: 5000,
          timeout: 300000,
          onProgress: (statusResp) => {
            if (isCancelled()) return;
            console.log(`🔄 Poll status: ${statusResp.status} | processing: ${statusResp.is_processing} | reviewable: ${statusResp.is_reviewable}`);
            if (statusResp.status) setCurrentStatus(statusResp.status.toLowerCase());
          },
        });
        if (isCancelled()) return;

        console.log('✅ Step 4 Complete - ready for review. Final status:', finalStatus.status);

        // Step 5: GET /review/{sessionId} to fetch full review data
        console.log('📡 Step 5: Fetching review data...');
        const reviewResponse = await apiService.getReviewData(sessionIdFromInput);
        if (isCancelled()) return;

        if (reviewResponse.success) {
          setReviewData(reviewResponse);
          setCurrentStatus(reviewResponse.status);
          setAwaitingReview(true);
          setReviewType('details');

          if (reviewResponse.extracted_details) {
            setExtractedDetails(reviewResponse.extracted_details);
          }
          handleSuccess('Details extracted successfully - ready for review');
        } else {
          // Extraction failed (e.g. generic fallback) — show as error
          const errMsg = reviewResponse.error || reviewResponse.warning_message || 'Extraction produced insufficient details. Please try again with more project context.';
          console.warn('⚠️ Step 5: Review returned success=false:', errMsg);
          setCurrentStatus('error');
          setWorkflowError(errMsg);
        }
      } else {
        console.log('⚠️ Step 3 Skipped: Status is not similar_rom_found, got:', searchResponse.status);
        setCurrentStatus(searchResponse.status);
        handleSuccess('Similar project search complete.');
      }

    } catch (error) {
      console.error('❌ ROM Estimator Error in handleProjectSubmit:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      // If the error message is a structured backend error (multiline with bullets),
      // show it in the graceful workflow error view instead of the generic banner
      if (error.message && (error.message.includes('\n') || error.message.length > 200)) {
        setCurrentStatus('error');
        setWorkflowError(error.message);
      } else {
        handleError(error.message);
      }
    } finally {
      console.log('🏁 ROM Estimator: Submission process completed');
      setIsLoading(false);
    }
  };

  // Wait for background processing to complete via /status polling
  // (Legacy helper retained for backward compatibility — delegates to pollUntilReady)
  const waitForDetailsExtracted = async (sessionIdToUse, maxAttempts = 60, interval = 5000) => {
    console.log('⏳ Polling GET /status/{sessionId} via pollUntilReady...');
    
    const finalStatus = await apiService.pollUntilReady(sessionIdToUse, {
      interval,
      timeout: maxAttempts * interval,
      onProgress: (statusResp) => {
        console.log(`🔄 Poll status: ${statusResp.status} | processing: ${statusResp.is_processing} | reviewable: ${statusResp.is_reviewable}`);
        if (statusResp.status) setCurrentStatus(statusResp.status.toLowerCase());
      },
    });

    // Once polling completes, fetch full review data
    const reviewResponse = await apiService.getReviewData(sessionIdToUse);
    
    if (reviewResponse.success) {
      setReviewData(reviewResponse);
      setCurrentStatus(reviewResponse.status);
      setAwaitingReview(true);
      setReviewType('details');
      
      if (reviewResponse.extracted_details) {
        setExtractedDetails(reviewResponse.extracted_details);
      }
    }

    return finalStatus;
  };

  // Fetch review data
  const fetchReviewData = async (sessionIdToUse = sessionId) => {
    try {
      console.log('📊 Fetching review data for session:', sessionIdToUse);
      const reviewResponse = await apiService.getReviewData(sessionIdToUse);
      
      console.log('📥 Review response received:', reviewResponse);
      
      if (reviewResponse.success) {
        console.log('✅ Review data success - updating state');
        setReviewData(reviewResponse);
        setCurrentStatus(reviewResponse.status);
        setAwaitingReview(reviewResponse.awaiting_review);
        setReviewType(reviewResponse.review_type);
        
        console.log('🔄 Review state updated:', {
          status: reviewResponse.status,
          awaiting_review: reviewResponse.awaiting_review,
          review_type: reviewResponse.review_type
        });
        
        // Update data based on what's available
        if (reviewResponse.extracted_details) {
          setExtractedDetails(reviewResponse.extracted_details);
          console.log('📋 Extracted details updated');
        }
        if (reviewResponse.detailed_rom) {
          setDetailedRom(reviewResponse.detailed_rom);
          console.log('📄 Detailed ROM updated');
        }
        if (reviewResponse.summary_rom) {
          setSummaryRom(reviewResponse.summary_rom);
          console.log('📝 Summary ROM updated');
        }
      } else {
        console.warn('⚠️ Review data request not successful:', reviewResponse);
        // If there's an error message (e.g. fallback extraction), show error view
        if (reviewResponse.error) {
          setCurrentStatus('error');
          setWorkflowError(reviewResponse.error);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching review data:', error);
    }
  };

  // Fetch final workflow results and transition to completed view
  const fetchFinalResults = async () => {
    console.log('📡 Fetching final workflow state...');
    try {
      const finalState = await apiService.getFinalWorkflowState(sessionId);
      
      if (finalState.success && finalState.workflow_state) {
        setFinalWorkflowData(finalState.workflow_state);
        setSummaryRom(finalState.workflow_state.summary_rom);
        setDetailedRom(finalState.workflow_state.detailed_rom);
        setExtractedDetails(finalState.workflow_state.extracted_details);
        
        setCurrentStatus('final_summary_generated');
        setAwaitingReview(false);
        handleSuccess('Final summary generated successfully');
        
        setTimeout(() => {
          setCurrentStatus('completed');
          handleSuccess('ROM estimation complete — results ready for download.');
        }, 1500);
      } else {
        throw new Error('Invalid final state response');
      }
    } catch (finalError) {
      console.error('Failed to get final workflow state:', finalError);
      // Fallback: use available data
      const workflowData = {
        summary_rom: summaryRom,
        detailed_rom: detailedRom || reviewData?.detailed_rom,
        extracted_details: extractedDetails || reviewData?.extracted_details,
        input_data: { project_title: reviewData?.project_title || processedInput?.project_title || 'ROM Project' },
        project_id: projectId,
        session_id: sessionId,
        status: 'final_summary_generated'
      };
      setFinalWorkflowData(workflowData);
      setCurrentStatus('completed');
      setAwaitingReview(false);
      handleSuccess('ROM estimation completed using available data');
    }
  };

  // Handle review submission following Postman flow exactly
  const handleReviewSubmit = async (reviewSubmission) => {
    setIsLoading(true);
    setError(null);
    
    // Immediately hide the review view so the status/progress view is shown
    setAwaitingReview(false);
    
    try {
      console.log('📡 Review submission for status:', currentStatus, reviewSubmission);
      
      // Check actual backend status first — it may have raced ahead
      let actualStatus = currentStatus;
      try {
        const liveStatus = await apiService.getStatus(sessionId);
        if (liveStatus?.status) {
          actualStatus = liveStatus.status.toLowerCase();
          setCurrentStatus(actualStatus);
        }
      } catch (_) { /* use local status */ }

      const terminalStatuses = ['completed', 'final_summary_generated'];
      
      // If backend already reached a terminal state, skip review and fetch results
      if (terminalStatuses.includes(actualStatus)) {
        console.log('✅ Backend already at terminal status:', actualStatus, '— fetching results');
        await fetchFinalResults();
        return;
      }
      
      console.log('📡 POST /review/{sessionId}', reviewSubmission);
      
      // POST /review/{sessionId} with approval/feedback
      let reviewResponse;
      try {
        reviewResponse = await apiService.submitReview(sessionId, reviewSubmission);
      } catch (reviewErr) {
        // If backend raced past the reviewable state, treat as already completed
        if (reviewErr.message?.includes('FINAL_SUMMARY_GENERATED') || 
            reviewErr.message?.includes('COMPLETED') ||
            reviewErr.message?.includes('Invalid state for review')) {
          console.warn('⚠️ Backend already advanced past review — fetching results');
          await fetchFinalResults();
          return;
        }
        throw reviewErr;
      }
      
      // Handle success:false responses (backend returns HTTP 200 but with error in body)
      if (!reviewResponse.success) {
        const msg = reviewResponse.message || reviewResponse.error || '';
        if (msg.includes('FINAL_SUMMARY_GENERATED') || msg.includes('COMPLETED') || msg.includes('Invalid state')) {
          console.warn('⚠️ Backend already advanced past review (200 response) — fetching results');
          await fetchFinalResults();
          return;
        }
        throw new Error(msg || 'Failed to submit review');
      }

      console.log('✅ Review submitted successfully');
      
      if (reviewSubmission.approved) {
        // Set a clear "generating" status so user sees progress, not the old review status
        const isDetailsPhase = actualStatus === 'details_extracted' || reviewType === 'details';
        setCurrentStatus(isDetailsPhase ? 'generating_rom' : 'generating_summary');
        handleSuccess(isDetailsPhase ? 'Approved — generating ROM estimate...' : 'Approved — generating executive summary...');
        
        // Remember the status we're leaving so polling skips it
        const statusBeforeApprove = actualStatus;
        
        // POST /continue-workflow/{sessionId} — returns immediately (background task)
        console.log('📡 POST /continue-workflow/{sessionId} (async)');
        const continueResponse = await apiService.continueWorkflow(sessionId);
        
        if (continueResponse.hasOwnProperty('success') && continueResponse.success === false && continueResponse.error) {
          throw new Error(continueResponse.message || continueResponse.error || 'Failed to continue workflow');
        }

        console.log('✅ continue-workflow returned. Polling /status...');
        
        // Poll /status until a NEW reviewable status or terminal — skip current status
        const finalStatus = await apiService.pollUntilReady(sessionId, {
          interval: 5000,
          timeout: 300000,
          skipStatus: statusBeforeApprove,
          onProgress: (statusResp) => {
            console.log(`🔄 Poll: ${statusResp.status} | processing: ${statusResp.is_processing} | reviewable: ${statusResp.is_reviewable}`);
            if (statusResp.status) setCurrentStatus(statusResp.status.toLowerCase());
          },
        });

        console.log('✅ Polling complete. Status:', finalStatus.status);

        if (terminalStatuses.includes(finalStatus.status?.toLowerCase())) {
          await fetchFinalResults();
        } else if (finalStatus.is_reviewable) {
          // Next review phase — fetch full review data
          console.log('📡 Fetching next review data...');
          const nextReviewResponse = await apiService.getReviewData(sessionId);
          
          if (nextReviewResponse.success) {
            setReviewData(nextReviewResponse);
            setCurrentStatus(nextReviewResponse.status);
            
            if (nextReviewResponse.status === 'detailed_rom_generated') {
              setDetailedRom(nextReviewResponse.detailed_rom);
              setAwaitingReview(true);
              setReviewType('detailed_rom');
              handleSuccess('ROM estimate ready for review');
            } else if (nextReviewResponse.status === 'details_extracted') {
              setExtractedDetails(nextReviewResponse.extracted_details);
              setAwaitingReview(true);
              setReviewType('details');
              handleSuccess('Project details ready for review');
            }
          }
        }
        
      } else {
        handleSuccess('Feedback submitted — revising...');
        
        // Changes requested — continue-workflow returns immediately (background task)
        console.log('📡 Changes requested - POST /continue-workflow/{sessionId} (async)');
        
        const continueResponse = await apiService.continueWorkflow(sessionId);
        
        if (continueResponse.hasOwnProperty('success') && continueResponse.success === false && continueResponse.error) {
          throw new Error(continueResponse.message || continueResponse.error || 'Failed to continue workflow after feedback');
        }

        console.log('✅ continue-workflow returned. Polling /status...');
        handleSuccess('Processing revision...');
        
        // Poll /status until is_reviewable
        const finalStatus = await apiService.pollUntilReady(sessionId, {
          interval: 5000,
          timeout: 300000,
          onProgress: (statusResp) => {
            console.log(`🔄 Poll (feedback): ${statusResp.status} | processing: ${statusResp.is_processing} | reviewable: ${statusResp.is_reviewable}`);
            if (statusResp.status) setCurrentStatus(statusResp.status.toLowerCase());
          },
        });

        console.log('✅ Polling after feedback complete. Status:', finalStatus.status);
        
        // Fetch updated review data
        const updatedReviewResponse = await apiService.getReviewData(sessionId);
        
        if (updatedReviewResponse.success) {
          setReviewData(updatedReviewResponse);
          setCurrentStatus(updatedReviewResponse.status);
          
          if (updatedReviewResponse.status === 'details_extracted') {
            setExtractedDetails(updatedReviewResponse.extracted_details);
            setAwaitingReview(true);
            setReviewType('details');
            handleSuccess('Revised details ready for review');
          } else if (updatedReviewResponse.status === 'detailed_rom_generated') {
            setDetailedRom(updatedReviewResponse.detailed_rom);
            setAwaitingReview(true);
            setReviewType('detailed_rom');
            handleSuccess('Revised ROM estimate ready for review');
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Review submission failed:', error);
      // Rich multiline errors get the graceful workflow error view
      if (error.message && (error.message.includes('\n') || error.message.length > 200)) {
        setCurrentStatus('error');
        setWorkflowError(error.message);
      } else {
        handleError(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Download ROM results as JSON files
  const downloadResults = async (workflowState = null) => {
    try {
      console.log('📥 Downloading ROM results...');
      
      // Get final workflow state if not provided
      let finalData = workflowState;
      if (!finalData) {
        try {
          const finalState = await apiService.getFinalWorkflowState(sessionId);
          console.log('📋 Final state response:', finalState);
          
          if (finalState.success && finalState.workflow_state) {
            finalData = finalState.workflow_state;
          } else {
            console.warn('⚠️ API call failed, using available state data');
            // Fallback to current state data
            finalData = {
              summary_rom: summaryRom,
              detailed_rom: detailedRom,
              extracted_details: extractedDetails,
              input_data: processedInput,
              project_id: projectId,
              session_id: sessionId
            };
          }
        } catch (apiError) {
          console.warn('⚠️ API call failed, using available state data:', apiError);
          // Fallback to current state data
          finalData = {
            summary_rom: summaryRom,
            detailed_rom: detailedRom,
            extracted_details: extractedDetails,
            input_data: processedInput,
            project_id: projectId,
            session_id: sessionId
          };
        }
      }
      
      if (!finalData || (!finalData.summary_rom && !finalData.detailed_rom)) {
        throw new Error('No ROM data available for download');
      }
      
      console.log('📦 Using workflow data for download:', finalData);
      
      // Helper to format numbers with commas
      const formatNumber = (num) => {
        return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
      };
      
      // Convert K values to full amounts for download with comma formatting
      // Backend can return either K values or full amounts - use threshold to detect
      const convertedDetailedRom = finalData.detailed_rom ? {
        ...finalData.detailed_rom,
        items: finalData.detailed_rom.items?.map(item => {
          const value = parseK(item.high_level_rom_k);
          // If value > 10000, it's already a full amount, otherwise multiply by 1000
          const fullAmount = value > 10000 ? value : value * 1000;
          return {
            ...item,
            high_level_rom_k: formatNumber(fullAmount)
          };
        }),
        // total_cost is already a full amount from backend, just clean and format it
        total_cost: formatNumber(parseK(finalData.detailed_rom.total_cost))
      } : null;
      
      const convertedSummaryRom = finalData.summary_rom ? {
        ...finalData.summary_rom,
        // These are already full amounts from backend, just clean and format them
        rom_confidence_level: formatNumber(parseK(finalData.summary_rom.rom_confidence_level || finalData.summary_rom.total_cost)),
        total_cost: formatNumber(parseK(finalData.summary_rom.total_cost || finalData.summary_rom.rom_confidence_level))
      } : null;
      
      // Create comprehensive ROM results package with all data combined
      const romResults = {
        project_info: {
          project_id: finalData.project_id,
          session_id: finalData.session_id,
          project_title: finalData.input_data?.project_title,
          generated_at: new Date().toISOString(),
          status: finalData.status
        },
        summary_rom: convertedSummaryRom,
        detailed_rom: convertedDetailedRom,
        extracted_details: finalData.extracted_details
      };
      
      // Download single combined ROM results file
      const completeResultsBlob = new Blob([JSON.stringify(romResults, null, 2)], {
        type: 'application/json'
      });
      const completeResultsUrl = URL.createObjectURL(completeResultsBlob);
      const completeResultsLink = document.createElement('a');
      completeResultsLink.href = completeResultsUrl;
      completeResultsLink.download = `ROM_Results_${finalData.project_id || sessionId}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(completeResultsLink);
      completeResultsLink.click();
      document.body.removeChild(completeResultsLink);
      URL.revokeObjectURL(completeResultsUrl);
      console.log('✅ Downloaded Complete ROM Results');
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      handleError('Failed to download results: ' + error.message);
    }
  };

  // Render current workflow stage
  const renderCurrentStage = () => {
      // Landing page view
    if (view === 'landing') {
      return (
        <RomLandingPage onStartNewEstimate={startNewEstimate} />
      );
    }    // Form view
    if (view === 'form') {
      return (
        <Box>
          <Box sx={{ display: 'flex', mb: 3, maxWidth: 1000, mx: 'auto' }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setView('landing')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
          </Box>
          <ProjectInputForm 
            onSubmit={handleProjectSubmit}
            isLoading={isLoading}
          />
        </Box>
      );
    }
    
    // Workflow views
    if (view === 'workflow') {
      // Error view — graceful display of backend error messages
      if (currentStatus === 'error' && workflowError) {
        return (
          <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
            <Paper sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <ErrorOutlineIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>
                    Unable to Process Request
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The information provided was not sufficient to generate a ROM estimate.
                  </Typography>
                </Box>
              </Box>

              <Box sx={{
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.300',
                borderRadius: 2,
                p: 3,
                mb: 3,
                whiteSpace: 'pre-line',
              }}>
                {workflowError.split('\n').map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <Box key={i} sx={{ height: 8 }} />;
                  // Render bullet lines with left indent
                  if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                    return (
                      <Typography key={i} variant="body2" sx={{ pl: 2, py: 0.3 }}>
                        {trimmed}
                      </Typography>
                    );
                  }
                  // Section headers (lines ending with ':')
                  if (trimmed.endsWith(':')) {
                    return (
                      <Typography key={i} variant="subtitle2" sx={{ mt: 1, fontWeight: 600 }}>
                        {trimmed}
                      </Typography>
                    );
                  }
                  return (
                    <Typography key={i} variant="body2" sx={{ py: 0.3 }}>
                      {trimmed}
                    </Typography>
                  );
                })}
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="primary"
                  onClick={() => {
                    setWorkflowError(null);
                    setCurrentStatus('initiated');
                    setSessionId(null);
                    setProjectId(null);
                    setError(null);
                    setView('form');
                  }}
                >
                  Try Again
                </Button>
                <Button
                  variant="text"
                  onClick={resetWorkflow}
                >
                  Back to Dashboard
                </Button>
              </Box>
            </Paper>
          </Box>
        );
      }

      // Completed view with comprehensive results display
      if (currentStatus === 'completed' && finalWorkflowData) {
        return (
          <FinalResultsDisplay
            workflowData={finalWorkflowData}
            onDownload={() => downloadResults(finalWorkflowData)}
            onStartNew={resetWorkflow}
            onGoToDashboard={resetWorkflow}
          />
        );
      }

      // Final summary ready - automatically show results
      if (currentStatus === 'final_summary_generated') {
        // Get final workflow data if not already available
        const handleAutoLoadFinalData = async () => {
          if (!finalWorkflowData) {
            try {
              const finalState = await apiService.getFinalWorkflowState(sessionId);
              if (finalState.success && finalState.workflow_state) {
                setFinalWorkflowData(finalState.workflow_state);
                setCurrentStatus('completed');
              }
            } catch (error) {
              console.error('Auto-load failed, using available data:', error);
              // Use available data as fallback
              const workflowData = {
                summary_rom: summaryRom,
                detailed_rom: detailedRom || reviewData?.detailed_rom,
                extracted_details: extractedDetails || reviewData?.extracted_details,
                input_data: { 
                  project_title: reviewData?.project_title || processedInput?.project_title || 'ROM Project'
                },
                project_id: projectId,
                session_id: sessionId,
                status: 'final_summary_generated'
              };
              setFinalWorkflowData(workflowData);
              setCurrentStatus('completed');
            }
          }
        };
        
        // Auto-load if needed
        if (!finalWorkflowData) {
          handleAutoLoadFinalData();
        }
        
        return (
          <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h4" color="primary" gutterBottom>
                ROM Estimation Complete
              </Typography>
              <Typography variant="h6" color="text.secondary" paragraph>
                Loading final results...
              </Typography>
              
              <Box sx={{ mt: 4, mb: 3 }}>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => downloadResults()}
                  disabled={isLoading}
                  sx={{ mr: 2, minWidth: 200 }}
                >
                  Download Results
                </Button>
                <Button
                  variant="text"
                  size="large"
                  onClick={resetWorkflow}
                  sx={{ minWidth: 150 }}
                >
                  Start New Estimate
                </Button>
              </Box>
            </Paper>
          </Box>
        );
      }

      // Review view - show when we have review data and awaiting user input
      if (awaitingReview && reviewData) {
        return (
          <ReviewSection
            reviewData={reviewData}
            reviewType={reviewType}
            onSubmit={handleReviewSubmit}
            isLoading={isLoading}
            currentStatus={currentStatus}
          />
        );
      }

      // Processing/status view
      return (
        <Box>
          <StatusIndicator
            currentStatus={currentStatus}
            isLoading={isLoading}
            extractedDetails={extractedDetails}
            detailedRom={detailedRom}
          />
        </Box>
      );
    }
  };

  return (
    <Box sx={{ 
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      height: 'auto',
      py: 2,
      px: 2
    }}>
      {/* Only show header on form and workflow views */}
      {view !== 'landing' && (
        <Paper sx={{ p: 3, mb: 2, textAlign: 'center', maxWidth: 1000, mx: 'auto', position: 'relative' }}>
          {/* Cancel button — only during in-progress workflow, not after completion */}
          {view === 'workflow' && currentStatus !== 'completed' && (
            <Button
              variant="text"
              startIcon={<CloseIcon />}
              onClick={resetWorkflow}
              sx={{ position: 'absolute', top: 16, right: 16, color: 'text.secondary' }}
            >
              Cancel
            </Button>
          )}
          <Typography variant="h3" component="h1" gutterBottom color="primary">
            ROM Estimator
            {USE_MOCK_API && (
              <Typography component="span" variant="caption" sx={{ 
                ml: 2, 
                px: 1, 
                py: 0.5, 
                bgcolor: 'warning.light', 
                color: 'warning.contrastText',
                borderRadius: 1,
                fontSize: '0.75rem'
              }}>
                TEST MODE
              </Typography>
            )}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Generate comprehensive Rough Order of Magnitude estimates for your projects
          </Typography>
        </Paper>
      )}



      {/* Alerts */}
      <Fade in={!!error}>
        <Box sx={{ mb: 2 }}>
          {error && (
            <Alert 
              severity="error" 
              onClose={() => setError(null)}
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}
        </Box>
      </Fade>

      <Fade in={!!success}>
        <Box sx={{ mb: 2 }}>
          {success && (
            <Alert 
              severity="success"
              sx={{ mb: 2 }}
            >
              {success}
            </Alert>
          )}
        </Box>
      </Fade>

      {/* Main Content */}
      <Box sx={{ 
        width: '100%',
        flexGrow: 1,
        overflowY: 'auto',
        position: 'static'
      }}>
        {renderCurrentStage()}
      </Box>


    </Box>
  );
};

export default RomEstimator;