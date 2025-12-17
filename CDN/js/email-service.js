/**
 * Email Service
 * 
 * Handles email composition and sending via Gmail/Outlook
 * Supports follow-up emails, templates, and email tracking
 */

class EmailService {
  constructor() {
    this.provider = localStorage.getItem('email_provider') || null; // 'gmail' or 'outlook'
    this.isAuthenticated = localStorage.getItem('email_authenticated') === 'true';
  }

  /**
   * Check if email service is configured
   */
  isConfigured() {
    return this.isAuthenticated && this.provider !== null;
  }

  /**
   * Set email provider
   */
  setProvider(provider) {
    this.provider = provider;
    localStorage.setItem('email_provider', provider);
  }

  /**
   * Set authentication status
   */
  setAuthenticated(authenticated) {
    this.isAuthenticated = authenticated;
    localStorage.setItem('email_authenticated', authenticated ? 'true' : '');
  }

  /**
   * Initiate OAuth flow for Gmail
   */
  async connectGmail() {
    try {
      // In production, this would redirect to Gmail OAuth
      // For now, we'll use Gmail API via backend
      const response = await fetch('/api/email/gmail/auth/url', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to get Gmail auth URL');
      }

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Failed to connect Gmail:', error);
      throw error;
    }
  }

  /**
   * Initiate OAuth flow for Outlook
   */
  async connectOutlook() {
    try {
      const response = await fetch('/api/email/outlook/auth/url', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to get Outlook auth URL');
      }

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Failed to connect Outlook:', error);
      throw error;
    }
  }

  /**
   * Generate follow-up email from meeting context
   * @param {Object} context - Meeting context (debrief, participants, deal, etc.)
   * @returns {Object} Email draft
   */
  generateFollowUpEmail(context) {
    const { debrief, participants, dealName, accountName, nextSteps } = context;
    
    // Filter out "You" from participants
    const recipients = participants.filter(p => p !== 'You' && p.toLowerCase() !== 'you');
    
    // Generate subject
    const subject = `Follow-up: ${dealName || accountName || 'Our Meeting'}`;
    
    // Generate email body
    let body = `Hi ${recipients.length > 0 ? recipients[0].split(' ')[0] : 'there'},\n\n`;
    body += `Thank you for taking the time to meet with me today. `;
    
    if (debrief) {
      body += `I wanted to follow up on our discussion.\n\n`;
      
      // Extract key points from debrief (first few sentences)
      const debriefLines = debrief.split('\n').filter(l => l.trim().length > 0);
      if (debriefLines.length > 0) {
        body += `Key points from our conversation:\n`;
        debriefLines.slice(0, 3).forEach(line => {
          if (line.trim() && !line.includes('Call duration') && !line.includes('Meeting ID')) {
            body += `• ${line.trim()}\n`;
          }
        });
        body += `\n`;
      }
    }
    
    if (nextSteps && nextSteps.length > 0) {
      body += `Next steps:\n`;
      nextSteps.forEach(step => {
        body += `• ${step}\n`;
      });
      body += `\n`;
    }
    
    body += `Please let me know if you have any questions or if there's anything else I can help with.\n\n`;
    body += `Best regards,\n`;
    body += `[Your Name]`;
    
    return {
      to: recipients.map(p => {
        // Try to extract email from participant name
        // In production, this would come from contact data
        return p.toLowerCase().replace(/\s+/g, '.') + '@example.com';
      }),
      subject: subject,
      body: body,
      cc: [],
      bcc: []
    };
  }

  /**
   * Compose email (opens email composer)
   * @param {Object} emailData - Email data (to, subject, body, etc.)
   * @param {string} dealId - Optional deal ID for tracking
   * @param {string} contactId - Optional contact ID for tracking
   */
  async composeEmail(emailData, dealId = null, contactId = null) {
    // Add telemetry tracking if available
    let trackedEmailData = emailData;
    if (window.emailTelemetryService && (dealId || contactId)) {
      try {
        trackedEmailData = await window.emailTelemetryService.trackEmailSent(
          emailData,
          dealId,
          contactId
        );
      } catch (error) {
        console.error('Failed to add email tracking:', error);
        // Continue without tracking if it fails
      }
    }
    
    if (!this.isConfigured()) {
      // If not configured, use mailto: fallback
      const mailtoLink = this.createMailtoLink(trackedEmailData);
      window.location.href = mailtoLink;
      return trackedEmailData.emailId || null;
    }

    // In production, this would open Gmail/Outlook compose window
    // For now, we'll use mailto: or show compose modal
    const mailtoLink = this.createMailtoLink(trackedEmailData);
    window.location.href = mailtoLink;
    
    return trackedEmailData.emailId || null;
  }

  /**
   * Create mailto: link
   */
  createMailtoLink(emailData) {
    const to = Array.isArray(emailData.to) ? emailData.to.join(',') : emailData.to;
    const subject = encodeURIComponent(emailData.subject || '');
    const body = encodeURIComponent(emailData.body || '');
    
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  /**
   * Send email via API (when OAuth is configured)
   * @param {Object} emailData - Email data
   * @param {string} dealId - Optional deal ID for tracking
   * @param {string} contactId - Optional contact ID for tracking
   */
  async sendEmail(emailData, dealId = null, contactId = null) {
    if (!this.isConfigured()) {
      throw new Error('Email service not configured');
    }

    // Add telemetry tracking if available
    let trackedEmailData = emailData;
    if (window.emailTelemetryService && (dealId || contactId)) {
      try {
        trackedEmailData = await window.emailTelemetryService.trackEmailSent(
          emailData,
          dealId,
          contactId
        );
      } catch (error) {
        console.error('Failed to add email tracking:', error);
      }
    }

    try {
      const response = await fetch(`/api/email/${this.provider}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackedEmailData)
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.status}`);
      }

      const result = await response.json();
      return { ...result, emailId: trackedEmailData.emailId };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Get email templates
   */
  getTemplates() {
    return [
      {
        id: 'follow-up',
        name: 'Follow-up Email',
        subject: 'Follow-up: {{dealName}}',
        body: 'Hi {{contactName}},\n\nThank you for taking the time to meet with me today...'
      },
      {
        id: 'proposal',
        name: 'Send Proposal',
        subject: 'Proposal: {{dealName}}',
        body: 'Hi {{contactName}},\n\nAs discussed, please find attached our proposal...'
      },
      {
        id: 'check-in',
        name: 'Check-in',
        subject: 'Checking in: {{dealName}}',
        body: 'Hi {{contactName}},\n\nI wanted to check in and see how things are progressing...'
      }
    ];
  }

  /**
   * Apply template with context
   */
  applyTemplate(templateId, context) {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      return null;
    }

    let subject = template.subject;
    let body = template.body;

    // Replace template variables
    Object.keys(context).forEach(key => {
      const value = context[key] || '';
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return {
      subject: subject,
      body: body
    };
  }
}

// Export singleton instance
window.emailService = new EmailService();

