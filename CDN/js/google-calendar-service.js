/**
 * Google Calendar Service
 * 
 * Fetches and manages Google Calendar events
 * Requires Google OAuth authentication via google-service.js
 * 
 * Backend API endpoints expected:
 * - GET /api/google/calendar/events - Get calendar events
 * - GET /api/google/calendar/events/:eventId - Get specific event
 * - POST /api/google/calendar/events/:eventId/link-deal - Link event to deal
 * - GET /api/google/calendar/deals/:dealId/events - Get events for a deal
 */

class GoogleCalendarService {
  constructor() {
    // Backend API base URL
    this.apiBase = localStorage.getItem('google_api_base') || '/api/google';
    this.eventsCache = null;
    this.cacheExpiry = null;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if calendar service is available
   */
  isAvailable() {
    return window.googleService && window.googleService.hasCalendarAccess();
  }

  /**
   * Get calendar events
   * @param {Object} options - Query options
   * @param {Date} options.timeMin - Start time (default: now)
   * @param {Date} options.timeMax - End time (default: 7 days from now)
   * @param {number} options.maxResults - Max number of results
   * @param {boolean} options.useCache - Use cached results if available
   * @returns {Promise<Array>} Array of calendar events
   */
  async getEvents(options = {}) {
    if (!this.isAvailable()) {
      console.warn('Google Calendar not available - OAuth required');
      return this.getMockEvents();
    }

    // Check cache
    if (options.useCache !== false && this.eventsCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.eventsCache;
    }

    try {
      const params = new URLSearchParams();
      if (options.timeMin) {
        params.append('timeMin', options.timeMin.toISOString());
      } else {
        params.append('timeMin', new Date().toISOString());
      }
      
      if (options.timeMax) {
        params.append('timeMax', options.timeMax.toISOString());
      } else {
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        params.append('timeMax', weekFromNow.toISOString());
      }
      
      if (options.maxResults) {
        params.append('maxResults', options.maxResults);
      }

      const response = await fetch(`${this.apiBase}/calendar/events?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar events: ${response.status}`);
      }

      const data = await response.json();
      const events = this.normalizeEvents(data.items || data.events || data);
      
      // Cache results
      this.eventsCache = events;
      this.cacheExpiry = Date.now() + this.cacheTTL;
      
      return events;
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      return this.getMockEvents();
    }
  }

