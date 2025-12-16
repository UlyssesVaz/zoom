/**
 * LinkedIn Enrichment Service
 * 
 * Enriches contact data with LinkedIn information when available/permitted
 * Designed to work with a backend service that handles LinkedIn API/OAuth
 * 
 * Backend API endpoints expected:
 * - POST /api/linkedin/enrich - Enrich a contact with LinkedIn data
 * - GET /api/linkedin/profile/:email - Get LinkedIn profile by email
 * - GET /api/linkedin/company/:domain - Get LinkedIn company data
 * - POST /api/linkedin/relationships - Get relationship suggestions
 */

class LinkedInService {
  constructor() {
    // Backend API base URL - configure via settings
    this.apiBase = localStorage.getItem('linkedin_api_base') || '/api/linkedin';
    this.enrichmentEnabled = localStorage.getItem('linkedin_enabled') === 'true';
  }

  /**
   * Check if LinkedIn enrichment is configured and enabled
   */
  isConfigured() {
    return this.enrichmentEnabled && !!localStorage.getItem('linkedin_configured');
  }

  /**
   * Enable/disable LinkedIn enrichment
   */
  setEnabled(enabled) {
    this.enrichmentEnabled = enabled;
    localStorage.setItem('linkedin_enabled', enabled ? 'true' : 'false');
  }

  /**
   * Set configuration (called from settings page after OAuth)
   */
  setConfigured(configured = true) {
    localStorage.setItem('linkedin_configured', configured ? 'true' : '');
  }

