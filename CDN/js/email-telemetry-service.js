/**
 * Email Telemetry Service
 * 
 * Tracks email opens (via tracking pixels) and link clicks
 * Generates unique tracking URLs for each email sent
 */

class EmailTelemetryService {
  constructor() {
    this.apiBase = '/api/telemetry';
  }

  /**
   * Generate unique token for email tracking
   */
  generateToken(emailId) {
    // Simple token generation - in production, use crypto
    return btoa(`${emailId}_${Date.now()}`).replace(/[+/=]/g, '');
  }

  /**
   * Generate tracking pixel URL for email opens
   */
  generateTrackingPixel(emailId, dealId, contactId) {
    const baseUrl = window.location.origin;
    const token = this.generateToken(emailId);
    return `${baseUrl}${this.apiBase}/email/open?emailId=${encodeURIComponent(emailId)}&dealId=${encodeURIComponent(dealId || '')}&contactId=${encodeURIComponent(contactId || '')}&token=${token}`;
  }

  /**
   * Wrap links with tracking URLs
   */
  wrapLinks(emailBody, emailId, dealId, contactId) {
    if (!emailBody) return emailBody;
    
    const baseUrl = window.location.origin;
    const token = this.generateToken(emailId);
    
    // Replace all URLs with tracking URLs
    return emailBody.replace(/(https?:\/\/[^\s<>"']+)/g, (url) => {
      // Skip if already a tracking URL
      if (url.includes('/api/telemetry/')) return url;
      
      const trackingUrl = `${baseUrl}${this.apiBase}/email/click?url=${encodeURIComponent(url)}&emailId=${encodeURIComponent(emailId)}&dealId=${encodeURIComponent(dealId || '')}&contactId=${encodeURIComponent(contactId || '')}&token=${token}`;
      return trackingUrl;
    });
  }

  /**
   * Track email sent and inject tracking
   */
  async trackEmailSent(emailData, dealId, contactId) {
    const emailId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store email metadata
    const emailRecord = {
      id: emailId,
      dealId: dealId || null,
      contactId: contactId || null,
      to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
      subject: emailData.subject || '',
      sentAt: new Date().toISOString(),
      opens: 0,
      clicks: 0,
      lastOpened: null,
      lastClicked: null,
      clickedLinks: [],
      metadata: {
        bodyLength: emailData.body?.length || 0,
        linkCount: (emailData.body?.match(/https?:\/\/[^\s<>"']+/g) || []).length
      }
    };
    
    // Save to localStorage
    const emails = JSON.parse(localStorage.getItem('celera_tracked_emails') || '[]');
    emails.push(emailRecord);
    localStorage.setItem('celera_tracked_emails', JSON.stringify(emails));
    
    // Inject tracking pixel and wrap links
    let trackedBody = emailData.body || '';
    trackedBody = this.wrapLinks(trackedBody, emailId, dealId, contactId);
    
    // Add tracking pixel at the end (HTML email) or as separate line (plain text)
    // Use multiple hiding techniques to ensure it's invisible
    const trackingPixelUrl = this.generateTrackingPixel(emailId, dealId, contactId);
    const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none !important; visibility:hidden !important; opacity:0 !important; position:absolute !important; left:-9999px !important;" alt="" border="0" />`;
    
    // For HTML emails, append pixel inside body tag
    if (trackedBody.includes('<html>') || trackedBody.includes('<body>')) {
      trackedBody = trackedBody.replace(/<\/body>/i, `${trackingPixel}</body>`);
    } else {
      // Plain text - embed as hidden HTML (many email clients render HTML even in plain text)
      // Add extra newlines and whitespace to make it less noticeable if viewed as source
      trackedBody += `\n\n${trackingPixel}`;
    }
    
    return {
      ...emailData,
      body: trackedBody,
      emailId: emailId,
      _tracked: true
    };
  }

  /**
   * Record email open (called by tracking pixel)
   */
  async recordEmailOpen(emailId, dealId, contactId) {
    const emails = JSON.parse(localStorage.getItem('celera_tracked_emails') || '[]');
    const email = emails.find(e => e.id === emailId);
    
    if (email) {
      email.opens = (email.opens || 0) + 1;
      email.lastOpened = new Date().toISOString();
      
      localStorage.setItem('celera_tracked_emails', JSON.stringify(emails));
      
      // Create activity entry
      if (dealId && window.dataService) {
        await window.dataService.saveDealActivity(dealId, {
          id: `email_open_${Date.now()}`,
          type: 'email_open',
          date: new Date().toISOString(),
          emailId: emailId,
          contactId: contactId,
          metadata: {
            subject: email.subject,
            opens: email.opens
          }
        });
      }
      
      return email;
    }
    
    return null;
  }

  /**
   * Record email link click (called by tracking redirect)
   */
  async recordEmailClick(emailId, dealId, contactId, originalUrl) {
    const emails = JSON.parse(localStorage.getItem('celera_tracked_emails') || '[]');
    const email = emails.find(e => e.id === emailId);
    
    if (email) {
      email.clicks = (email.clicks || 0) + 1;
      email.lastClicked = new Date().toISOString();
      
      if (!email.clickedLinks.includes(originalUrl)) {
        email.clickedLinks.push(originalUrl);
      }
      
      localStorage.setItem('celera_tracked_emails', JSON.stringify(emails));
      
      // Create activity entry
      if (dealId && window.dataService) {
        await window.dataService.saveDealActivity(dealId, {
          id: `email_click_${Date.now()}`,
          type: 'email_click',
          date: new Date().toISOString(),
          emailId: emailId,
          contactId: contactId,
          url: originalUrl,
          metadata: {
            subject: email.subject,
            clicks: email.clicks
          }
        });
      }
      
      return email;
    }
    
    return null;
  }

  /**
   * Get email tracking stats
   */
  getEmailStats(emailId) {
    const emails = JSON.parse(localStorage.getItem('celera_tracked_emails') || '[]');
    return emails.find(e => e.id === emailId) || null;
  }

  /**
   * Get all emails for a deal
   */
  getDealEmails(dealId) {
    const emails = JSON.parse(localStorage.getItem('celera_tracked_emails') || '[]');
    return emails.filter(e => e.dealId === dealId);
  }
}

// Export singleton instance
window.emailTelemetryService = new EmailTelemetryService();