  /**
   * Get a specific calendar event
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event object
   */
  async getEvent(eventId) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const response = await fetch(`${this.apiBase}/calendar/events/${encodeURIComponent(eventId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch event: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeEvent(data);
    } catch (error) {
      console.error('Failed to get event:', error);
      return null;
    }
  }

  /**
   * Link a calendar event to a deal
   * @param {string} eventId - Event ID
   * @param {string} dealId - Deal ID
   * @returns {Promise<boolean>} Success status
   */
  async linkEventToDeal(eventId, dealId) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiBase}/calendar/events/${encodeURIComponent(eventId)}/link-deal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dealId })
      });

      if (!response.ok) {
        throw new Error(`Failed to link event: ${response.status}`);
      }

      // Invalidate cache
      this.eventsCache = null;
      
      return true;
    } catch (error) {
      console.error('Failed to link event to deal:', error);
      return false;
    }
  }

  /**
   * Get events associated with a deal
   * @param {string} dealId - Deal ID
   * @returns {Promise<Array>} Array of events
   */
  async getDealEvents(dealId) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const response = await fetch(`${this.apiBase}/calendar/deals/${encodeURIComponent(dealId)}/events`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deal events: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeEvents(data.events || data);
    } catch (error) {
      console.error('Failed to get deal events:', error);
      return [];
    }
  }

  /**
   * Extract Zoom meeting info from event
   * @param {Object} event - Calendar event
   * @returns {Object|null} Zoom meeting info or null
   */
  extractZoomMeeting(event) {
    const description = event.description || '';
    const location = event.location || '';
    const hangoutLink = event.hangoutLink || '';
    
    // Look for Zoom links
    const zoomPattern = /(?:zoom\.us\/j\/|zoom\.us\/join\/|zoom\.us\/meeting\/)([0-9]{9,11})/gi;
    const zoomPasswordPattern = /(?:pwd|password)[\s:=]+([a-zA-Z0-9]{6,})/gi;
    
    let meetingNumber = null;
    let password = null;
    
    // Check description and location
    const textToSearch = `${description} ${location} ${hangoutLink}`;
    const zoomMatch = zoomPattern.exec(textToSearch);
    if (zoomMatch) {
      meetingNumber = zoomMatch[1];
      const pwdMatch = zoomPasswordPattern.exec(textToSearch);
      if (pwdMatch) {
        password = pwdMatch[1];
      }
    }
    
    if (meetingNumber) {
      return {
        meetingNumber,
        password,
        joinUrl: `https://zoom.us/j/${meetingNumber}${password ? `?pwd=${password}` : ''}`
      };
    }
    
    return null;
  }

  /**
   * Match event to deal by attendees/description
   * @param {Object} event - Calendar event
   * @param {Array} deals - Array of deals
   * @returns {string|null} Deal ID if matched
   */
  matchEventToDeal(event, deals) {
    const eventText = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
    const attendees = (event.attendees || []).map(a => a.email?.toLowerCase()).filter(Boolean);
    
    for (const deal of deals) {
      // Check if deal name appears in event
      if (deal.name && eventText.includes(deal.name.toLowerCase())) {
        return deal.id;
      }
      
      // Check if any contact emails match attendees
      if (deal.contacts) {
        for (const contact of deal.contacts) {
          const contactEmail = (typeof contact === 'object' ? contact.email : '').toLowerCase();
          if (contactEmail && attendees.includes(contactEmail)) {
            return deal.id;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Normalize Google Calendar event to our format
   */
  normalizeEvent(event) {
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    
    return {
      id: event.id,
      summary: event.summary || 'No Title',
      description: event.description || '',
      location: event.location || '',
      start: start ? new Date(start) : null,
      end: end ? new Date(end) : null,
      attendees: (event.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName || a.email,
        responseStatus: a.responseStatus
      })),
      organizer: event.organizer ? {
        email: event.organizer.email,
        name: event.organizer.displayName || event.organizer.email
      } : null,
      hangoutLink: event.hangoutLink || null,
      zoomMeeting: this.extractZoomMeeting(event),
      dealId: event.extendedProperties?.private?.dealId || null,
      metadata: {
        googleEventId: event.id,
        htmlLink: event.htmlLink,
        status: event.status,
        created: event.created ? new Date(event.created) : null,
        updated: event.updated ? new Date(event.updated) : null
      }
    };
  }

  /**
   * Normalize array of events
   */
  normalizeEvents(events) {
    return events.map(event => this.normalizeEvent(event));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.eventsCache = null;
    this.cacheExpiry = null;
  }

  /**
   * Mock events for development/testing
   */
  getMockEvents() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(10, 0, 0, 0);
    
    return [
      {
        id: 'mock_event_1',
        summary: 'Demo Call with Acme Corp',
        description: 'Product demo for Acme Corporation. Zoom: https://zoom.us/j/123456789?pwd=abc123',
        location: 'Zoom',
        start: tomorrow,
        end: new Date(tomorrow.getTime() + 60 * 60 * 1000),
        attendees: [
          { email: 'sarah@acme.com', name: 'Sarah Johnson', responseStatus: 'accepted' }
        ],
        zoomMeeting: {
          meetingNumber: '123456789',
          password: 'abc123',
          joinUrl: 'https://zoom.us/j/123456789?pwd=abc123'
        },
        dealId: null
      },
      {
        id: 'mock_event_2',
        summary: 'Follow-up Meeting - Dunder Mifflin',
        description: 'Quarterly review discussion',
        location: 'Zoom',
        start: dayAfter,
        end: new Date(dayAfter.getTime() + 30 * 60 * 1000),
        attendees: [
          { email: 'jim@dundermifflin.com', name: 'Jim Halpert', responseStatus: 'accepted' }
        ],
        zoomMeeting: null,
        dealId: null
      }
    ];
  }
}

// Export singleton instance
window.googleCalendarService = new GoogleCalendarService();