  /**
   * Initiate LinkedIn OAuth flow
   * Redirects user to LinkedIn OAuth consent screen
   */
  async initiateOAuth() {
    try {
      // Get OAuth URL from backend
      const response = await fetch(`${this.apiBase}/auth/url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get OAuth URL: ${response.status}`);
      }

      const data = await response.json();
      const authUrl = data.authUrl || data.url;

      if (!authUrl) {
        throw new Error('No auth URL returned from backend');
      }

      // Redirect to LinkedIn OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate LinkedIn OAuth:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth callback (called from callback page)
   * @param {string} code - Authorization code from LinkedIn
   */
  async handleCallback(code) {
    try {
      const response = await fetch(`${this.apiBase}/auth/callback?code=${encodeURIComponent(code)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`OAuth callback failed: ${response.status}`);
      }

      const data = await response.json();
      this.setConfigured(true);
      return data;
    } catch (error) {
      console.error('Failed to handle OAuth callback:', error);
      throw error;
    }
  }

  /**
   * Disconnect LinkedIn account
   */
  async disconnect() {
    try {
      const response = await fetch(`${this.apiBase}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.status}`);
      }

      this.setConfigured(false);
      return true;
    } catch (error) {
      console.error('Failed to disconnect LinkedIn:', error);
      throw error;
    }
  }

  /**
   * Enrich a contact with LinkedIn data
   * @param {Object} contact - Contact object to enrich
   * @returns {Promise<Object>} Enriched contact data
   */
  async enrichContact(contact) {
    if (!this.isConfigured()) {
      console.warn('LinkedIn enrichment not configured');
      return contact;
    }

    try {
      // Try to enrich by email first
      if (contact.email) {
        const profile = await this.getProfileByEmail(contact.email);
        if (profile) {
          return this.mergeLinkedInData(contact, profile);
        }
      }

      // Try by name and company if email doesn't work
      if (contact.name && contact.company) {
        const profile = await this.searchProfile(contact.name, contact.company);
        if (profile) {
          return this.mergeLinkedInData(contact, profile);
        }
      }

      return contact;
    } catch (error) {
      console.error('Failed to enrich contact with LinkedIn:', error);
      return contact;
    }
  }

  /**
   * Get LinkedIn profile by email
   * @param {string} email - Email address
   * @returns {Promise<Object|null>} LinkedIn profile data
   */
  async getProfileByEmail(email) {
    try {
      const response = await fetch(`${this.apiBase}/profile/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Profile not found
        }
        throw new Error(`Failed to get LinkedIn profile: ${response.status}`);
      }

      const data = await response.json();
      return data.profile || data;
    } catch (error) {
      console.error('Failed to get LinkedIn profile:', error);
      return null;
    }
  }

  /**
   * Search for LinkedIn profile by name and company
   * @param {string} name - Full name
   * @param {string} company - Company name
   * @returns {Promise<Object|null>} LinkedIn profile data
   */
  async searchProfile(name, company) {
    try {
      const response = await fetch(`${this.apiBase}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          company: company
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to search LinkedIn: ${response.status}`);
      }

      const data = await response.json();
      return data.profile || (data.results && data.results[0]) || null;
    } catch (error) {
      console.error('Failed to search LinkedIn:', error);
      return null;
    }
  }

  /**
   * Get LinkedIn company data
   * @param {string} domain - Company domain or name
   * @returns {Promise<Object|null>} Company data
   */
  async getCompanyData(domain) {
    try {
      const response = await fetch(`${this.apiBase}/company/${encodeURIComponent(domain)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get company data: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get LinkedIn company data:', error);
      return null;
    }
  }

  /**
   * Get relationship suggestions (mutual connections, shared experiences)
   * @param {string} contactId - Contact ID
   * @param {Array} otherContacts - Other contacts to check relationships with
   * @returns {Promise<Array>} Array of relationship suggestions
   */
  async getRelationshipSuggestions(contactId, otherContacts = []) {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const response = await fetch(`${this.apiBase}/relationships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId: contactId,
          otherContactIds: otherContacts.map(c => c.id || c)
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get relationships: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeRelationships(data.results || data);
    } catch (error) {
      console.error('Failed to get relationship suggestions:', error);
      return [];
    }
  }

  /**
   * Merge LinkedIn data into contact object
   */
  mergeLinkedInData(contact, linkedinProfile) {
    return {
      ...contact,
      linkedin: {
        profileUrl: linkedinProfile.profileUrl || linkedinProfile.url,
        headline: linkedinProfile.headline,
        summary: linkedinProfile.summary,
        location: linkedinProfile.location,
        industry: linkedinProfile.industry,
        connections: linkedinProfile.connections,
        profilePicture: linkedinProfile.profilePicture || linkedinProfile.pictureUrl,
        verified: true,
        lastEnriched: new Date().toISOString()
      },
      // Enhance existing fields with LinkedIn data if missing
      title: contact.title || linkedinProfile.headline || '',
      location: contact.location || linkedinProfile.location || '',
      industry: contact.industry || linkedinProfile.industry || '',
      // Add experience data
      experience: linkedinProfile.experience || [],
      education: linkedinProfile.education || [],
      skills: linkedinProfile.skills || []
    };
  }

  /**
   * Normalize relationship suggestions
   */
  normalizeRelationships(relationships) {
    return relationships.map(rel => ({
      source: rel.sourceId || rel.source,
      target: rel.targetId || rel.target,
      type: this.determineRelationshipType(rel.type || rel.relationshipType),
      strength: rel.confidence || rel.strength || 0.5,
      confirmed: rel.confirmed || false,
      metadata: {
        source: 'linkedin',
        mutualConnections: rel.mutualConnections || 0,
        sharedCompanies: rel.sharedCompanies || [],
        sharedSchools: rel.sharedSchools || [],
        note: rel.note || ''
      }
    }));
  }

  /**
   * Determine relationship type from LinkedIn data
   */
  determineRelationshipType(type) {
    const typeMap = {
      'colleague': 'former_colleague',
      'school': 'alumni',
      'connection': 'connected',
      'mutual': 'mutual_connection'
    };
    return typeMap[type] || 'suggested';
  }

  /**
   * Batch enrich multiple contacts
   * @param {Array} contacts - Array of contacts to enrich
   * @returns {Promise<Array>} Array of enriched contacts
   */
  async enrichContacts(contacts) {
    if (!this.isConfigured()) {
      return contacts;
    }

    const enriched = [];
    for (const contact of contacts) {
      try {
        const enrichedContact = await this.enrichContact(contact);
        enriched.push(enrichedContact);
        // Rate limiting - wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to enrich contact ${contact.id}:`, error);
        enriched.push(contact); // Add original if enrichment fails
      }
    }

    return enriched;
  }

  /**
   * Check if contact has LinkedIn data
   */
  hasLinkedInData(contact) {
    return !!(contact.linkedin && contact.linkedin.verified);
  }
}

// Export singleton instance
window.linkedinService = new LinkedInService();




