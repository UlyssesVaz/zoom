/**
 * HubSpot CRM Service
 * 
 * Handles importing contacts, deals, companies, and relationships from HubSpot
 * Designed to work with a backend service that handles OAuth and API calls
 * 
 * Backend API endpoints expected:
 * - POST /api/hubspot/sync - Trigger sync from HubSpot
 * - GET /api/hubspot/contacts - Get contacts
 * - GET /api/hubspot/deals - Get deals
 * - GET /api/hubspot/companies - Get companies
 * - GET /api/hubspot/associations/:objectType/:objectId/:toObjectType - Get associations
 * - GET /api/hubspot/contacts/:id - Get specific contact
 * - GET /api/hubspot/deals/:id - Get specific deal
 */

class HubSpotService {
  constructor() {
    // Backend API base URL - configure via settings
    this.apiBase = localStorage.getItem('hubspot_api_base') || '/api/hubspot';
    this.syncInProgress = false;
    this.lastSyncTime = localStorage.getItem('hubspot_last_sync') || null;
  }

  /**
   * Check if HubSpot is configured
   */
  isConfigured() {
    return !!localStorage.getItem('hubspot_configured');
  }

  /**
   * Set configuration (called from settings page after OAuth)
   */
  setConfigured(configured = true) {
    localStorage.setItem('hubspot_configured', configured ? 'true' : '');
  }

  /**
   * Trigger sync from HubSpot (via backend)
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncFromHubSpot(options = {}) {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    try {
      const response = await fetch(`${this.apiBase}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncContacts: options.syncContacts !== false,
          syncDeals: options.syncDeals !== false,
          syncCompanies: options.syncCompanies !== false,
          syncAssociations: options.syncAssociations !== false,
          fullSync: options.fullSync || false
        })
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('hubspot_last_sync', this.lastSyncTime);

      return result;
    } catch (error) {
      console.error('HubSpot sync error:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get all contacts from HubSpot (via backend)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of contacts
   */
  async getContacts(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.after) params.append('after', filters.after);
      if (filters.properties) params.append('properties', filters.properties.join(','));

