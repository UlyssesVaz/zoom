/**
 * Unified Telemetry Service
 * 
 * Aggregates all telemetry data and provides engagement insights
 */

class TelemetryService {
  constructor() {
    this.emailTelemetry = window.emailTelemetryService;
    this.documentTelemetry = window.documentTelemetryService;
    this.calendarTelemetry = window.calendarTelemetryService;
  }

  /**
   * Get all engagement signals for a deal
   */
  getDealEngagementSignals(dealId) {
    const emails = this.emailTelemetry?.getDealEmails(dealId) || [];
    const documents = this.documentTelemetry?.getDealDocuments(dealId) || [];
    const calendarEvents = this.calendarTelemetry?.getDealCalendarEvents(dealId) || [];
    
    // Calculate email stats
    const emailStats = {
      sent: emails.length,
      opened: emails.filter(e => e.opens > 0).length,
      clicked: emails.filter(e => e.clicks > 0).length,
      openRate: emails.length > 0 ? (emails.filter(e => e.opens > 0).length / emails.length * 100).toFixed(1) : 0,
      clickRate: emails.length > 0 ? (emails.filter(e => e.clicks > 0).length / emails.length * 100).toFixed(1) : 0,
      lastOpened: emails
        .filter(e => e.lastOpened)
        .sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened))[0]?.lastOpened || null,
      lastClicked: emails
        .filter(e => e.lastClicked)
        .sort((a, b) => new Date(b.lastClicked) - new Date(a.lastClicked))[0]?.lastClicked || null
    };
    
    // Calculate document stats
    const documentStats = {
      shared: documents.length,
      viewed: documents.filter(d => d.views > 0).length,
      totalViews: documents.reduce((sum, d) => sum + (d.views || 0), 0),
      totalTimeSpent: documents.reduce((sum, d) => sum + (d.totalTimeSpent || 0), 0),
      downloaded: documents.filter(d => d.downloads > 0).length,
      lastViewed: documents
        .filter(d => d.lastViewed)
        .sort((a, b) => new Date(b.lastViewed) - new Date(a.lastViewed))[0]?.lastViewed || null
    };
    
    // Calculate calendar stats
    const calendarStats = {
      sent: calendarEvents.length,
      opened: calendarEvents.filter(e => e.inviteOpened).length,
      accepted: calendarEvents.filter(e => e.accepted).length,
      declined: calendarEvents.filter(e => e.declined).length,
      tentative: calendarEvents.filter(e => e.tentative).length,
      acceptanceRate: calendarEvents.length > 0 
        ? (calendarEvents.filter(e => e.accepted).length / calendarEvents.length * 100).toFixed(1) 
        : 0
    };
    
    return {
      emails: emailStats,
      documents: documentStats,
      calendar: calendarStats,
      overall: this.calculateEngagementScore(emailStats, documentStats, calendarStats)
    };
  }

  /**
   * Calculate overall engagement score (0-100)
   */
  calculateEngagementScore(emailStats, documentStats, calendarStats) {
    let score = 0;
    
    // Email engagement (40% weight)
    if (emailStats.sent > 0) {
      score += (emailStats.openRate / 100) * 20; // Opens worth 20 points
      score += (emailStats.clickRate / 100) * 20; // Clicks worth 20 points
    }
    
    // Document engagement (30% weight)
    if (documentStats.shared > 0) {
      const viewRate = (documentStats.viewed / documentStats.shared) * 100;
      score += (viewRate / 100) * 15; // Views worth 15 points
      
      // Time spent bonus (up to 15 points)
      const avgTimeSpent = documentStats.totalTimeSpent / documentStats.viewed || 0;
      score += Math.min(avgTimeSpent / 60, 15); // 1 minute = 1 point, max 15
    }
    
    // Calendar engagement (30% weight)
    if (calendarStats.sent > 0) {
      score += (calendarStats.acceptanceRate / 100) * 30; // Acceptance worth 30 points
    }
    
    return Math.min(Math.round(score), 100);
  }

  /**
   * Get recent engagement activity (last 24 hours)
   */
  getRecentEngagement(dealId, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const signals = this.getDealEngagementSignals(dealId);
    
    const recent = {
      emails: {
        opened: 0,
        clicked: 0
      },
      documents: {
        viewed: 0
      },
      calendar: {
        accepted: 0,
        opened: 0
      }
    };
    
    // Check recent email opens/clicks
    const emails = this.emailTelemetry?.getDealEmails(dealId) || [];
    emails.forEach(email => {
      if (email.lastOpened && new Date(email.lastOpened) > cutoff) {
        recent.emails.opened++;
      }
      if (email.lastClicked && new Date(email.lastClicked) > cutoff) {
        recent.emails.clicked++;
      }
    });
    
    // Check recent document views
    const documents = this.documentTelemetry?.getDealDocuments(dealId) || [];
    documents.forEach(doc => {
      if (doc.lastViewed && new Date(doc.lastViewed) > cutoff) {
        recent.documents.viewed++;
      }
    });
    
    // Check recent calendar interactions
    const events = this.calendarTelemetry?.getDealCalendarEvents(dealId) || [];
    events.forEach(event => {
      if (event.lastInteraction && new Date(event.lastInteraction) > cutoff) {
        if (event.accepted) recent.calendar.accepted++;
        if (event.inviteOpened) recent.calendar.opened++;
      }
    });
    
    return recent;
  }

  /**
   * Check if deal has hot signals (high recent engagement)
   */
  hasHotSignals(dealId) {
    const recent = this.getRecentEngagement(dealId, 24);
    
    return (
      recent.emails.opened >= 2 ||
      recent.emails.clicked >= 1 ||
      recent.documents.viewed >= 1 ||
      recent.calendar.accepted >= 1
    );
  }
}

// Export singleton instance
window.telemetryService = new TelemetryService();



