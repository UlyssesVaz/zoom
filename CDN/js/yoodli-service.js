/**
 * Yoodli API Service
 * 
 * Service layer for integrating Yoodli AI roleplay capabilities
 * Documentation: https://developers.yoodli.ai/docs/quickstart
 */

class YoodliService {
  constructor() {
    // Load credentials from localStorage (set via settings page)
    this.apiKey = localStorage.getItem('yoodli_api_key') || '';
    this.orgId = localStorage.getItem('yoodli_org_id') || '';
    this.baseUrl = 'https://api.yoodli.ai'; // Base API URL
  }

  /**
   * Check if Yoodli is configured
   */
  isConfigured() {
    return !!(this.apiKey && this.orgId);
  }

  /**
   * Get authentication headers
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Organization-ID': this.orgId
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    if (!this.isConfigured()) {
      throw new Error('Yoodli API not configured. Please add API key and Organization ID in Settings.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/organizations/${this.orgId}/users`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return { success: true, data: await response.json() };
    } catch (error) {
      console.error('Yoodli API connection test failed:', error);
      throw error;
    }
  }

  /**
   * List users in organization
   */
  async listUsers() {
    try {
      const response = await fetch(`${this.baseUrl}/organizations/${this.orgId}/users`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to list users: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to list users:', error);
      throw error;
    }
  }

  /**
   * List available roleplay scenarios
   */
  async listScenarios() {
    try {
      // Mock data for now - replace with actual API call when endpoint is confirmed
      // Expected: GET /roleplays/scenarios
      const response = await fetch(`${this.baseUrl}/roleplays/scenarios`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        // Return mock scenarios if API not available yet
        return this.getMockScenarios();
      }

      return await response.json();
    } catch (error) {
      console.warn('Using mock scenarios:', error);
      return this.getMockScenarios();
    }
  }

  /**
   * Get mock scenarios (fallback)
   */
  getMockScenarios() {
    return {
      scenarios: [
        {
          id: 'sales-cold-call',
          name: 'Cold Call Discovery',
          description: 'Practice initial discovery calls with prospects',
          category: 'Sales',
          estimatedDuration: 10
        },
        {
          id: 'sales-objections',
          name: 'Handling Objections',
          description: 'Practice responding to common sales objections',
          category: 'Sales',
          estimatedDuration: 15
        },
        {
          id: 'sales-pricing',
          name: 'Pricing Discussion',
          description: 'Navigate pricing conversations and negotiations',
          category: 'Sales',
          estimatedDuration: 12
        },
        {
          id: 'sales-closing',
          name: 'Closing Techniques',
          description: 'Practice closing techniques and next steps',
          category: 'Sales',
          estimatedDuration: 10
        },
        {
          id: 'customer-success',
          name: 'Customer Success Check-in',
          description: 'Practice customer success and retention conversations',
          category: 'Customer Success',
          estimatedDuration: 15
        }
      ]
    };
  }

  /**
   * Create a roleplay session
   * @param {string} scenarioId - ID of the scenario to practice
   * @param {string} userId - Optional user ID (can use current user)
   * @param {Object} context - Optional context/pre-read data for AI
   */
  async createRoleplaySession(scenarioId, userId = null, context = null) {
    try {
      const body = {
        scenarioId: scenarioId,
        orgId: this.orgId,
        ...(userId && { userId }),
        ...(context && { preRead: context })
      };

      // Expected: POST /roleplays/sessions
      const response = await fetch(`${this.baseUrl}/roleplays/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const session = await response.json();
      
      // Store session ID for later reference
      sessionStorage.setItem('yoodli_current_session', session.id);
      
      return session;
    } catch (error) {
      console.error('Failed to create roleplay session:', error);
      // Return mock session for development
      return this.createMockSession(scenarioId);
    }
  }

  /**
   * Create mock session (fallback)
   */
  createMockSession(scenarioId) {
    const sessionId = `mock_session_${Date.now()}`;
    sessionStorage.setItem('yoodli_current_session', sessionId);
    return {
      id: sessionId,
      scenarioId: scenarioId,
      status: 'active',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Send message in roleplay conversation
   * @param {string} sessionId - Session ID
   * @param {string} message - User's message
   */
  async sendMessage(sessionId, message) {
    try {
      // Expected: POST /roleplays/sessions/{sessionId}/messages
      const response = await fetch(`${this.baseUrl}/roleplays/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message: message,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Return mock AI response for development
      return this.getMockAIResponse(message);
    }
  }

  /**
   * Get mock AI response (fallback)
   */
  getMockAIResponse(userMessage) {
    // Simple mock responses based on keywords
    const responses = {
      'hello': "Hello! I'm interested in learning more about your product. Can you tell me about your pricing?",
      'price': "That seems a bit high. What kind of ROI can I expect?",
      'roi': "That's helpful. How long does implementation typically take?",
      'implementation': "Great, I'll need to discuss this with my team. When can we schedule a follow-up?",
      'default': "That's interesting. Can you tell me more about how that works?"
    };

    const lowerMessage = userMessage.toLowerCase();
    let response = responses.default;
    
    for (const [key, value] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        response = value;
        break;
      }
    }

    return {
      id: `msg_${Date.now()}`,
      role: 'ai',
      message: response,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * End roleplay session and get analysis
   * @param {string} sessionId - Session ID
   */
  async endSession(sessionId) {
    try {
      // Expected: POST /roleplays/sessions/{sessionId}/end
      const response = await fetch(`${this.baseUrl}/roleplays/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to end session: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to end session:', error);
      // Return mock analysis for development
      return this.getMockAnalysis();
    }
  }

  /**
   * Get session analysis/feedback
   * @param {string} sessionId - Session ID
   */
  async getSessionAnalysis(sessionId) {
    try {
      // Expected: GET /roleplays/sessions/{sessionId}/analysis
      const response = await fetch(`${this.baseUrl}/roleplays/sessions/${sessionId}/analysis`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get analysis: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get analysis:', error);
      return this.getMockAnalysis();
    }
  }

  /**
   * Get mock analysis (fallback)
   */
  getMockAnalysis() {
    return {
      sessionId: sessionStorage.getItem('yoodli_current_session'),
      overallScore: 85,
      feedback: {
        strengths: [
          'Clear communication style',
          'Good use of open-ended questions',
          'Effective listening'
        ],
        improvements: [
          'Reduce filler words (um, uh)',
          'Pace could be slightly slower',
          'More specific examples would help'
        ],
        metrics: {
          fillerWords: 12,
          speakingPace: 145, // words per minute
          clarity: 8.5,
          engagement: 7.8
        }
      },
      recommendations: [
        'Practice handling pricing objections',
        'Work on closing techniques',
        'Improve active listening skills'
      ]
    };
  }

  /**
   * Create roleplay from deal context (for Call Prep AI)
   * @param {Object} dealContext - Deal/lead context from CRM
   */
  async createContextualRoleplay(dealContext) {
    // Use AI Pre-Read feature to create personalized roleplay
    const context = {
      accountName: dealContext.accountName,
      dealValue: dealContext.dealValue,
      dealStage: dealContext.dealStage,
      contacts: dealContext.contacts,
      lastInteraction: dealContext.lastInteractionSummary,
      notes: dealContext.notes
    };

    // Create a custom scenario based on context
    const scenarioId = this.determineScenarioFromContext(dealContext);
    
    return await this.createRoleplaySession(scenarioId, null, context);
  }

  /**
   * Determine best scenario based on deal context
   */
  determineScenarioFromContext(dealContext) {
    const stage = dealContext.dealStage?.toLowerCase() || '';
    
    if (stage.includes('negotiation') || stage.includes('pricing')) {
      return 'sales-pricing';
    } else if (stage.includes('objection') || stage.includes('concern')) {
      return 'sales-objections';
    } else if (stage.includes('closing') || stage.includes('final')) {
      return 'sales-closing';
    } else {
      return 'sales-cold-call';
    }
  }
}

// Export singleton instance
window.yoodliService = new YoodliService();





