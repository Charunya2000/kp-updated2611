// Mock ROM API service for testing the workflow

class MockRomApiService {
  constructor() {
    this.sessionCounter = 0;
    this.sessionData = {};
  }

  async processInput(formData) {
    console.log('🔵 MOCK API: processInput called with:', {
      project_title: formData.project_title,
      project_description: formData.project_description?.substring(0, 100) + '...',
      confidence_level: formData.confidence_level,
      files_count: formData.files ? formData.files.length : 0,
      files_names: formData.files ? formData.files.map(f => f.name) : []
    });
    
    // Validate required fields like the real API would
    if (!formData.project_title || !formData.project_description) {
      console.error('❌ MOCK API: Validation failed - missing required fields');
      throw new Error('Project title and description are required');
    }
    
    console.log('⏳ MOCK API: Processing input... (simulating 1.5s delay)');
    
    // Simulate realistic API processing time
    await this._delay(1500);
    
    // Generate session ID
    const sessionId = `mock-session-${Date.now()}-${++this.sessionCounter}`;
    const projectId = `ROM-${Date.now().toString().substring(7)}`;
    
    // Store form data with more detailed processing
    this.sessionData[sessionId] = {
      projectId,
      formData,
      status: 'input_processed',
      processed_input: {
        title: formData.project_title,
        description: formData.project_description,
        confidence_level: formData.confidence_level || 50,
        uploaded_files: (formData.files || []).map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        })),
        constraints: formData.constraints || '',
        additional_info: formData.additional || '',
        in_scope: formData.in_scope || '',
        out_scope: formData.out_scope || '',
        risks: formData.risks || '',
        target_markets: formData.markets || '',
        processed_at: new Date().toISOString()
      }
    };
    
    console.log('MOCK API: Session created successfully:', {
      session_id: sessionId,
      project_id: projectId,
      files_processed: this.sessionData[sessionId].processed_input.uploaded_files.length
    });
    
    const response = {
      success: true,
      message: 'Project input processed successfully',
      session_id: sessionId,
      project_id: projectId,
      status: 'input_processed',
      processed_input: this.sessionData[sessionId].processed_input
    };
    
    console.log('📤 MOCK API: Returning response:', response);
    return response;
  }

  async searchSimilarRom(sessionId) {
    console.log('MOCK API: Searching similar ROM for session', sessionId);
    
    // Simulate API delay
    await this._delay(1500);
    
    if (!this.sessionData[sessionId]) {
      throw new Error('Session not found');
    }
    
    this.sessionData[sessionId].status = 'similar_rom_found';
    this.sessionData[sessionId].similar_rom = {
      id: 'ROM-SIM-2023-001',
      title: 'Similar Project Example',
      confidence: 75,
      effort_estimate: '850 person-hours',
      cost_range: '$120,000 - $150,000',
      timeline: '12 weeks'
    };
    
    return {
      success: true,
      message: 'Found similar ROMs',
      status: 'similar_rom_found',
      similar_rom: this.sessionData[sessionId].similar_rom,
      similar_roms_count: 3
    };
  }

  async extractDetails(sessionId) {
    console.log('MOCK API: Extracting details for session', sessionId);
    
    // Simulate API delay
    await this._delay(2000);
    
    if (!this.sessionData[sessionId]) {
      throw new Error('Session not found');
    }
    
    this.sessionData[sessionId].status = 'details_extracted';
    this.sessionData[sessionId].extracted_details = {
      effort_hours: {
        design: 200,
        development: 400,
        testing: 180,
        deployment: 70,
        total: 850
      },
      timeline_weeks: 12,
      cost_range: {
        low: 120000,
        high: 150000,
        currency: 'USD'
      },
      risk_factors: [
        { factor: 'Technical complexity', impact: 'Medium', mitigation: 'Expert resources allocation' },
        { factor: 'Resource availability', impact: 'Low', mitigation: 'Advanced scheduling' }
      ],
      team_composition: [
        { role: 'Project Manager', quantity: 1 },
        { role: 'Senior Developer', quantity: 2 },
        { role: 'Developer', quantity: 3 },
        { role: 'QA Engineer', quantity: 2 },
        { role: 'UX Designer', quantity: 1 }
      ]
    };
    
    return {
      success: true,
      message: 'Details extracted successfully',
      status: 'details_extracted',
      extracted_details: this.sessionData[sessionId].extracted_details
    };
  }

  async getReviewData(sessionId) {
    console.log('MOCK API: Getting review data for session', sessionId);
    
    // Simulate API delay
    await this._delay(1000);
    
    if (!this.sessionData[sessionId]) {
      throw new Error('Session not found');
    }
    
    // Update status for first review
    if (this.sessionData[sessionId].status === 'details_extracted') {
      this.sessionData[sessionId].status = 'user_review_pending';
      this.sessionData[sessionId].awaiting_review = true;
      this.sessionData[sessionId].review_type = 'initial_review';
    }
    // Update status for final review if already approved initially
    else if (this.sessionData[sessionId].status === 'detailed_rom_generated') {
      this.sessionData[sessionId].status = 'detailed_rom_review_pending';
      this.sessionData[sessionId].awaiting_review = true;
      this.sessionData[sessionId].review_type = 'detailed_review';
    }
    
    return {
      success: true,
      status: this.sessionData[sessionId].status,
      awaiting_review: this.sessionData[sessionId].awaiting_review,
      review_type: this.sessionData[sessionId].review_type,
      processed_input: this.sessionData[sessionId].processed_input,
      extracted_details: this.sessionData[sessionId].extracted_details,
      detailed_rom: this.sessionData[sessionId].detailed_rom,
      similar_rom: this.sessionData[sessionId].similar_rom,
      summary_rom: this.sessionData[sessionId].summary_rom
    };
  }

  async submitReview(sessionId, reviewData) {
    console.log('MOCK API: Submitting review for session', sessionId, reviewData);
    
    // Simulate API delay
    await this._delay(1000);
    
    if (!this.sessionData[sessionId]) {
      throw new Error('Session not found');
    }
    
    // Handle first review
    if (this.sessionData[sessionId].status === 'user_review_pending') {
      if (reviewData.approved) {
        this.sessionData[sessionId].status = 'user_approved';
        this.sessionData[sessionId].awaiting_review = false;
        this.sessionData[sessionId].review_type = null;
      } else {
        // If not approved, we'd handle revision in a real API
        this.sessionData[sessionId].status = 'revision_requested';
      }
    }
    // Handle final review
    else if (this.sessionData[sessionId].status === 'detailed_rom_review_pending') {
      if (reviewData.approved) {
        this.sessionData[sessionId].status = 'detailed_rom_approved';
        this.sessionData[sessionId].awaiting_review = false;
        this.sessionData[sessionId].review_type = null;
      } else {
        // If not approved, we'd handle revision in a real API
        this.sessionData[sessionId].status = 'final_revision_requested';
      }
    }
    
    return {
      success: true,
      message: reviewData.approved ? 'Review approved' : 'Revision requested',
      status: this.sessionData[sessionId].status
    };
  }

  async continueWorkflow(sessionId) {
    console.log('MOCK API: Continuing workflow for session', sessionId);
    
    // Simulate API delay
    await this._delay(2000);
    
    if (!this.sessionData[sessionId]) {
      throw new Error('Session not found');
    }
    
    // Move from user approval to generating detailed ROM
    if (this.sessionData[sessionId].status === 'user_approved') {
      this.sessionData[sessionId].status = 'detailed_rom_generated';
      this.sessionData[sessionId].detailed_rom = {
        id: `ROM-${Date.now().toString().substring(7)}`,
        title: this.sessionData[sessionId].processed_input.title,
        description: this.sessionData[sessionId].processed_input.description,
        created_date: new Date().toISOString(),
        effort_hours: this.sessionData[sessionId].extracted_details.effort_hours,
        timeline_weeks: this.sessionData[sessionId].extracted_details.timeline_weeks,
        cost_range: this.sessionData[sessionId].extracted_details.cost_range,
        risk_factors: this.sessionData[sessionId].extracted_details.risk_factors,
        team_composition: this.sessionData[sessionId].extracted_details.team_composition,
        assumptions: [
          "Resources are available as per schedule",
          "Requirements remain stable during development",
          "Stakeholders are available for timely reviews"
        ],
        dependencies: [
          "Third-party API integration availability",
          "DevOps infrastructure readiness",
          "Security approval process"
        ],
        detailed_breakdown: {
          phases: [
            {
              name: "Planning and Design",
              duration_weeks: 3,
              activities: [
                "Requirements finalization",
                "Architecture design",
                "UX/UI prototyping"
              ]
            },
            {
              name: "Development",
              duration_weeks: 6,
              activities: [
                "Core functionality implementation",
                "Integration development",
                "Progressive testing"
              ]
            },
            {
              name: "Testing and QA",
              duration_weeks: 2,
              activities: [
                "Functional testing",
                "Performance testing",
                "Security assessment"
              ]
            },
            {
              name: "Deployment",
              duration_weeks: 1,
              activities: [
                "Production deployment",
                "Monitoring setup",
                "Documentation"
              ]
            }
          ]
        }
      };
    }
    // Move from detailed ROM approval to final summary
    else if (this.sessionData[sessionId].status === 'detailed_rom_approved') {
      this.sessionData[sessionId].status = 'final_summary_generated';
      this.sessionData[sessionId].summary_rom = {
        id: this.sessionData[sessionId].detailed_rom.id,
        title: this.sessionData[sessionId].detailed_rom.title,
        generated_date: new Date().toISOString(),
        effort_total: `${this.sessionData[sessionId].detailed_rom.effort_hours.total} person-hours`,
        timeline: `${this.sessionData[sessionId].detailed_rom.timeline_weeks} weeks`,
        cost_estimate: `$${this.sessionData[sessionId].detailed_rom.cost_range.low.toLocaleString()} - $${this.sessionData[sessionId].detailed_rom.cost_range.high.toLocaleString()}`,
        team_size: this.sessionData[sessionId].detailed_rom.team_composition.reduce((acc, member) => acc + member.quantity, 0),
        key_risks: this.sessionData[sessionId].detailed_rom.risk_factors.map(risk => risk.factor).join(", "),
        confidence_level: "Medium-High"
      };
      
      // Complete the workflow
      this.sessionData[sessionId].status = 'completed';
    }
    
    return {
      success: true,
      status: this.sessionData[sessionId].status,
      message: `Workflow advanced to ${this.sessionData[sessionId].status}`
    };
  }

  // Helper method to simulate API delay
  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mockRomApiService = new MockRomApiService();