      const response = await fetch(`${this.apiBase}/contacts?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeContacts(data.results || data);
    } catch (error) {
      console.error('Failed to get contacts:', error);
      // Return mock data if backend not available
      return this.getMockContacts();
    }
  }

  /**
   * Get all deals from HubSpot (via backend)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of deals
   */
  async getDeals(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.after) params.append('after', filters.after);
      if (filters.properties) params.append('properties', filters.properties.join(','));

      const response = await fetch(`${this.apiBase}/deals?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deals: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeDeals(data.results || data);
    } catch (error) {
      console.error('Failed to get deals:', error);
      return this.getMockDeals();
    }
  }

  /**
   * Get all companies from HubSpot (via backend)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of companies
   */
  async getCompanies(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.after) params.append('after', filters.after);

      const response = await fetch(`${this.apiBase}/companies?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch companies: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeCompanies(data.results || data);
    } catch (error) {
      console.error('Failed to get companies:', error);
      return this.getMockCompanies();
    }
  }

  /**
   * Get associations (relationships) between objects
   * @param {string} objectType - Source object type (contacts, deals, companies)
   * @param {string} objectId - Source object ID
   * @param {string} toObjectType - Target object type
   * @returns {Promise<Array>} Array of associated object IDs
   */
  async getAssociations(objectType, objectId, toObjectType) {
    try {
      const response = await fetch(
        `${this.apiBase}/associations/${objectType}/${objectId}/${toObjectType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch associations: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Failed to get associations:', error);
      return [];
    }
  }

  /**
   * Get organizational relationships (who reports to whom)
   * Uses HubSpot custom properties like "reports_to" or "manager"
   * @param {string} companyId - Company ID
   * @returns {Promise<Array>} Array of relationship objects
   */
  async getOrgRelationships(companyId) {
    try {
      // Get all contacts for this company
      const contacts = await this.getContacts({
        filters: { companyId }
      });

      const relationships = [];

      // Extract reporting relationships from contact properties
      contacts.forEach(contact => {
        if (contact.reportsTo || contact.managerId) {
          relationships.push({
            source: contact.id,
            target: contact.reportsTo || contact.managerId,
            type: 'reports_to',
            strength: 0.9,
            confirmed: true,
            source: 'hubspot',
            metadata: {
              lastVerified: new Date().toISOString()
            }
          });
        }
      });

      return relationships;
    } catch (error) {
      console.error('Failed to get org relationships:', error);
      return [];
    }
  }

  /**
   * Get interaction history for a contact
   * @param {string} contactId - Contact ID
   * @returns {Promise<Array>} Array of interactions
   */
  async getContactInteractions(contactId) {
    try {
      const response = await fetch(`${this.apiBase}/contacts/${contactId}/interactions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch interactions: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeInteractions(data.results || data);
    } catch (error) {
      console.error('Failed to get interactions:', error);
      return [];
    }
  }

  /**
   * Normalize HubSpot contact data to our format
   */
  normalizeContacts(contacts) {
    return contacts.map(contact => ({
      id: `hubspot_contact_${contact.id}`,
      hubspotId: contact.id,
      name: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim(),
      firstName: contact.properties?.firstname || '',
      lastName: contact.properties?.lastname || '',
      email: contact.properties?.email || '',
      phone: contact.properties?.phone || '',
      title: contact.properties?.jobtitle || '',
      company: contact.properties?.company || '',
      companyId: contact.associations?.companies?.results?.[0]?.id,
      reportsTo: contact.properties?.reports_to || contact.properties?.manager_id,
      managerId: contact.properties?.manager_id,
      role: this.determineRole(contact.properties?.jobtitle || ''),
      metadata: {
        hubspotCreatedAt: contact.createdAt,
        hubspotUpdatedAt: contact.updatedAt,
        dealCount: contact.associations?.deals?.results?.length || 0,
        lastInteraction: contact.properties?.last_contacted_date || null
      }
    }));
  }

  /**
   * Normalize HubSpot deal data to our format
   */
  normalizeDeals(deals) {
    return deals.map(deal => ({
      id: `hubspot_deal_${deal.id}`,
      hubspotId: deal.id,
      name: deal.properties?.dealname || 'Unnamed Deal',
      value: parseFloat(deal.properties?.amount || 0),
      stage: deal.properties?.dealstage || '',
      probability: parseFloat(deal.properties?.pipeline || 0),
      closeDate: deal.properties?.closedate || null,
      companyId: deal.associations?.companies?.results?.[0]?.id,
      contactIds: deal.associations?.contacts?.results?.map(c => c.id) || [],
      metadata: {
        hubspotCreatedAt: deal.createdAt,
        hubspotUpdatedAt: deal.updatedAt,
        dealType: deal.properties?.dealtype || ''
      }
    }));
  }

  /**
   * Normalize HubSpot company data to our format
   */
  normalizeCompanies(companies) {
    return companies.map(company => ({
      id: `hubspot_company_${company.id}`,
      hubspotId: company.id,
      name: company.properties?.name || 'Unnamed Company',
      industry: company.properties?.industry || '',
      companySize: company.properties?.numberofemployees || '',
      location: [
        company.properties?.city,
        company.properties?.state,
        company.properties?.country
      ].filter(Boolean).join(', '),
      website: company.properties?.website || '',
      metadata: {
        hubspotCreatedAt: company.createdAt,
        hubspotUpdatedAt: company.updatedAt
      }
    }));
  }

  /**
   * Normalize interaction data
   */
  normalizeInteractions(interactions) {
    return interactions.map(interaction => ({
      id: `hubspot_int_${interaction.id}`,
      contactId: interaction.contactId,
      type: this.determineInteractionType(interaction.type || interaction.properties?.hs_activity_type),
      date: interaction.createdAt || interaction.properties?.hs_timestamp,
      duration: interaction.properties?.duration || null,
      subject: interaction.properties?.hs_activity_subject || '',
      notes: interaction.properties?.hs_note_body || '',
      metadata: {
        hubspotId: interaction.id,
        source: 'hubspot'
      }
    }));
  }

  /**
   * Determine role from job title
   */
  determineRole(title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('ceo') || titleLower.includes('chief executive')) return 'decision_maker';
    if (titleLower.includes('cto') || titleLower.includes('chief technology')) return 'decision_maker';
    if (titleLower.includes('cfo') || titleLower.includes('chief financial')) return 'decision_maker';
    if (titleLower.includes('vp') || titleLower.includes('vice president')) return 'decision_maker';
    if (titleLower.includes('director')) return 'influencer';
    if (titleLower.includes('manager')) return 'influencer';
    return 'end_user';
  }

  /**
   * Determine interaction type from HubSpot activity type
   */
  determineInteractionType(activityType) {
    const typeMap = {
      'CALL': 'call',
      'EMAIL': 'email',
      'MEETING': 'meeting',
      'NOTE': 'note',
      'TASK': 'task'
    };
    return typeMap[activityType] || 'other';
  }

  /**
   * Mock data for development/testing
   */
  getMockContacts() {
    return [
      {
        id: 'hubspot_contact_1',
        hubspotId: '1',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@acme.com',
        title: 'VP of Engineering',
        company: 'Acme Corporation',
        role: 'decision_maker'
      }
    ];
  }

  getMockDeals() {
    return [
      {
        id: 'hubspot_deal_1',
        hubspotId: '1',
        name: 'Q4 Enterprise License',
        value: 250000,
        stage: 'negotiation',
        probability: 75
      }
    ];
  }

  getMockCompanies() {
    return [
      {
        id: 'hubspot_company_1',
        hubspotId: '1',
        name: 'Acme Corporation',
        industry: 'Technology',
        companySize: '500-1000 employees'
      }
    ];
  }
}

// Export singleton instance
window.hubspotService = new HubSpotService();




