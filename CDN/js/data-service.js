/**
 * Data Service Abstraction Layer
 * 
 * This service abstracts data access so we can easily swap in
 * proprietary lead systems later without changing UI code.
 */

class DataService {
  constructor() {
    // API endpoint - will be configurable later
    this.apiBase = '/api'; // Placeholder for now
  }

  /**
   * Check if HubSpot is configured and use it if available
   */
  async useHubSpotIfAvailable() {
    if (window.hubspotService && window.hubspotService.isConfigured()) {
      return true;
    }
    return false;
  }

  /**
   * Get all leads/deals for pipeline view
   * @returns {Promise<Array>} Array of leads/deals
   */
  async getPipeline() {
    // Try HubSpot first if configured
    if (await this.useHubSpotIfAvailable()) {
      try {
        const deals = await window.hubspotService.getDeals();
        return deals.map(deal => ({
          id: deal.id,
          name: deal.name,
          type: 'deal',
          stage: deal.stage,
          value: deal.value,
          probability: deal.probability,
          lastActivity: deal.metadata?.hubspotUpdatedAt || new Date().toISOString(),
          contacts: [], // Will be populated from associations
          nextCall: deal.closeDate || null
        }));
      } catch (error) {
        console.error('Failed to get pipeline from HubSpot, falling back to mock:', error);
      }
    }
    
    // Mock data for now - replace with API call later
    return new Promise((resolve) => {
      setTimeout(() => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        
        resolve([
          {
            id: '1',
            name: 'BitForge',
            type: 'deal',
            stage: 'qualified',
            value: 120000,
            probability: 45,
            lastActivity: threeDaysAgo.toISOString(),
            contacts: ['Sarah Johnson'],
            nextCall: null,
            warnings: ['A3']
          },
          {
            id: '2',
            name: 'ApexMind',
            type: 'deal',
            stage: 'qualified',
            value: 180000,
            probability: 60,
            lastActivity: twoDaysAgo.toISOString(),
            contacts: ['Michael Chen', 'Emily Rodriguez', 'David Lee'],
            nextCall: threeDaysLater.toISOString(),
            warnings: []
          },
          {
            id: '3',
            name: 'Exempla',
            type: 'deal',
            stage: 'negotiation',
            value: 250000,
            probability: 80,
            lastActivity: yesterday.toISOString(),
            contacts: ['John Smith', 'Alex Brown'],
            nextCall: tomorrow.toISOString(),
            warnings: []
          },
          {
            id: '4',
            name: 'Credax',
            type: 'deal',
            stage: 'negotiation',
            value: 320000,
            probability: 85,
            lastActivity: now.toISOString(),
            contacts: ['Sarah Johnson', 'Michael Chen', 'Emily Rodriguez'],
            nextCall: tomorrow.toISOString(),
            warnings: []
          },
          {
            id: '5',
            name: 'Acme Corporation',
            type: 'deal',
            stage: 'qualified',
            value: 250000,
            probability: 75,
            lastActivity: yesterday.toISOString(),
            contacts: ['Sarah Johnson', 'Michael Chen'],
            nextCall: threeDaysLater.toISOString(),
            warnings: []
          },
          {
            id: '6',
            name: 'TechStart Inc',
            type: 'lead',
            stage: 'new',
            value: 50000,
            probability: 30,
            lastActivity: threeDaysAgo.toISOString(),
            contacts: ['John Smith'],
            nextCall: null,
            warnings: []
          },
          {
            id: '7',
            name: 'Global Solutions',
            type: 'deal',
            stage: 'negotiation',
            value: 500000,
            probability: 90,
            lastActivity: now.toISOString(),
            contacts: ['Emily Rodriguez', 'David Lee', 'Sarah Johnson'],
            nextCall: tomorrow.toISOString(),
            warnings: []
          },
          {
            id: '8',
            name: 'StartupXYZ',
            type: 'lead',
            stage: 'contacted',
            value: 25000,
            probability: 20,
            lastActivity: twoDaysAgo.toISOString(),
            contacts: ['Alex Brown'],
            nextCall: null,
            warnings: []
          },
          {
            id: '9',
            name: 'DataFlow Systems',
            type: 'deal',
            stage: 'qualified',
            value: 150000,
            probability: 65,
            lastActivity: yesterday.toISOString(),
            contacts: ['Michael Chen', 'David Lee'],
            nextCall: threeDaysLater.toISOString(),
            warnings: []
          },
          {
            id: '10',
            name: 'CloudVault',
            type: 'deal',
            stage: 'closed',
            value: 180000,
            probability: 100,
            lastActivity: twoDaysAgo.toISOString(),
            contacts: ['Sarah Johnson', 'Emily Rodriguez'],
            nextCall: null,
            warnings: []
          },
          {
            id: '11',
            name: 'SecureNet',
            type: 'deal',
            stage: 'closed',
            value: 95000,
            probability: 0,
            lastActivity: threeDaysAgo.toISOString(),
            contacts: ['John Smith'],
            nextCall: null,
            warnings: []
          }
        ]);
      }, 300);
    });
  }

  /**
   * Get a specific lead/deal by ID
   * @param {string} id - Lead/Deal ID
   * @returns {Promise<Object>} Lead/Deal object
   */
  async getLeadDeal(id) {
    // Try HubSpot first if configured
    if (await this.useHubSpotIfAvailable()) {
      try {
        // Check if it's a HubSpot ID
        if (id.startsWith('hubspot_deal_')) {
          const hubspotId = id.replace('hubspot_deal_', '');
          const deals = await window.hubspotService.getDeals();
          const deal = deals.find(d => d.hubspotId === hubspotId);
          
          if (deal) {
            // Get associated contacts
            const contactIds = deal.contactIds || [];
            const contacts = [];
            for (const contactId of contactIds) {
              const contactData = await window.hubspotService.getContacts({
                filters: { ids: [contactId] }
              });
              if (contactData.length > 0) {
                contacts.push({
                  name: contactData[0].name,
                  role: contactData[0].title
                });
              }
            }

            // Get company data
            const companies = await window.hubspotService.getCompanies();
            const company = companies.find(c => c.hubspotId === deal.companyId);

            return {
              id: deal.id,
              name: company?.name || deal.name,
              type: 'deal',
              stage: deal.stage,
              value: deal.value,
              probability: deal.probability,
              industry: company?.industry || '',
              companySize: company?.companySize || '',
              location: company?.location || '',
              accountName: company?.name || deal.name,
              dealName: deal.name,
              dealStage: deal.stage,
              dealValue: `$${deal.value.toLocaleString()}`,
              dealProbability: `${deal.probability}%`,
              lastInteractionDate: deal.metadata?.hubspotUpdatedAt ? 
                this.formatDate(deal.metadata.hubspotUpdatedAt) : 'Unknown',
              lastInteractionSummary: 'Last updated in HubSpot',
              contacts: contacts,
              notes: [],
              meetingNumber: null,
              meetingPassword: null
            };
          }
        }
      } catch (error) {
        console.error('Failed to get lead/deal from HubSpot, falling back to mock:', error);
      }
    }

    // Mock data for now - replace with API call later
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockData = {
          id: id,
          name: 'Acme Corporation',
          type: 'deal',
          stage: 'qualified',
          value: 250000,
          probability: 75,
          industry: 'Technology',
          companySize: '500-1000 employees',
          location: 'San Francisco, CA',
          accountName: 'Acme Corporation',
          dealName: 'Q4 Enterprise License',
          dealStage: 'Negotiation',
          dealValue: '$250,000',
          dealProbability: '75%',
          lastInteractionDate: '2 weeks ago',
          lastInteractionSummary: 'Discussed pricing and implementation timeline. Client is evaluating our solution against competitor. Decision expected by end of month.',
          contacts: [
            { name: 'Sarah Johnson', role: 'VP of Engineering' },
            { name: 'Michael Chen', role: 'CTO' },
            { name: 'Emily Rodriguez', role: 'Procurement Manager' }
          ],
          notes: [
            'Address pricing concerns from last call',
            'Highlight ROI calculator results',
            'Discuss implementation support options',
            'Confirm decision timeline'
          ],
          meetingNumber: null, // Will be populated when meeting is scheduled
          meetingPassword: null
        };
        resolve(mockData);
      }, 200);
    });
  }

  /**
   * Update a lead/deal
   * @param {string} id - Lead/Deal ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated lead/deal
   */
  async updateLeadDeal(id, data) {
    // Mock implementation - replace with API call later
    console.log('Updating lead/deal:', id, data);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, id, ...data });
      }, 200);
    });
  }

  /**
   * Get active/upcoming calls
   * @returns {Promise<Array>} Array of calls
   */
  async getActiveCalls() {
    // Mock data for now
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            leadDealId: '1',
            leadDealName: 'Acme Corporation',
            scheduledTime: '2024-01-20T14:00:00Z',
            meetingNumber: '123456789',
            meetingPassword: 'abc123',
            participants: ['Sarah Johnson', 'Michael Chen']
          },
          {
            id: '2',
            leadDealId: '3',
            leadDealName: 'Global Solutions',
            scheduledTime: '2024-01-18T10:00:00Z',
            meetingNumber: '987654321',
            meetingPassword: 'xyz789',
            participants: ['Emily Rodriguez', 'David Lee']
          }
        ]);
      }, 200);
    });
  }

  /**
   * Get dashboard metrics
   * @returns {Promise<Object>} Dashboard metrics
   */
  async getDashboardMetrics() {
    // Mock data for now
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          totalLeads: 24,
          activeDeals: 8,
          totalValue: 1250000,
          callsThisWeek: 12,
          conversionRate: 33.3,
          avgDealSize: 156250
        });
      }, 200);
    });
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }
}

// Export singleton instance
window.dataService = new DataService();

