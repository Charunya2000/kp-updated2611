// Always use the Next.js API route to avoid CORS issues
const API_BASE_URL = '/api/rom';

class RomApiService {
  async processInput(formData) {
    const form = new FormData();
    
    // Add text fields - ensure confidence_level is sent as string
    form.append('project_title', formData.project_title);
    form.append('project_description', formData.project_description);
    if (formData.confidence_level) form.append('confidence_level', String(formData.confidence_level));
    if (formData.constraints) form.append('constraints', formData.constraints);
    if (formData.additional) form.append('additional', formData.additional);
    if (formData.in_scope) form.append('in_scope', formData.in_scope);
    if (formData.out_scope) form.append('out_scope', formData.out_scope);
    if (formData.risks) form.append('risks', formData.risks);
    if (formData.markets) form.append('markets', formData.markets);
    if (Array.isArray(formData.selected_project_ids) && formData.selected_project_ids.length > 0) {
      form.append('selected_project_ids', JSON.stringify(formData.selected_project_ids.slice(0, 3)));
    }
    if (Array.isArray(formData.selected_project_titles) && formData.selected_project_titles.length > 0) {
      form.append('selected_project_titles', JSON.stringify(formData.selected_project_titles.slice(0, 3)));
    }
    
    // Add files - Validate file extensions before adding
    if (formData.files && formData.files.length > 0) {
      formData.files.forEach(file => {
        const extension = file.name.split('.').pop().toLowerCase();
        // Ensure only accepted file types are uploaded
        if (['pptx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'].includes(extension)) {
          form.append('files', file);
        } else {
          console.warn(`Skipping file ${file.name} - unsupported extension`);
        }
      });
    }

    console.log('Sending request to:', `${API_BASE_URL}/process-input`);
    console.log('Form data contains files:', formData.files ? formData.files.length : 0);

    try {
      const response = await fetch(`${API_BASE_URL}/process-input`, {
        method: 'POST',
        body: form,
        // Add CORS mode and credentials
        mode: 'cors',
        credentials: 'include',
        headers: {
          // Don't set Content-Type header when using FormData as the browser will set it automatically with the correct boundary
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('API success response:', responseData);
      return responseData;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async searchSimilarRom(sessionId) {
    console.log('🔍 Searching similar ROM for session:', sessionId);
    console.log('🔗 Request URL:', `${API_BASE_URL}/search-similar-rom/${sessionId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/search-similar-rom/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ Parsed error data:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Search similar ROM response:', responseData);
      return responseData;
    } catch (error) {
      console.error('❌ searchSimilarRom failed:', error);
      throw error;
    }
  }

  async extractDetails(sessionId) {
    console.log('🔧 Extracting details for session:', sessionId);
    console.log('🔗 Request URL:', `${API_BASE_URL}/extract-details/${sessionId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/extract-details/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      });

      console.log('📡 Extract details response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Extract details API error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ Parsed extract details error:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Extract details response:', responseData);
      
      // Log whether the backend actually started the extraction process
      if (responseData.success) {
        console.log('✅ Backend says extraction started successfully');
        console.log('⚠️ WARNING: Backend may still be processing. Status should change from similar_rom_found to details_extracted');
      } else {
        console.warn('⚠️ Backend says extraction did NOT start successfully. Full response:', JSON.stringify(responseData, null, 2));
        console.warn('⚠️ Response success field:', responseData.success);
        console.warn('⚠️ Response message field:', responseData.message);
        console.warn('⚠️ Response error field:', responseData.error);
      }
      
      return responseData;
    } catch (error) {
      console.error('❌ extractDetails failed:', error);
      throw error;
    }
  }

  async getReviewData(sessionId) {
    console.log('📊 Getting review data for session:', sessionId);
    console.log('🔗 Request URL:', `${API_BASE_URL}/review/${sessionId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/review/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      });

      console.log('📡 Review data response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Review data API error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ Parsed review data error:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Review data response:', responseData);
      return responseData;
    } catch (error) {
      console.error('❌ getReviewData failed:', error);
      throw error;
    }
  }

  async getFinalWorkflowState(sessionId) {
    console.log('Getting final workflow state for session:', sessionId);
    console.log('Request URL:', `${API_BASE_URL}/session/${sessionId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      });

      console.log('Final workflow state response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Final workflow state API error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('Parsed final workflow state error:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Final workflow state response:', responseData);
      return responseData;
    } catch (error) {
      console.error('getFinalWorkflowState failed:', error);
      throw error;
    }
  }

  async submitReview(sessionId, reviewData) {
    console.log('Submitting review for session:', sessionId, reviewData);
    
    const response = await fetch(`${API_BASE_URL}/review/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData),
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async continueWorkflow(sessionId) {
    console.log('Continuing workflow for session:', sessionId);
    
    const response = await fetch(`${API_BASE_URL}/continue-workflow/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * GET /status/{session_id}
   * Lightweight polling endpoint — returns current status, is_processing, is_reviewable.
   * No LLM calls — safe to call frequently.
   * Falls back to GET /review/{session_id} if /status endpoint is not available (404).
   */
  async getStatus(sessionId) {
    const response = await fetch(`${API_BASE_URL}/status/${sessionId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      credentials: 'include',
    });

    // If /status endpoint doesn't exist yet on this backend, fall back to /review
    if (response.status === 404) {
      console.warn('⚠️ /status endpoint not available — falling back to /review for polling');
      return this._pollViaReviewFallback(sessionId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorText); } catch { errorData = { error: errorText }; }
      throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Fallback: derive status/is_processing/is_reviewable from GET /review/{session_id}
   * Used when the backend hasn't deployed the /status endpoint yet.
   * Returns "still processing" for non-OK responses (404, 500) instead of throwing,
   * so the polling loop continues to retry.
   */
  async _pollViaReviewFallback(sessionId) {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/review/${sessionId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        credentials: 'include',
      });
    } catch (networkErr) {
      // Network error — treat as still processing so polling retries
      console.warn('⚠️ Review fallback network error, treating as still processing:', networkErr.message);
      return { success: true, status: 'processing', is_processing: true, is_reviewable: false };
    }

    // If /review returns 404 or other error, the session isn't reviewable yet — keep polling
    if (!response.ok) {
      console.warn(`⚠️ Review fallback got HTTP ${response.status} — treating as still processing`);
      return { success: true, status: 'processing', is_processing: true, is_reviewable: false };
    }

    const data = await response.json();

    // If review endpoint returns success:false, it means not ready yet — keep polling
    if (data.success === false) {
      console.warn('⚠️ Review fallback got success:false — treating as still processing');
      return { success: true, status: data.status || 'processing', is_processing: true, is_reviewable: false };
    }

    // Map /review response to the shape pollUntilReady expects
    const reviewableStatuses = ['details_extracted', 'detailed_rom_generated'];
    const terminalStatuses = ['completed', 'final_summary_generated'];
    const status = (data.status || '').toLowerCase();

    return {
      success: true,
      status: data.status,
      is_processing: !reviewableStatuses.includes(status) && !terminalStatuses.includes(status),
      is_reviewable: reviewableStatuses.includes(status) || data.awaiting_review === true,
    };
  }

  /**
   * Poll GET /status/{session_id} every `interval` ms until is_reviewable is true
   * or status is COMPLETED / FINAL_SUMMARY_GENERATED.
   * @param {string} sessionId
   * @param {object} options
   * @param {number} options.interval — poll interval in ms (default 2000)
   * @param {number} options.timeout — max total wait in ms (default 300000)
   * @param {string} options.skipStatus — if set, ignore is_reviewable while status matches this value
   * @param {function} options.onProgress — optional callback(statusResponse) on each tick
   * @returns {Promise<object>} final status response
   */
  async pollUntilReady(sessionId, { interval = 5000, timeout = 300000, skipStatus, onProgress } = {}) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, interval));

      const statusResponse = await this.getStatus(sessionId);

      if (onProgress) onProgress(statusResponse);

      if (statusResponse.success === false) {
        // If backend saved ERROR state, stop polling and surface it
        if (statusResponse.is_error || statusResponse.status?.toLowerCase() === 'error') {
          throw new Error(statusResponse.error_message || statusResponse.error || 'Background processing failed. Please try again.');
        }
        throw new Error(statusResponse.error_message || statusResponse.error || statusResponse.message || 'Status check failed');
      }

      // Error state — stop polling immediately
      if (statusResponse.status?.toLowerCase() === 'error') {
        throw new Error(statusResponse.error_message || statusResponse.error || 'Background processing failed. Please try again.');
      }

      const currentStatus = statusResponse.status?.toLowerCase();

      // Terminal conditions — always stop polling
      const terminalStatuses = ['completed', 'final_summary_generated'];
      if (terminalStatuses.includes(currentStatus)) {
        return statusResponse;
      }

      // Reviewable — but only stop if we've moved past the skipStatus
      if (statusResponse.is_reviewable === true) {
        if (!skipStatus || currentStatus !== skipStatus.toLowerCase()) {
          return statusResponse;
        }
        // Still at the same status we started from — keep polling
        console.log(`⏳ Status is still ${currentStatus} (skipping, waiting for next phase)`);
      }

      // If not processing and not reviewable, something unexpected — still wait one more tick
      if (statusResponse.is_processing === false && statusResponse.is_reviewable === false) {
        console.warn('⚠️ Status poll: not processing and not reviewable. Status:', statusResponse.status);
      }
    }

    throw new Error(`Timed out after ${timeout / 1000}s waiting for processing to complete.`);
  }

  // FEATURE: Recent ROM Sessions API Integration
  // Added to support the recent estimates section in ROM Landing Page
  async getRecentSessions() {
    console.log('🔍 ROM Landing Page: Getting recent ROM sessions');
    console.log('🔗 Request URL:', `${API_BASE_URL}/sessions`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      });

      console.log('📡 Recent sessions response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Recent sessions API error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ Parsed recent sessions error:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Recent sessions response:', responseData);
      return responseData;
    } catch (error) {
      console.error('❌ getRecentSessions failed:', error);
      throw error;
    }
  }

  // FEATURE: Session Management - Delete Session
  async deleteSession(sessionId) {
    console.log('🗑️ Deleting ROM session:', sessionId);
    console.log('🔗 Request URL:', `${API_BASE_URL}/session/${sessionId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      });

      console.log('📡 Delete session response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Delete session API error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ Parsed delete session error:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Delete session response:', responseData);
      return responseData;
    } catch (error) {
      console.error('❌ deleteSession failed:', error);
      throw error;
    }
  }

  // FEATURE: Session Management - Modify ROM Session
  async modifyRomSession(sessionId, modifications) {
    console.log('✏️ Modifying ROM session:', sessionId);
    console.log('🔗 Request URL:', `${API_BASE_URL}/modify-rom/${sessionId}`);
    console.log('📝 Modifications:', modifications);
    
    try {
      const response = await fetch(`${API_BASE_URL}/modify-rom/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modifications),
        mode: 'cors',
        credentials: 'include',
      });

      console.log('📡 Modify ROM response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Modify ROM API error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ Parsed modify ROM error:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Modify ROM response:', responseData);
      return responseData;
    } catch (error) {
      console.error('❌ modifyRomSession failed:', error);
      throw error;
    }
  }
}

export const romApiService = new RomApiService();