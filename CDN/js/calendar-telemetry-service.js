/**
 * Calendar Telemetry Service
 * 
 * Tracks calendar invite opens, accepts, declines, and link clicks
 */

class CalendarTelemetryService {
  constructor() {
    this.apiBase = '/api/telemetry';
  }

  /**
   * Generate unique token for calendar tracking
   */
  generateToken(eventId) {
    return btoa(`${eventId}_${Date.now()}`).replace(/[+/=]/g, '');
  }

  /**
   * Generate tracked calendar invite URL
   */
  generateTrackedCalendarUrl(eventId, dealId, contactId, action = 'invite') {
    const baseUrl = window.location.origin;
    const token = this.generateToken(eventId);
    return `${baseUrl}${this.apiBase}/calendar/${action}?eventId=${encodeURIComponent(eventId)}&dealId=${encodeURIComponent(dealId || '')}&contactId=${encodeURIComponent(contactId || '')}&token=${token}`;
  }

  /**
   * Track calendar event created/shared
   */
  async trackCalendarEventCreated(eventId, dealId, contactId, metadata = {}) {
    const eventRecord = {
      id: eventId,
      dealId: dealId || null,
      contactId: contactId || null,
      createdAt: new Date().toISOString(),
      inviteOpened: false,
      accepted: false,
      declined: false,
      tentative: false,
      lastInteraction: null,
      metadata: {
        ...metadata,
        title: metadata.title || `Meeting ${eventId}`,
        startTime: metadata.startTime,
        endTime: metadata.endTime
      }
    };
    
    // Save to localStorage
    const events = JSON.parse(localStorage.getItem('celera_tracked_calendar_events') || '[]');
    const existingIndex = events.findIndex(e => e.id === eventId);
    
    if (existingIndex >= 0) {
      events[existingIndex] = { ...events[existingIndex], ...eventRecord };
    } else {
      events.push(eventRecord);
    }
    
    localStorage.setItem('celera_tracked_calendar_events', JSON.stringify(events));
    
    return eventRecord;
  }

  /**
   * Record calendar interaction
   */
  async recordCalendarInteraction(eventId, dealId, contactId, action) {
    // action: 'opened', 'accepted', 'declined', 'tentative', 'clicked_link'
    const events = JSON.parse(localStorage.getItem('celera_tracked_calendar_events') || '[]');
    const event = events.find(e => e.id === eventId);
    
    if (event) {
      event.lastInteraction = new Date().toISOString();
      
      if (action === 'opened') {
        event.inviteOpened = true;
      } else if (action === 'accepted') {
        event.accepted = true;
        event.declined = false;
        event.tentative = false;
      } else if (action === 'declined') {
        event.declined = true;
        event.accepted = false;
        event.tentative = false;
      } else if (action === 'tentative') {
        event.tentative = true;
        event.accepted = false;
        event.declined = false;
      }
      
      localStorage.setItem('celera_tracked_calendar_events', JSON.stringify(events));
      
      // Create activity entry
      if (dealId && window.dataService) {
        await window.dataService.saveDealActivity(dealId, {
          id: `calendar_${action}_${Date.now()}`,
          type: 'calendar_interaction',
          date: new Date().toISOString(),
          eventId: eventId,
          action: action,
          contactId: contactId,
          metadata: {
            title: event.metadata?.title,
            accepted: event.accepted,
            declined: event.declined
          }
        });
      }
      
      return event;
    }
    
    return null;
  }

  /**
   * Get calendar event stats
   */
  getCalendarEventStats(eventId) {
    const events = JSON.parse(localStorage.getItem('celera_tracked_calendar_events') || '[]');
    return events.find(e => e.id === eventId) || null;
  }

  /**
   * Get all calendar events for a deal
   */
  getDealCalendarEvents(dealId) {
    const events = JSON.parse(localStorage.getItem('celera_tracked_calendar_events') || '[]');
    return events.filter(e => e.dealId === dealId);
  }
}

// Export singleton instance
window.calendarTelemetryService = new CalendarTelemetryService();

