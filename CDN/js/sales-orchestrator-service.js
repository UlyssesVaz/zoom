/**
 * Sales Orchestrator Service
 * 
 * Analyzes deals and activity logs to surface high-priority, actionable insights
 * for sales reps to close deals faster.
 */

class SalesOrchestratorService {
  constructor() {
    // Average stage durations (in days) - can be calculated dynamically later
    this.avgStageDurations = {
      'new': 3,
      'contacted': 5,
      'qualified': 7,
      'negotiation': 14,
      'proposal': 10,
      'closed': 0
    };
  }

  /**
   * Get all activities for a deal
   */
  getDealActivities(dealId) {
    let activities = [];
    
    // Get deal-specific activities
    const dealActivities = sessionStorage.getItem(`celera_deal_${dealId}_activities`);
    if (dealActivities) {
      try {
        activities = JSON.parse(dealActivities);
      } catch (e) {
        console.error('Failed to parse deal activities:', e);
      }
    }
    
    // Also check global activities
    const allActivities = sessionStorage.getItem('celera_deal_activities');
    if (allActivities) {
      try {
        const parsed = JSON.parse(allActivities);
        const dealSpecific = parsed.filter(a => a.dealId === dealId);
        activities = [...activities, ...dealSpecific];
      } catch (e) {
        console.error('Failed to parse all activities:', e);
      }
    }
    
    return activities;
  }

