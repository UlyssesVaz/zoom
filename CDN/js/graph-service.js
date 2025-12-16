/**
 * Social Graph Service
 * 
 * Manages relationship mapping, influence scoring, and graph data
 * Works with mock data now, ready for backend integration later
 */

class GraphService {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.interactions = [];
    this.initialized = false;
  }

  /**
   * Initialize graph with CRM data
   * In production, this would fetch from backend/CRM
   */
  async initialize() {
    if (this.initialized) return;

    // Try to load from HubSpot first if configured
    if (window.hubspotService && window.hubspotService.isConfigured()) {
      try {
        await this.loadFromHubSpot();
        // Enrich with LinkedIn if available
        if (window.linkedinService && window.linkedinService.isConfigured()) {
          await this.enrichWithLinkedIn();
        }
      } catch (error) {
        console.error('Failed to load from HubSpot, using mock data:', error);
        this.loadMockGraphData();
      }
    } else {
      // Load mock graph data
      this.loadMockGraphData();
    }

    // Calculate influence scores
    this.calculateInfluenceScores();
    this.initialized = true;
  }

  /**
   * Load graph data from HubSpot
   */
  async loadFromHubSpot() {
    // Get contacts, deals, and companies
    const [contacts, deals, companies] = await Promise.all([
      window.hubspotService.getContacts(),
      window.hubspotService.getDeals(),
      window.hubspotService.getCompanies()
    ]);

    // Convert to nodes
    this.nodes = [];

    // Add contacts
    contacts.forEach(contact => {
      this.nodes.push({
        id: contact.id,
        type: 'contact',
        name: contact.name,
        title: contact.title,
        company: contact.company,
        email: contact.email,
        phone: contact.phone,
        influenceScore: 0, // Will be calculated
        role: contact.role,
        hubspotId: contact.hubspotId,
        reportsTo: contact.reportsTo,
        managerId: contact.managerId,
        metadata: {
          dealCount: contact.metadata?.dealCount || 0,
          interactionCount: 0, // Will be updated from interactions
          lastInteraction: contact.metadata?.lastInteraction || null
        }
      });
    });

    // Add companies
    companies.forEach(company => {
      this.nodes.push({
        id: company.id,
        type: 'account',
        name: company.name,
        industry: company.industry,
        size: company.companySize,
        location: company.location,
        website: company.website,
        hubspotId: company.hubspotId
      });
    });

    // Add deals
    deals.forEach(deal => {
      this.nodes.push({
        id: deal.id,
        type: 'deal',
        name: deal.name,
        value: deal.value,
        stage: deal.stage,
        hubspotId: deal.hubspotId
      });
    });

    // Build edges/relationships
    this.edges = [];

    // Add organizational relationships
    for (const contact of contacts) {
      if (contact.reportsTo || contact.managerId) {
        const managerId = contact.reportsTo || contact.managerId;
        const manager = contacts.find(c => c.id === managerId || c.hubspotId === managerId);
        
        if (manager) {
          this.edges.push({
            id: `edge_${contact.id}_reports_${manager.id}`,
            source: contact.id,
            target: manager.id,
            type: 'reports_to',
            strength: 0.9,
            confirmed: true,
            metadata: {
              source: 'hubspot',
              lastVerified: new Date().toISOString()
            }
          });
        }
      }

      // Add works_at relationship
      if (contact.companyId) {
        const company = companies.find(c => c.hubspotId === contact.companyId);
        if (company) {
          this.edges.push({
            id: `edge_${contact.id}_works_at_${company.id}`,
            source: contact.id,
            target: company.id,
            type: 'works_at',
            strength: 1.0,
            confirmed: true
          });
        }
      }
    }

    // Add deal relationships
    for (const deal of deals) {
      // Deal belongs to company
      if (deal.companyId) {
        const company = companies.find(c => c.hubspotId === deal.companyId);
        if (company) {
          this.edges.push({
            id: `edge_${deal.id}_belongs_to_${company.id}`,
            source: deal.id,
            target: company.id,
            type: 'belongs_to',
            strength: 1.0,
            confirmed: true
          });
        }
      }

      // Contacts associated with deal
      for (const contactId of deal.contactIds || []) {
        const contact = contacts.find(c => c.hubspotId === contactId);
        if (contact) {
          // Determine relationship type based on contact role
          const relationshipType = contact.role === 'decision_maker' ? 
            'decision_maker_for' : 'influencer_for';
          
          this.edges.push({
            id: `edge_${contact.id}_${relationshipType}_${deal.id}`,
            source: contact.id,
            target: deal.id,
            type: relationshipType,
            strength: contact.role === 'decision_maker' ? 0.95 : 0.7,
            confirmed: true
          });
        }
      }
    }

    // Load interaction history
    await this.loadInteractionHistory();
  }

  /**
   * Enrich contacts with LinkedIn data
   */
  async enrichWithLinkedIn() {
    if (!window.linkedinService || !window.linkedinService.isConfigured()) {
      return;
    }

    const contacts = this.nodes.filter(n => n.type === 'contact');
    
    for (const contact of contacts) {
      try {
        const enriched = await window.linkedinService.enrichContact(contact);
        
        // Update contact with LinkedIn data
        Object.assign(contact, enriched);
        
        // Add LinkedIn-suggested relationships
        if (enriched.linkedin && enriched.linkedin.verified) {
          const suggestions = await window.linkedinService.getRelationshipSuggestions(
            contact.id,
            contacts.filter(c => c.id !== contact.id)
          );
          
          // Add suggested relationships as unconfirmed edges
          for (const suggestion of suggestions) {
            // Check if edge already exists
            const exists = this.edges.find(e =>
              (e.source === suggestion.source && e.target === suggestion.target) ||
              (e.source === suggestion.target && e.target === suggestion.source)
            );
            
            if (!exists) {
              this.edges.push({
                id: `edge_linkedin_${suggestion.source}_${suggestion.target}`,
                source: suggestion.source,
                target: suggestion.target,
                type: suggestion.type,
                strength: suggestion.strength,
                confirmed: false,
                metadata: suggestion.metadata
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to enrich contact ${contact.id} with LinkedIn:`, error);
      }
    }
  }

  /**
   * Load interaction history from HubSpot
   */
  async loadInteractionHistory() {
    if (!window.hubspotService || !window.hubspotService.isConfigured()) {
      return;
    }

    const contacts = this.nodes.filter(n => n.type === 'contact');
    
    for (const contact of contacts) {
      if (contact.hubspotId) {
        try {
          const interactions = await window.hubspotService.getContactInteractions(
            contact.hubspotId
          );
          
          // Add interactions to our tracking
          interactions.forEach(interaction => {
            this.interactions.push({
              id: interaction.id,
              contactId: contact.id,
              type: interaction.type,
              date: interaction.date,
              duration: interaction.duration,
              subject: interaction.subject,
              notes: interaction.notes,
              metadata: {
                ...interaction.metadata,
                source: 'hubspot'
              }
            });
          });

          // Update contact metadata
          if (interactions.length > 0) {
            contact.metadata.interactionCount = interactions.length;
            contact.metadata.lastInteraction = interactions[0].date;
          }
        } catch (error) {
          console.error(`Failed to load interactions for contact ${contact.id}:`, error);
        }
      }
    }
  }

  /**
   * Load mock graph data (replace with API call later)
   */
  loadMockGraphData() {
    // Mock contacts/nodes
    this.nodes = [
      {
        id: 'contact_1',
        type: 'contact',
        name: 'Sarah Johnson',
        title: 'VP of Engineering',
        company: 'Acme Corporation',
        email: 'sarah.johnson@acme.com',
        influenceScore: 0, // Will be calculated
        role: 'decision_maker',
        metadata: {
          dealCount: 2,
          interactionCount: 15,
          lastInteraction: '2024-01-15'
        }
      },
      {
        id: 'contact_2',
        type: 'contact',
        name: 'Michael Chen',
        title: 'CTO',
        company: 'Acme Corporation',
        email: 'michael.chen@acme.com',
        influenceScore: 0,
        role: 'decision_maker',
        metadata: {
          dealCount: 1,
          interactionCount: 8,
          lastInteraction: '2024-01-10'
        }
      },
      {
        id: 'contact_3',
        type: 'contact',
        name: 'Emily Rodriguez',
        title: 'Procurement Manager',
        company: 'Acme Corporation',
        email: 'emily.rodriguez@acme.com',
        influenceScore: 0,
        role: 'influencer',
        metadata: {
          dealCount: 1,
          interactionCount: 5,
          lastInteraction: '2024-01-08'
        }
      },
      {
        id: 'contact_4',
        type: 'contact',
        name: 'David Lee',
        title: 'Engineering Manager',
        company: 'Acme Corporation',
        email: 'david.lee@acme.com',
        influenceScore: 0,
        role: 'end_user',
        metadata: {
          dealCount: 0,
          interactionCount: 3,
          lastInteraction: '2024-01-05'
        }
      },
      {
        id: 'contact_5',
        type: 'contact',
        name: 'John Smith',
        title: 'CEO',
        company: 'TechStart Inc',
        email: 'john.smith@techstart.com',
        influenceScore: 0,
        role: 'decision_maker',
        metadata: {
          dealCount: 1,
          interactionCount: 4,
          lastInteraction: '2024-01-12'
        }
      },
      {
        id: 'account_1',
        type: 'account',
        name: 'Acme Corporation',
        industry: 'Technology',
        size: '500-1000 employees'
      },
      {
        id: 'account_2',
        type: 'account',
        name: 'TechStart Inc',
        industry: 'Technology',
        size: '100-500 employees'
      },
      {
        id: 'deal_1',
        type: 'deal',
        name: 'Q4 Enterprise License',
        value: 250000,
        stage: 'negotiation'
      },
      {
        id: 'deal_2',
        type: 'deal',
        name: 'Q1 Starter Package',
        value: 50000,
        stage: 'qualified'
      }
    ];

    // Mock relationships/edges
    this.edges = [
      // Organizational relationships
      {
        id: 'edge_1',
        source: 'contact_2', // Michael Chen (CTO)
        target: 'contact_1', // Sarah Johnson (VP Engineering)
        type: 'reports_to',
        strength: 0.9,
        confirmed: true,
        metadata: {
          source: 'hubspot',
          lastVerified: '2024-01-15'
        }
      },
      {
        id: 'edge_2',
        source: 'contact_1', // Sarah Johnson
        target: 'contact_4', // David Lee
        type: 'manages',
        strength: 0.85,
        confirmed: true
      },
      {
        id: 'edge_3',
        source: 'contact_1', // Sarah Johnson
        target: 'contact_3', // Emily Rodriguez
        type: 'works_with',
        strength: 0.7,
        confirmed: true,
        metadata: {
          interactionCount: 8,
          lastInteraction: '2024-01-10'
        }
      },
      // Deal relationships
      {
        id: 'edge_4',
        source: 'contact_1', // Sarah Johnson
        target: 'deal_1', // Q4 Enterprise License
        type: 'decision_maker_for',
        strength: 0.95,
        confirmed: true
      },
      {
        id: 'edge_5',
        source: 'contact_2', // Michael Chen
        target: 'deal_1',
        type: 'influencer_for',
        strength: 0.8,
        confirmed: true
      },
      {
        id: 'edge_6',
        source: 'contact_3', // Emily Rodriguez
        target: 'deal_1',
        type: 'influencer_for',
        strength: 0.6,
        confirmed: true
      },
      {
        id: 'edge_7',
        source: 'contact_5', // John Smith
        target: 'deal_2',
        type: 'decision_maker_for',
        strength: 0.9,
        confirmed: true
      },
      // Account relationships
      {
        id: 'edge_8',
        source: 'contact_1',
        target: 'account_1',
        type: 'works_at',
        strength: 1.0,
        confirmed: true
      },
      {
        id: 'edge_9',
        source: 'contact_2',
        target: 'account_1',
        type: 'works_at',
        strength: 1.0,
        confirmed: true
      },
      {
        id: 'edge_10',
        source: 'contact_3',
        target: 'account_1',
        type: 'works_at',
        strength: 1.0,
        confirmed: true
      },
      {
        id: 'edge_11',
        source: 'contact_4',
        target: 'account_1',
        type: 'works_at',
        strength: 1.0,
        confirmed: true
      },
      {
        id: 'edge_12',
        source: 'contact_5',
        target: 'account_2',
        type: 'works_at',
        strength: 1.0,
        confirmed: true
      },
      {
        id: 'edge_13',
        source: 'deal_1',
        target: 'account_1',
        type: 'belongs_to',
        strength: 1.0,
        confirmed: true
      },
      {
        id: 'edge_14',
        source: 'deal_2',
        target: 'account_2',
        type: 'belongs_to',
        strength: 1.0,
        confirmed: true
      },
      // Cross-account relationship (former colleague)
      {
        id: 'edge_15',
        source: 'contact_1', // Sarah Johnson
        target: 'contact_5', // John Smith
        type: 'former_colleague',
        strength: 0.5,
        confirmed: false, // Unconfirmed
        metadata: {
          source: 'linkedin_suggestion',
          note: 'Worked together at previous company'
        }
      }
    ];

    // Mock interactions
    this.interactions = [
      { id: 'int_1', contactId: 'contact_1', type: 'call', date: '2024-01-15', duration: 30 },
      { id: 'int_2', contactId: 'contact_1', type: 'email', date: '2024-01-14' },
      { id: 'int_3', contactId: 'contact_2', type: 'call', date: '2024-01-10', duration: 45 },
      { id: 'int_4', contactId: 'contact_3', type: 'meeting', date: '2024-01-08', duration: 60 },
      { id: 'int_5', contactId: 'contact_1', type: 'call', date: '2024-01-05', duration: 20 }
    ];

    // Calculate influence scores
    this.calculateInfluenceScores();
  }

  /**
   * Calculate influence scores for all contacts
   */
  calculateInfluenceScores() {
    this.nodes.forEach(node => {
      if (node.type === 'contact') {
        node.influenceScore = this.calculateContactInfluence(node.id);
      }
    });
  }

  /**
   * Calculate influence score for a specific contact
   */
  calculateContactInfluence(contactId) {
    const contact = this.nodes.find(n => n.id === contactId);
    if (!contact || contact.type !== 'contact') return 0;

    let score = 0;

    // 1. Role-based score (30 points max)
    const roleScores = {
      'ceo': 30,
      'cto': 25,
      'cfo': 25,
      'vp': 20,
      'director': 15,
      'manager': 10,
      'other': 5
    };

    const title = (contact.title || '').toLowerCase();
    for (const [role, points] of Object.entries(roleScores)) {
      if (title.includes(role)) {
        score += points;
        break;
      }
    }

    // 2. Deal influence (20 points max)
    const dealEdges = this.edges.filter(e => 
      e.source === contactId && e.type.includes('deal')
    );
    score += Math.min(dealEdges.length * 10, 20);

    // 3. Relationship strength (20 points max)
    const strongRelationships = this.edges.filter(e =>
      (e.source === contactId || e.target === contactId) &&
      e.type !== 'works_at' &&
      e.type !== 'belongs_to' &&
      e.strength >= 0.7
    );
    score += Math.min(strongRelationships.length * 3, 20);

    // 4. Interaction frequency (15 points max)
    const recentInteractions = this.interactions.filter(i => {
      const daysAgo = (new Date() - new Date(i.date)) / (1000 * 60 * 60 * 24);
      return i.contactId === contactId && daysAgo <= 90;
    });
    score += Math.min(recentInteractions.length * 2, 15);

    // 5. Network centrality (15 points max)
    const connections = this.edges.filter(e =>
      (e.source === contactId || e.target === contactId) &&
      e.type !== 'works_at' &&
      e.type !== 'belongs_to'
    ).length;
    score += Math.min(connections * 1.5, 15);

    return Math.min(Math.round(score), 100);
  }

  /**
   * Get graph data for visualization
   */
  getGraphData(filter = {}) {
    let nodes = [...this.nodes];
    let edges = [...this.edges];

    // Apply filters
    if (filter.accountId) {
      const accountContacts = edges
        .filter(e => e.target === filter.accountId && e.type === 'works_at')
        .map(e => e.source);
      nodes = nodes.filter(n => accountContacts.includes(n.id) || n.id === filter.accountId);
      edges = edges.filter(e => 
        accountContacts.includes(e.source) || 
        accountContacts.includes(e.target) ||
        e.source === filter.accountId ||
        e.target === filter.accountId
      );
    }

    if (filter.dealId) {
      const dealContacts = edges
        .filter(e => e.target === filter.dealId && e.type.includes('deal'))
        .map(e => e.source);
      nodes = nodes.filter(n => dealContacts.includes(n.id) || n.id === filter.dealId);
      edges = edges.filter(e =>
        dealContacts.includes(e.source) ||
        dealContacts.includes(e.target) ||
        e.source === filter.dealId ||
        e.target === filter.dealId
      );
    }

    if (filter.minInfluence) {
      nodes = nodes.filter(n => 
        n.type !== 'contact' || n.influenceScore >= filter.minInfluence
      );
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    }

    return { nodes, edges };
  }

  /**
   * Get contacts for an account
   */
  getAccountContacts(accountId) {
    const contactIds = this.edges
      .filter(e => e.target === accountId && e.type === 'works_at')
      .map(e => e.source);
    
    return this.nodes.filter(n => contactIds.includes(n.id));
  }

  /**
   * Get relationships for a contact
   */
  getContactRelationships(contactId) {
    return this.edges.filter(e =>
      e.source === contactId || e.target === contactId
    ).map(edge => {
      const otherId = edge.source === contactId ? edge.target : edge.source;
      const otherNode = this.nodes.find(n => n.id === otherId);
      return {
        ...edge,
        otherNode,
        direction: edge.source === contactId ? 'outgoing' : 'incoming'
      };
    });
  }

  /**
   * Find path between two contacts
   */
  findPath(sourceId, targetId, maxDepth = 3) {
    const visited = new Set();
    const queue = [[sourceId, [sourceId]]];

    while (queue.length > 0) {
      const [currentId, path] = queue.shift();

      if (currentId === targetId) {
        return path.map(id => this.nodes.find(n => n.id === id));
      }

      if (path.length > maxDepth) continue;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const neighbors = this.edges
        .filter(e => 
          (e.source === currentId || e.target === currentId) &&
          e.type !== 'works_at' &&
          e.type !== 'belongs_to'
        )
        .map(e => e.source === currentId ? e.target : e.source);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push([neighbor, [...path, neighbor]]);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get influence recommendations
   */
  getInfluenceRecommendations(dealId) {
    const dealContacts = this.edges
      .filter(e => e.target === dealId && e.type.includes('deal'))
      .map(e => ({ contactId: e.source, strength: e.strength, type: e.type }));

    const recommendations = [];

    // Find contacts with high influence but low engagement
    dealContacts.forEach(({ contactId, strength }) => {
      const contact = this.nodes.find(n => n.id === contactId);
      if (contact && contact.influenceScore > 70 && strength < 0.7) {
        recommendations.push({
          type: 'strengthen_relationship',
          contact,
          reason: 'High influence but low relationship strength',
          priority: 'high'
        });
      }
    });

    // Find missing key relationships
    const accountId = this.edges.find(e => e.target === dealId && e.type === 'belongs_to')?.source;
    if (accountId) {
      const accountContacts = this.getAccountContacts(accountId);
      const connectedContacts = new Set(dealContacts.map(dc => dc.contactId));
      
      accountContacts.forEach(contact => {
        if (!connectedContacts.has(contact.id) && contact.influenceScore > 60) {
          recommendations.push({
            type: 'engage_contact',
            contact,
            reason: 'Key contact at account but not engaged in deal',
            priority: 'medium'
          });
        }
      });
    }

    return recommendations;
  }

  /**
   * Track an interaction
   */
  trackInteraction(contactId, type, metadata = {}) {
    const interaction = {
      id: `int_${Date.now()}`,
      contactId,
      type, // 'call', 'email', 'meeting', 'note', 'task'
      date: new Date().toISOString(),
      duration: metadata.duration || null,
      subject: metadata.subject || '',
      notes: metadata.notes || '',
      dealId: metadata.dealId || null,
      completed: metadata.completed !== false,
      ...metadata
    };

    this.interactions.push(interaction);

    // Update contact metadata
    const contact = this.nodes.find(n => n.id === contactId && n.type === 'contact');
    if (contact) {
      contact.metadata.interactionCount = (contact.metadata.interactionCount || 0) + 1;
      contact.metadata.lastInteraction = interaction.date;
    }

    // Update relationship strength based on interaction
    this.updateRelationshipStrength(contactId, type, metadata);

    // Recalculate influence scores
    this.calculateInfluenceScores();

    // Sync to HubSpot if configured (via backend)
    if (window.hubspotService && window.hubspotService.isConfigured() && contact?.hubspotId) {
      this.syncInteractionToHubSpot(contact.hubspotId, interaction).catch(error => {
        console.error('Failed to sync interaction to HubSpot:', error);
      });
    }

    return interaction;
  }

  /**
   * Sync interaction to HubSpot (via backend)
   */
  async syncInteractionToHubSpot(hubspotContactId, interaction) {
    try {
      // This would call your backend API to create/update HubSpot activity
      const response = await fetch('/api/hubspot/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId: hubspotContactId,
          type: interaction.type,
          date: interaction.date,
          duration: interaction.duration,
          subject: interaction.subject,
          notes: interaction.notes
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to sync interaction: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to sync interaction to HubSpot:', error);
      throw error;
    }
  }

  /**
   * Update relationship strength based on interaction
   */
  updateRelationshipStrength(contactId, interactionType, metadata = {}) {
    // Find edges involving this contact
    const contactEdges = this.edges.filter(e =>
      (e.source === contactId || e.target === contactId) &&
      e.type !== 'works_at' &&
      e.type !== 'belongs_to'
    );

    contactEdges.forEach(edge => {
      // Increase strength based on interaction type and quality
      let increase = 0;
      
      switch (interactionType) {
        case 'call':
          // Longer calls = stronger relationship
          const callDuration = metadata.duration || 0;
          increase = 0.02 + (callDuration > 30 ? 0.03 : 0); // Base + bonus for long calls
          break;
        case 'meeting':
          increase = 0.04; // Meetings are more valuable
          break;
        case 'email':
          increase = 0.01; // Emails are less impactful
          break;
        default:
          increase = 0.005;
      }

      // If interaction was completed successfully, add bonus
      if (metadata.completed !== false) {
        increase *= 1.2;
      }

      edge.strength = Math.min(edge.strength + increase, 1.0);
      
      // Update last interaction timestamp in edge metadata
      if (!edge.metadata) {
        edge.metadata = {};
      }
      edge.metadata.lastInteraction = new Date().toISOString();
      edge.metadata.interactionCount = (edge.metadata.interactionCount || 0) + 1;
    });
  }

  /**
   * Get org chart for an account
   */
  getOrgChart(accountId) {
    const contacts = this.getAccountContacts(accountId);
    const orgEdges = this.edges.filter(e =>
      contacts.some(c => c.id === e.source || c.id === e.target) &&
      (e.type === 'reports_to' || e.type === 'manages')
    );

    // Build hierarchy
    const hierarchy = {};
    contacts.forEach(contact => {
      hierarchy[contact.id] = {
        contact,
        reportsTo: null,
        manages: [],
        level: 0 // Hierarchy level (0 = top, increases going down)
      };
    });

    orgEdges.forEach(edge => {
      if (edge.type === 'reports_to') {
        hierarchy[edge.source].reportsTo = edge.target;
        // Also add reverse relationship
        if (!hierarchy[edge.target].manages.includes(edge.source)) {
          hierarchy[edge.target].manages.push(edge.source);
        }
      } else if (edge.type === 'manages') {
        if (!hierarchy[edge.source].manages.includes(edge.target)) {
          hierarchy[edge.source].manages.push(edge.target);
        }
        // Also add reverse relationship
        hierarchy[edge.target].reportsTo = edge.source;
      }
    });

    // Calculate hierarchy levels
    const calculateLevels = (contactId, visited = new Set()) => {
      if (visited.has(contactId)) return 0; // Circular reference
      visited.add(contactId);

      const node = hierarchy[contactId];
      if (!node.reportsTo) {
        return 0; // Top level
      }

      return calculateLevels(node.reportsTo, visited) + 1;
    };

    Object.keys(hierarchy).forEach(contactId => {
      hierarchy[contactId].level = calculateLevels(contactId);
    });

    return hierarchy;
  }

  /**
   * Get interaction history for a contact
   * @param {string} contactId - Contact ID
   * @param {Object} filters - Filter options (type, dateRange, etc.)
   * @returns {Array} Array of interactions
   */
  getContactInteractions(contactId, filters = {}) {
    let interactions = this.interactions.filter(i => i.contactId === contactId);

    // Apply filters
    if (filters.type) {
      interactions = interactions.filter(i => i.type === filters.type);
    }

    if (filters.dateRange) {
      const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
      const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
      
      interactions = interactions.filter(i => {
        const interactionDate = new Date(i.date);
        if (startDate && interactionDate < startDate) return false;
        if (endDate && interactionDate > endDate) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    interactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return interactions;
  }

  /**
   * Get interaction statistics for a contact
   * @param {string} contactId - Contact ID
   * @returns {Object} Statistics object
   */
  getInteractionStats(contactId) {
    const interactions = this.getContactInteractions(contactId);
    
    const stats = {
      total: interactions.length,
      byType: {},
      totalCallDuration: 0,
      lastInteraction: null,
      averageDaysBetween: null
    };

    interactions.forEach(interaction => {
      // Count by type
      stats.byType[interaction.type] = (stats.byType[interaction.type] || 0) + 1;
      
      // Sum call durations
      if (interaction.type === 'call' && interaction.duration) {
        stats.totalCallDuration += interaction.duration;
      }
    });

    if (interactions.length > 0) {
      stats.lastInteraction = interactions[0].date;
    }

    // Calculate average days between interactions
    if (interactions.length > 1) {
      let totalDays = 0;
      for (let i = 0; i < interactions.length - 1; i++) {
        const days = (new Date(interactions[i].date) - new Date(interactions[i + 1].date)) / (1000 * 60 * 60 * 24);
        totalDays += days;
      }
      stats.averageDaysBetween = Math.round(totalDays / (interactions.length - 1));
    }

    return stats;
  }
}

// Export singleton instance
window.graphService = new GraphService();