  /**
   * Calculate days in current stage
   */
  calculateDaysInStage(deal) {
    if (!deal.stage || deal.stage === 'closed') return 0;
    
    // Try to get stage entry date from metadata or estimate from lastActivity
    const stageEntryDate = deal.metadata?.stageEntryDate 
      ? new Date(deal.metadata.stageEntryDate)
      : deal.lastActivity 
        ? new Date(deal.lastActivity)
        : new Date();
    
    const now = new Date();
    const diffMs = now - stageEntryDate;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate days since last contact
   */
  calculateLastContactDays(deal, activities) {
    if (!activities || activities.length === 0) {
      // Use lastActivity as fallback
      if (deal.lastActivity) {
        const lastActivityDate = new Date(deal.lastActivity);
        const now = new Date();
        return Math.floor((now - lastActivityDate) / (1000 * 60 * 60 * 24));
      }
      return 999; // No activity = very old
    }
    
    // Find most recent contact activity (call, email, meeting)
    const contactTypes = ['call', 'email', 'meeting'];
    const contactActivities = activities
      .filter(a => contactTypes.includes(a.type) && a.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (contactActivities.length === 0) {
      return 999;
    }
    
    const lastContactDate = new Date(contactActivities[0].date);
    const now = new Date();
    return Math.floor((now - lastContactDate) / (1000 * 60 * 60 * 24));
  }

  /**
   * Detect momentum signals (email opens, pricing clicks)
   */
  detectMomentum(deal, activities) {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get telemetry data if available (more accurate)
    let telemetryData = null;
    if (window.telemetryService) {
      try {
        telemetryData = window.telemetryService.getRecentEngagement(deal.id, 24);
      } catch (e) {
        console.error('Failed to get telemetry data:', e);
      }
    }
    
    // Use telemetry data for email opens (more accurate)
    const recentEmailOpens = telemetryData?.emails?.opened || activities.filter(a => {
      if (a.type !== 'email' && a.type !== 'email_open') return false;
      if (!a.date) return false;
      const activityDate = new Date(a.date);
      if (activityDate < last24Hours) return false;
      
      // Check metadata for email opens
      return a.metadata?.emailOpened === true || a.metadata?.opens > 0 || a.type === 'email_open';
    }).length;
    
    // Use telemetry data for email clicks
    const recentEmailClicks = telemetryData?.emails?.clicked || activities.filter(a => {
      if (a.type !== 'email_click') return false;
      if (!a.date) return false;
      const activityDate = new Date(a.date);
      return activityDate >= last24Hours;
    }).length;
    
    // Check for pricing page clicks
    const pricingClicks = activities.filter(a => {
      if (a.type !== 'email_click' && a.type !== 'link') return false;
      if (!a.date) return false;
      const activityDate = new Date(a.date);
      if (activityDate < last24Hours) return false;
      
      // Check if link clicked was pricing-related
      const linkUrl = a.metadata?.linkUrl || a.metadata?.url || a.url || '';
      return linkUrl.toLowerCase().includes('pricing') || 
             linkUrl.toLowerCase().includes('price') ||
             a.metadata?.linkClicked === 'pricing';
    }).length;
    
    // Use telemetry data for document views
    const proposalOpens = telemetryData?.documents?.viewed || activities.filter(a => {
      if (a.type !== 'document_view') return false;
      if (!a.date) return false;
      const activityDate = new Date(a.date);
      if (activityDate < last24Hours) return false;
      
      const summary = (a.debrief || a.summary || '').toLowerCase();
      const linkUrl = (a.metadata?.linkUrl || '').toLowerCase();
      return summary.includes('proposal') || 
             summary.includes('opened') ||
             linkUrl.includes('proposal') ||
             linkUrl.includes('document') ||
             a.type === 'document_view';
    }).length;
    
    // Check calendar acceptance
    const meetingAccepted = telemetryData?.calendar?.accepted > 0 || activities.some(a => {
      if (a.type !== 'calendar_interaction') return false;
      if (!a.date) return false;
      const activityDate = new Date(a.date);
      return activityDate >= last24Hours && a.action === 'accepted';
    });
    
    return {
      emailOpens: recentEmailOpens,
      emailClicks: recentEmailClicks,
      pricingClicks: pricingClicks,
      proposalOpens: proposalOpens,
      meetingAccepted: meetingAccepted,
      hasMomentum: recentEmailOpens > 2 || recentEmailClicks > 0 || pricingClicks > 1 || proposalOpens > 0 || meetingAccepted
    };
  }

  /**
   * Detect if deal is stalling
   */
  detectStalling(deal) {
    const daysInStage = this.calculateDaysInStage(deal);
    const avgDuration = this.avgStageDurations[deal.stage] || 7;
    const threshold = avgDuration * 1.5;
    
    return {
      isStalling: daysInStage > threshold,
      daysInStage: daysInStage,
      threshold: threshold,
      stage: deal.stage
    };
  }

  /**
   * Detect if deal is ghosting (no contact in 7+ days)
   */
  detectGhosting(deal, activities) {
    const lastContactDays = this.calculateLastContactDays(deal, activities);
    const isGhosting = lastContactDays > 7 && deal.stage !== 'closed';
    
    return {
      isGhosting: isGhosting,
      lastContactDays: lastContactDays
    };
  }

  /**
   * Calculate urgency score (1-10)
   */
  calculateUrgencyScore(deal, momentum, stalling, ghosting) {
    let score = 1;
    
    // Base score from probability
    score += Math.floor(deal.probability / 10);
    
    // Momentum boost
    if (momentum.hasMomentum) {
      score += momentum.emailOpens * 0.5;
      score += momentum.pricingClicks * 1;
      score += momentum.proposalOpens * 1.5;
    }
    
    // Stalling penalty
    if (stalling.isStalling) {
      score += Math.min(stalling.daysInStage / 10, 3);
    }
    
    // Ghosting penalty
    if (ghosting.isGhosting) {
      score += Math.min(ghosting.lastContactDays / 7, 2);
    }
    
    // High value boost
    if (deal.value > 200000) {
      score += 1;
    }
    
    return Math.min(Math.max(Math.round(score), 1), 10);
  }

  /**
   * Generate smart actions
   */
  generateSmartActions(deal, activities, momentum, stalling, ghosting) {
    const actions = [];
    const contacts = deal.contacts || [];
    const primaryContact = contacts[0] || 'the team';
    
    // Hot signal actions
    if (momentum.hasMomentum) {
      if (momentum.proposalOpens > 0) {
        actions.push({
          action_type: 'EMAIL',
          target_name: primaryContact,
          rationale: 'Proposal was opened - follow up to answer questions and move forward',
          draft_content: `Hi ${primaryContact.split(' ')[0]}, I noticed you opened the proposal. I'd love to discuss any questions you have and help move this forward. Are you available for a quick call this week?`
        });
      } else if (momentum.pricingClicks > 0) {
        actions.push({
          action_type: 'EMAIL',
          target_name: primaryContact,
          rationale: 'Pricing page was viewed - they\'re evaluating cost',
          draft_content: `Hi ${primaryContact.split(' ')[0]}, I see you checked out our pricing. I'd be happy to discuss custom options that might work better for your needs. Can we schedule a call?`
        });
      } else if (momentum.emailOpens > 2) {
        actions.push({
          action_type: 'CALL',
          target_name: primaryContact,
          rationale: 'High email engagement - they\'re actively reading your messages',
          draft_content: 'Schedule a call to capitalize on their interest'
        });
      }
    }
    
    // Risk signal actions
    if (ghosting.isGhosting) {
      actions.push({
        action_type: 'EMAIL',
        target_name: primaryContact,
        rationale: `No contact in ${ghosting.lastContactDays} days - send break-up email to re-engage`,
        draft_content: `Hi ${primaryContact.split(' ')[0]}, I wanted to check in one last time. If you're no longer interested, I completely understand - just let me know. If you are still considering us, I'd love to discuss how we can help.`
      });
      
      if (deal.probability > 50) {
        actions.push({
          action_type: 'LINKEDIN',
          target_name: primaryContact,
          rationale: 'High-value deal going cold - try LinkedIn outreach',
          draft_content: 'Send a personalized LinkedIn message to re-engage'
        });
      }
    }
    
    if (stalling.isStalling) {
      actions.push({
        action_type: 'CALL',
        target_name: primaryContact,
        rationale: `Stuck in ${stalling.stage} for ${stalling.daysInStage} days - need to unblock`,
        draft_content: `Schedule a call to identify blockers and move ${deal.name} forward`
      });
    }
    
    // Default action if no signals
    if (actions.length === 0 && deal.stage !== 'closed') {
      const lastContactDays = this.calculateLastContactDays(deal, activities);
      if (lastContactDays > 3) {
        actions.push({
          action_type: 'EMAIL',
          target_name: primaryContact,
          rationale: 'Regular follow-up to maintain momentum',
          draft_content: `Hi ${primaryContact.split(' ')[0]}, I wanted to check in on ${deal.name}. How are things progressing on your end?`
        });
      }
    }
    
    return actions.slice(0, 3); // Limit to top 3 actions
  }

  /**
   * Main analysis function
   * Returns structured JSON with hot_leads, risks, and smart_actions
   */
  async analyze() {
    try {
      // Get deals
      const deals = await window.dataService.getPipeline();
      
      // Filter out closed deals
      const activeDeals = deals.filter(d => d.stage !== 'closed');
      
      const hotLeads = [];
      const risks = [];
      const smartActions = [];
      
      for (const deal of activeDeals) {
        const activities = this.getDealActivities(deal.id);
        const momentum = this.detectMomentum(deal, activities);
        const stalling = this.detectStalling(deal);
        const ghosting = this.detectGhosting(deal, activities);
        
        // Hot Signals
        if (momentum.hasMomentum) {
          let signalReason = '';
          if (momentum.proposalOpens > 0) {
            signalReason = `Opened proposal ${momentum.proposalOpens}x in last 24 hours`;
          } else if (momentum.pricingClicks > 0) {
            signalReason = `Clicked pricing page ${momentum.pricingClicks}x`;
          } else if (momentum.emailOpens > 2) {
            signalReason = `Opened ${momentum.emailOpens} emails in last 24 hours`;
          }
          
          if (signalReason) {
            const urgencyScore = this.calculateUrgencyScore(deal, momentum, stalling, ghosting);
            hotLeads.push({
              deal_id: deal.id,
              lead_name: deal.name,
              signal_reason: signalReason,
              urgency_score: urgencyScore
            });
          }
        }
        
        // Risk Signals
        if (stalling.isStalling) {
          risks.push({
            deal_id: deal.id,
            deal_name: deal.name,
            issue: `Stuck in ${stalling.stage} stage for ${stalling.daysInStage} days (avg: ${this.avgStageDurations[stalling.stage] || 7} days)`,
            suggested_fix: stalling.daysInStage > 20 
              ? 'Send break-up email to re-engage or close'
              : 'Schedule call to identify blockers'
          });
        }
        
        if (ghosting.isGhosting) {
          risks.push({
            deal_id: deal.id,
            deal_name: deal.name,
            issue: `No contact in ${ghosting.lastContactDays} days - deal going cold`,
            suggested_fix: ghosting.lastContactDays > 14
              ? 'Send break-up email'
              : 'Reach out via LinkedIn or email'
          });
        }
        
        // Smart Actions
        const actions = this.generateSmartActions(deal, activities, momentum, stalling, ghosting);
        smartActions.push(...actions);
      }
      
      // Sort hot leads by urgency score
      hotLeads.sort((a, b) => b.urgency_score - a.urgency_score);
      
      // Sort risks by deal value (higher value = more important)
      risks.sort((a, b) => {
        const dealA = activeDeals.find(d => d.id === a.deal_id);
        const dealB = activeDeals.find(d => d.id === b.deal_id);
        return (dealB?.value || 0) - (dealA?.value || 0);
      });
      
      // Limit results
      return {
        hot_leads: hotLeads.slice(0, 5),
        risks: risks.slice(0, 5),
        smart_actions: smartActions.slice(0, 5)
      };
    } catch (error) {
      console.error('Failed to analyze deals:', error);
      return {
        hot_leads: [],
        risks: [],
        smart_actions: []
      };
    }
  }
}

// Export singleton instance
window.salesOrchestratorService = new SalesOrchestratorService();

