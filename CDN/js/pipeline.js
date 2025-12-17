// Pipeline Page Logic - Table View

// Calculate deal score based on multiple factors
function calculateDealScore(deal) {
  let score = 0;
  
  // Probability contributes 40% of score
  score += (deal.probability || 0) * 0.4;
  
  // Value contributes 30% (normalized to 0-100)
  const maxValue = 1000000; // Assume $1M is max
  const valueScore = Math.min((deal.value / maxValue) * 100, 100);
  score += valueScore * 0.3;
  
  // Recency of activity contributes 20%
  const daysSinceActivity = deal.lastActivity ? 
    Math.floor((new Date() - new Date(deal.lastActivity)) / (1000 * 60 * 60 * 24)) : 30;
  const recencyScore = Math.max(0, 100 - (daysSinceActivity * 2));
  score += recencyScore * 0.2;
  
  // Contact count contributes 10%
  const contactScore = Math.min((deal.contacts?.length || 0) * 20, 100);
  score += contactScore * 0.1;
  
  return Math.round(score);
}

// Get score class for styling
function getScoreClass(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// Calculate summary metrics
function calculateSummaryMetrics(deals) {
  const metrics = {
    open: { value: 0, count: 0, previous: 0 },
    commit: { value: 0, count: 0, previous: 0 },
    mostLikely: { value: 0, count: 0, previous: 0 },
    bestCase: { value: 0, count: 0, previous: 0 },
    closedWon: { value: 0, count: 0 },
    closedLost: { value: 0, count: 0 }
  };

  deals.forEach(deal => {
    const value = deal.value || 0;
    const probability = deal.probability || 0;
    
    // Open deals (not closed)
    if (deal.stage !== 'closed') {
      metrics.open.value += value;
      metrics.open.count++;
      
      // Commit (high probability)
      if (probability >= 80) {
        metrics.commit.value += value;
        metrics.commit.count++;
      }
      
      // Most Likely (50-79% probability)
      if (probability >= 50 && probability < 80) {
        metrics.mostLikely.value += value;
        metrics.mostLikely.count++;
      }
      
      // Best Case (all open deals)
      metrics.bestCase.value += value;
      metrics.bestCase.count++;
    } else {
      // Assume closed won if probability was high, otherwise lost
      if (probability >= 50) {
        metrics.closedWon.value += value;
        metrics.closedWon.count++;
      } else {
        metrics.closedLost.value += value;
        metrics.closedLost.count++;
      }
    }
  });

  return metrics;
}

// Format currency
function formatCurrency(amount) {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

// Format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return 'No activity';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Format next call
function formatNextCall(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffDays < 0) {
    return 'Overdue';
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays <= 7) {
    return `In ${diffDays} days`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Render summary cards
function renderSummary(metrics) {
  const summaryContainer = document.getElementById('pipeline-summary');
  if (!summaryContainer) return;
  
  summaryContainer.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Open</div>
      <div class="summary-value">${formatCurrency(metrics.open.value)}</div>
      <div class="summary-count">${metrics.open.count} deals</div>
      ${metrics.open.previous > 0 ? `
        <div class="summary-trend up">
          <span>↑</span>
          <span>${formatCurrency(metrics.open.previous)}</span>
        </div>
      ` : ''}
    </div>
    <div class="summary-card">
      <div class="summary-label">Commit</div>
      <div class="summary-value">${formatCurrency(metrics.commit.value)}</div>
      <div class="summary-count">${metrics.commit.count} deals</div>
      ${metrics.commit.previous > 0 ? `
        <div class="summary-trend up">
          <span>↑</span>
          <span>${formatCurrency(metrics.commit.previous)}</span>
        </div>
      ` : ''}
    </div>
    <div class="summary-card">
      <div class="summary-label">Most Likely</div>
      <div class="summary-value">${formatCurrency(metrics.mostLikely.value)}</div>
      <div class="summary-count">${metrics.mostLikely.count} deals</div>
      ${metrics.mostLikely.previous > 0 ? `
        <div class="summary-trend up">
          <span>↑</span>
          <span>${formatCurrency(metrics.mostLikely.previous)}</span>
        </div>
      ` : ''}
    </div>
    <div class="summary-card">
      <div class="summary-label">Best Case</div>
      <div class="summary-value">${formatCurrency(metrics.bestCase.value)}</div>
      <div class="summary-count">${metrics.bestCase.count} deals</div>
      ${metrics.bestCase.previous > 0 ? `
        <div class="summary-trend up">
          <span>↑</span>
          <span>${formatCurrency(metrics.bestCase.previous)}</span>
        </div>
      ` : ''}
    </div>
    <div class="summary-card">
      <div class="summary-label">Closed Won</div>
      <div class="summary-value">${formatCurrency(metrics.closedWon.value)}</div>
      <div class="summary-count">${metrics.closedWon.count} deals</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Closed Lost</div>
      <div class="summary-value">${formatCurrency(metrics.closedLost.value)}</div>
      <div class="summary-count">${metrics.closedLost.count} deals</div>
    </div>
  `;
}

// Render deal row
function renderDealRow(deal, index) {
  const score = calculateDealScore(deal);
  const scoreClass = getScoreClass(score);
  const warnings = deal.warnings || [];
  const contacts = deal.contacts || [];
  
  // Generate activity timeline (mock for now - could be based on actual activity dates)
  const activityDates = ['FEB 14', 'FEB 20', 'FEB 27', 'TODAY'];
  
  // Stage indicators (M, E, D, D, I, C, C, C)
  const stageLabels = ['M', 'E', 'D', 'D', 'I', 'C', 'C', 'C'];
  const currentStageIndex = Math.min(Math.floor((deal.probability || 0) / 12.5), stageLabels.length - 1);
  
  const nextCall = formatNextCall(deal.nextCall);
  const nextCallClass = nextCall === 'Today' || nextCall === 'Tomorrow' ? 'soon' : '';
  
  return `
    <tr data-id="${deal.id}" onclick="openDealSidebar('${deal.id}')" style="cursor: pointer;">
      <td>
        <span class="deal-expand-icon">></span>
      </td>
      <td>
        <div class="deal-name-cell">
          <div class="deal-name-content">
            <div class="deal-name">${deal.name}</div>
            <div class="deal-version">${deal.name} 1.0</div>
          </div>
          <span class="deal-add-icon" onclick="event.stopPropagation(); addToDeal('${deal.id}')">📄+</span>
        </div>
      </td>
      <td>
        <span class="deal-score ${scoreClass}">
          ${score}
          ${score >= 70 ? '<span class="deal-score-trend">↑</span>' : ''}
        </span>
      </td>
      <td>
        <div class="deal-warnings">
          ${warnings.length > 0 ? `
            <span class="warning-badge">${warnings[0]}</span>
          ` : '<span>-</span>'}
        </div>
      </td>
      <td>
        <div class="deal-contacts">${contacts.length}</div>
      </td>
      <td>
        <div class="deal-activity">
          <div class="activity-timeline">
            ${activityDates.map((date, i) => `
              <span class="activity-dot ${i === activityDates.length - 1 ? 'recent' : i >= activityDates.length - 2 ? 'active' : ''}"></span>
            `).join('')}
          </div>
        </div>
      </td>
      <td>
        <div class="deal-stages">
          ${stageLabels.map((label, i) => `
            <span class="stage-indicator ${i === currentStageIndex ? 'active' : ''}">${label}</span>
          `).join('')}
        </div>
      </td>
      <td>
        <div class="deal-next-call ${nextCallClass}">${nextCall || '-'}</div>
      </td>
    </tr>
  `;
}

// Main function to load pipeline
async function loadPipeline() {
  const tableBody = document.getElementById('deals-table-body');
  if (!tableBody) {
    console.error('deals-table-body element not found');
    return;
  }
  
  tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading deals...</td></tr>';
  
  try {
    const deals = await window.dataService.getPipeline();
    
    // Load next meeting card
    await loadNextMeetingCard(deals);
    
    // Sort deals by score (highest first)
    deals.sort((a, b) => calculateDealScore(b) - calculateDealScore(a));
    
    // Render table rows
    if (deals.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div>No deals found</div>
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = deals.map((deal, index) => renderDealRow(deal, index)).join('');
    }
    
  } catch (error) {
    console.error('Failed to load pipeline:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--error-color);">
          Failed to load pipeline data
        </td>
      </tr>
    `;
  }
}

/**
 * Load and display next meeting card
 */
async function loadNextMeetingCard(deals) {
  const nextMeetingCard = document.getElementById('next-meeting-card');
  const nextMeetingTitle = document.getElementById('next-meeting-title');
  const nextMeetingTime = document.getElementById('next-meeting-time');
  const openDealBtn = document.getElementById('open-deal-btn');
  
  if (!nextMeetingCard) return;
  
  // Try to get next meeting from calendar
  if (window.googleCalendarService && window.googleCalendarService.isAvailable()) {
    try {
      const events = await window.googleCalendarService.getEvents({ 
        timeMin: new Date().toISOString(),
        maxResults: 10
      });
      
      // Find next event with meeting info or linked to a deal
      const now = new Date();
      const upcomingEvents = events
        .filter(e => e.start && new Date(e.start) >= now)
        .sort((a, b) => new Date(a.start) - new Date(b.start));
      
      for (const event of upcomingEvents) {
        // Check if event is linked to a deal
        let dealId = event.dealId;
        
        // If not linked, try to match by name/attendees
        if (!dealId && deals.length > 0) {
          dealId = window.googleCalendarService.matchEventToDeal(event, deals);
        }
        
        if (dealId) {
          const deal = deals.find(d => d.id === dealId);
          if (deal) {
            const startTime = new Date(event.start);
            const minutesUntil = Math.floor((startTime - now) / 60000);
            
            // Only show if meeting is within next 24 hours
            if (minutesUntil >= 0 && minutesUntil <= 1440) {
              nextMeetingTitle.textContent = event.summary || `${deal.name} Meeting`;
              
              if (minutesUntil < 60) {
                nextMeetingTime.textContent = `In ${minutesUntil} minutes`;
              } else {
                const hours = Math.floor(minutesUntil / 60);
                const minutes = minutesUntil % 60;
                if (minutes === 0) {
                  nextMeetingTime.textContent = `In ${hours} hour${hours > 1 ? 's' : ''}`;
                } else {
                  nextMeetingTime.textContent = `In ${hours}h ${minutes}m`;
                }
              }
              
              // Store deal ID for button click
              openDealBtn.dataset.dealId = dealId;
              nextMeetingCard.style.display = 'flex';
              return;
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load next meeting:', e);
    }
  }
  
  // No upcoming meeting found - hide card
  nextMeetingCard.style.display = 'none';
}

/**
 * Open deal sidebar for next meeting
 */
function openNextMeetingDeal() {
  const dealId = document.getElementById('open-deal-btn').dataset.dealId;
  if (dealId) {
    openDealSidebar(dealId);
  }
}

// Sidebar Management
let currentDealId = null;
let currentDealData = null;

function openDealSidebar(dealId) {
  currentDealId = dealId;
  const sidebar = document.getElementById('deal-sidebar');
  sidebar.classList.add('open');
  
  // Load deal data
  loadDealSidebarData(dealId);
  
  // Switch to first tab
  switchTab('score');
}

function closeDealSidebar() {
  const sidebar = document.getElementById('deal-sidebar');
  sidebar.classList.remove('open');
  currentDealId = null;
  currentDealData = null;
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.deal-sidebar-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.deal-sidebar-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const activeContent = document.getElementById(`tab-${tabName}`);
  if (activeContent) {
    activeContent.classList.add('active');
  }
  
  // Load tab-specific content
  if (currentDealData) {
    loadTabContent(tabName, currentDealData);
  }
  
  // Always load contacts tab data when switching to it (to ensure deal context is loaded)
  if (tabName === 'contacts' && currentDealData) {
    loadContactsTab(currentDealData);
  }
}

async function loadDealSidebarData(dealId) {
  try {
    const deal = await window.dataService.getLeadDeal(dealId);
    currentDealData = deal;
    
    // Update header
    document.getElementById('sidebar-deal-name').textContent = deal.accountName || deal.name || '-';
    document.getElementById('sidebar-deal-version').textContent = `${deal.accountName || deal.name || 'Deal'} 1.0`;
    
    // Load current tab content (default to contacts)
    const activeTab = document.querySelector('.deal-sidebar-tab.active');
    const tabName = activeTab ? activeTab.dataset.tab : 'contacts';
    loadTabContent(tabName, deal);
  } catch (error) {
    console.error('Failed to load deal data:', error);
  }
}

function loadTabContent(tabName, deal) {
  switch(tabName) {
    case 'score':
      loadScoreTab(deal);
      break;
    case 'contacts':
      loadContactsTab(deal);
      break;
    case 'review':
      loadReviewAccountTab(deal);
      break;
    case 'warnings':
      loadWarningsTab(deal);
      break;
    case 'activity':
      loadActivityTab(deal);
      break;
    case 'tasks':
      loadTasksTab(deal);
      break;
  }
}

function loadScoreTab(deal) {
  const score = calculateDealScore(deal);
  const scoreClass = getScoreClass(score);
  const content = document.getElementById('sidebar-score-content');
  
  content.innerHTML = `
    <div style="text-align: center; padding: 2rem 0;">
      <div class="deal-score ${scoreClass}" style="font-size: 3rem; padding: 1rem 2rem; display: inline-block;">
        ${score}
      </div>
      <div style="margin-top: 1rem; color: var(--text-secondary);">
        <div><strong>Deal Value:</strong> ${formatCurrency(deal.value || 0)}</div>
        <div><strong>Probability:</strong> ${deal.probability || 0}%</div>
        <div><strong>Stage:</strong> ${deal.dealStage || deal.stage || '-'}</div>
      </div>
    </div>
  `;
}

function loadContactsTab(deal) {
  // Load deal context
  const dealContext = document.getElementById('sidebar-deal-context');
  if (dealContext) {
    dealContext.innerHTML = `
      <div style="background: var(--content-bg); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.75rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Deal Value</div>
            <div style="font-weight: 600; color: var(--accent-color); font-size: 1.1rem;">${formatCurrency(deal.value || 0)}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Probability</div>
            <div style="font-weight: 600; color: var(--text-primary);">${deal.probability || 0}%</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Stage</div>
            <div style="font-weight: 600; color: var(--text-primary);">${deal.dealStage || deal.stage || '-'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Industry</div>
            <div style="font-weight: 600; color: var(--text-primary);">${deal.industry || '-'}</div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Load contacts
  const content = document.getElementById('sidebar-contacts-content');
  const contacts = deal.contacts || [];
  
  if (contacts.length === 0) {
    content.innerHTML = '<p style="color: var(--text-secondary);">No contacts available</p>';
    return;
  }
  
  content.innerHTML = contacts.map(contact => {
    const name = typeof contact === 'string' ? contact : contact.name;
    const role = typeof contact === 'object' ? contact.role : '';
    return `
      <div class="contact-item-sidebar">
        <div>
          <div class="contact-item-sidebar-name">${name}</div>
          ${role ? `<div class="contact-item-sidebar-role">${role}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
}

function loadReviewAccountTab(deal) {
  const content = document.getElementById('sidebar-review-account-content');
  
  content.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="background: var(--content-bg); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 600;">ACCOUNT NAME</div>
        <div style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">${deal.accountName || deal.name || '-'}</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Industry</div>
          <div style="font-weight: 600; color: var(--text-primary);">${deal.industry || '-'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Company Size</div>
          <div style="font-weight: 600; color: var(--text-primary);">${deal.companySize || '-'}</div>
        </div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Location</div>
        <div style="font-weight: 600; color: var(--text-primary);">${deal.location || '-'}</div>
      </div>
    </div>
    <div style="margin-bottom: 1.5rem;">
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 600;">DEAL DETAILS</div>
      <div style="background: var(--content-bg); padding: 1rem; border-radius: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.75rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Deal Name</div>
            <div style="font-weight: 600; color: var(--text-primary);">${deal.dealName || '-'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Deal Value</div>
            <div style="font-weight: 600; color: var(--accent-color);">${formatCurrency(deal.value || 0)}</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Stage</div>
            <div style="font-weight: 600; color: var(--text-primary);">${deal.dealStage || deal.stage || '-'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Probability</div>
            <div style="font-weight: 600; color: var(--text-primary);">${deal.probability || 0}%</div>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 600;">LAST INTERACTION</div>
      <div style="background: var(--content-bg); padding: 1rem; border-radius: 8px;">
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${deal.lastInteractionDate || '-'}</div>
        <div style="color: var(--text-secondary); line-height: 1.6; font-size: 0.9rem;">${deal.lastInteractionSummary || 'No interaction history available.'}</div>
      </div>
    </div>
  `;
}

/**
 * Join Zoom Call - Main function called from button
 * Checks for meeting info from calendar events or deal data, then joins
 */
async function joinZoomCall() {
  // Check if we have a deal selected
  if (!currentDealId || !currentDealData) {
    // Try to get deal from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const dealIdFromUrl = urlParams.get('dealId');
    
    if (dealIdFromUrl && window.dataService) {
      try {
        const deal = await window.dataService.getLeadDeal(dealIdFromUrl);
        if (deal) {
          currentDealId = dealIdFromUrl;
          currentDealData = deal;
          await joinZoomCallWithDeal(deal);
          return;
        }
      } catch (error) {
        console.error('Failed to load deal:', error);
      }
    }
    
    // If no deal, prompt for meeting info directly
    await joinZoomCallWithoutDeal();
    return;
  }
  
  await joinZoomCallWithDeal(currentDealData);
}

/**
 * Join Zoom Call with deal context
 * Checks multiple sources for meeting info:
 * 1. Upcoming calendar events for this deal
 * 2. Deal's stored meeting info
 * 3. Prompt user if not found
 */
async function joinZoomCallWithDeal(deal) {
  let meetingInfo = null;
  let preferredPlatform = null;
  
  // Try to get meeting info from calendar events first
  if (window.googleCalendarService && window.googleCalendarService.isAvailable()) {
    try {
      const dealEvents = await window.googleCalendarService.getDealEvents(deal.id);
      // Find upcoming event with meeting info
      const upcomingEvent = dealEvents
        .filter(event => event.start && new Date(event.start) >= new Date())
        .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
      
      if (upcomingEvent) {
        // Use new meetingInfo if available, fallback to zoomMeeting for backward compatibility
        if (upcomingEvent.meetingInfo) {
          meetingInfo = upcomingEvent.meetingInfo;
        } else if (upcomingEvent.zoomMeeting) {
          meetingInfo = {
            platform: 'zoom',
            meetingNumber: upcomingEvent.zoomMeeting.meetingNumber,
            password: upcomingEvent.zoomMeeting.password || null,
            joinUrl: upcomingEvent.zoomMeeting.joinUrl
          };
        } else if (upcomingEvent.hangoutLink) {
          // Check if it's a Google Meet link
          meetingInfo = window.meetingService.extractGoogleMeetInfo(upcomingEvent.hangoutLink);
        }
      }
    } catch (error) {
      console.error('Failed to get calendar events:', error);
    }
  }
  
  // Fall back to deal's stored meeting info
  if (!meetingInfo) {
    if (deal.meetingNumber) {
      meetingInfo = {
        platform: 'zoom',
        meetingNumber: deal.meetingNumber,
        password: deal.meetingPassword || null,
        joinUrl: `https://zoom.us/j/${deal.meetingNumber}`
      };
    } else if (deal.meetingLink) {
      meetingInfo = window.meetingService.extractMeetingInfo(deal.meetingLink);
    }
  }
  
  // Fall back to localStorage/defaults
  if (!meetingInfo) {
    const storedMeetingNumber = localStorage.getItem('celera_meeting_number');
    const storedMeetingLink = localStorage.getItem('celera_meeting_link');
    
    if (storedMeetingLink) {
      meetingInfo = window.meetingService.extractMeetingInfo(storedMeetingLink);
    } else if (storedMeetingNumber) {
      meetingInfo = {
        platform: 'zoom',
        meetingNumber: storedMeetingNumber,
        password: localStorage.getItem('celera_meeting_password') || null,
        joinUrl: `https://zoom.us/j/${storedMeetingNumber}`
      };
    }
  }
  
  // If still no meeting info, prompt user
  if (!meetingInfo) {
    const userInput = prompt('Enter meeting link or number (Zoom/Google Meet):');
    if (!userInput || !userInput.trim()) {
      return; // User cancelled
    }
    
    meetingInfo = window.meetingService.extractMeetingInfo(userInput.trim());
    
    if (!meetingInfo) {
      // Try to detect platform and prompt accordingly
      const platform = window.meetingService.getDefaultProvider();
      if (platform === 'zoom') {
        const meetingNumber = userInput.replace(/\D/g, '');
        if (meetingNumber.length >= 9) {
          const password = prompt('Enter Meeting Password (optional - leave blank if none):');
          meetingInfo = {
            platform: 'zoom',
            meetingNumber: meetingNumber,
            password: password ? password.trim() : null,
            joinUrl: `https://zoom.us/j/${meetingNumber}`
          };
        } else {
          alert('Invalid meeting number. Please enter a valid Zoom meeting number (9-11 digits) or a meeting link.');
          return;
        }
      } else {
        alert('Could not detect meeting platform. Please enter a full meeting link.');
        return;
      }
    }
  }
  
  // Get display name
  const displayName = localStorage.getItem('celera_display_name') || 
                      sessionStorage.getItem('celera_user_name') || 
                      deal.contacts?.[0]?.name || 
                      'User';
  
  // Store CRM context for post-call summary
  const crmContext = {
    accountName: deal.accountName || deal.name,
    dealName: deal.dealName || deal.name,
    dealValue: deal.dealValue || `$${(deal.value || 0).toLocaleString()}`,
    dealStage: deal.dealStage || deal.stage || 'Unknown',
    contacts: deal.contacts || []
  };
  sessionStorage.setItem('celera_crm_context', JSON.stringify(crmContext));
  sessionStorage.setItem('celera_lead_deal_id', deal.id);
  sessionStorage.setItem('celera_user_name', displayName);
  sessionStorage.setItem('celera_meeting_platform', meetingInfo.platform);
  sessionStorage.setItem('celera_meeting_start_time', new Date().toISOString());
  
  // Store platform-specific meeting identifier
  if (meetingInfo.platform === 'zoom') {
    sessionStorage.setItem('celera_meeting_number', meetingInfo.meetingNumber);
    if (meetingInfo.password) {
      sessionStorage.setItem('celera_meeting_password', meetingInfo.password);
    }
  } else if (meetingInfo.platform === 'google-meet') {
    sessionStorage.setItem('celera_meeting_code', meetingInfo.meetingCode);
  }
  
  // Join meeting using meeting service
  try {
    await window.meetingService.joinMeeting(meetingInfo, displayName);
  } catch (error) {
    console.error('Failed to join meeting:', error);
    alert(`Failed to join meeting: ${error.message}`);
  }
}

/**
 * Core function to join Zoom meeting using SDK
 * This is the foundation that connects to the Zoom SDK
 * Follows the same pattern as prep.js and meeting.js
 * 
 * Note: Zoom SDK (ZoomMtg) is loaded on meeting.html, not here.
 * This function just prepares the config and redirects to meeting.html.
 */
async function joinZoomMeeting(meetingNumber, meetingPassword, displayName) {
  // Verify required dependencies
  const testTool = window.testTool;
  
  if (!testTool) {
    console.error('testTool not available - make sure tool.js is loaded');
    alert('Error: Required SDK tools not loaded. Please refresh the page.');
    return;
  }
  
  // Note: We don't check for ZoomMtg here because it's only loaded on meeting.html
  // The SDK will be initialized by meeting.js after we redirect
  
  const authEndpoint = "http://127.0.0.1:4000";
  
  // Validate inputs
  if (!meetingNumber || meetingNumber.trim().length < 9) {
    alert('Invalid meeting number. Please enter a valid Zoom meeting number.');
    return;
  }
  
  if (!displayName || displayName.trim().length === 0) {
    alert('Display name is required to join the meeting.');
    return;
  }
  
  try {
    console.log('Joining Zoom meeting:', { meetingNumber, displayName });
    
    // Get signature from auth endpoint (required by Zoom SDK)
    // This endpoint generates a JWT signature for the meeting
    const response = await fetch(authEndpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        meetingNumber: meetingNumber,
        role: 0, // Attendee role (0 = attendee, 1 = host)
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auth endpoint returned ${response.status}: ${response.statusText}. ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data) {
      throw new Error('Empty response from auth endpoint');
    }
    
    const signature = data.signature;
    const sdkKey = data.sdkKey;
    
    if (!signature) {
      throw new Error('Invalid response from auth endpoint - missing signature');
    }
    
    if (!sdkKey) {
      throw new Error('Invalid response from auth endpoint - missing sdkKey');
    }
    
    console.log('Auth successful, preparing to join meeting...');
    
    // Build meeting config (same format as prep.js and meeting.js expect)
    // This config is serialized and passed via URL to meeting.html
    const meetingConfig = {
      mn: meetingNumber,
      name: testTool.b64EncodeUnicode(displayName),
      pwd: meetingPassword || '',
      role: 0, // Attendee
      email: '',
      lang: 'en-US',
      signature: signature,
      sdkKey: sdkKey,
      china: 0,
    };
    
    // Serialize config to URL parameters
    // meeting.js will parse these and initialize the Zoom SDK
    const meetingUrl = "/meeting.html?" + testTool.serialize(meetingConfig);
    
    console.log('Redirecting to meeting page:', meetingUrl);
    
    // Navigate to meeting page
    // meeting.js will handle the actual Zoom SDK initialization and join
    window.location.href = meetingUrl;
    
  } catch (error) {
    console.error("Failed to join meeting:", error);
    
    // Provide helpful error messages based on error type
    let errorMessage = 'Failed to join meeting. ';
    
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      errorMessage += 'Unable to connect to authentication server. ';
      errorMessage += 'Please ensure the auth endpoint is running at http://127.0.0.1:4000';
    } else if (error.message.includes('signature') || error.message.includes('sdkKey')) {
      errorMessage += 'Authentication failed. Please check your Zoom SDK credentials are configured correctly.';
    } else if (error.message.includes('400')) {
      errorMessage += 'Invalid meeting number or request. Please check the meeting number and try again.';
    } else if (error.message.includes('401') || error.message.includes('403')) {
      errorMessage += 'Authentication failed. Please check your Zoom SDK credentials.';
    } else {
      errorMessage += error.message;
    }
    
    alert(errorMessage);
  }
}

/**
 * Join Zoom Call without deal context (standalone join)
 */
async function joinZoomCallWithoutDeal() {
  const meetingNumber = prompt('Enter Zoom Meeting Number:');
  if (!meetingNumber || !meetingNumber.trim()) {
    return; // User cancelled
  }
  
  const cleanMeetingNumber = meetingNumber.trim().replace(/\D/g, '');
  
  if (cleanMeetingNumber.length < 9) {
    alert('Invalid meeting number. Please enter a valid Zoom meeting number (9-11 digits).');
    return;
  }
  
  const meetingPassword = prompt('Enter Meeting Password (optional - leave blank if none):');
  const cleanPassword = meetingPassword ? meetingPassword.trim() : null;
  
  // Get display name
  const displayName = localStorage.getItem('celera_display_name') || 
                      sessionStorage.getItem('celera_user_name') || 
                      prompt('Enter your name:') || 'User';
  
  if (!displayName || displayName === 'User') {
    alert('Display name is required');
    return;
  }
  
  // Store basic info
  sessionStorage.setItem('celera_user_name', displayName);
  sessionStorage.setItem('celera_meeting_number', cleanMeetingNumber);
  sessionStorage.setItem('celera_meeting_start_time', new Date().toISOString());
  
  if (cleanPassword) {
    sessionStorage.setItem('celera_meeting_password', cleanPassword);
  }
  
  // Join meeting
  await joinZoomMeeting(cleanMeetingNumber, cleanPassword, displayName);
}

// Keep the old function name for backwards compatibility
async function joinZoomCallDirectly() {
  return joinZoomCall();
}

function loadWarningsTab(deal) {
  const content = document.getElementById('sidebar-warnings-content');
  const warnings = deal.warnings || [];
  
  if (warnings.length === 0) {
    content.innerHTML = '<p style="color: var(--text-secondary);">No warnings</p>';
    return;
  }
  
  content.innerHTML = warnings.map(warning => `
    <div class="activity-item">
      <div class="activity-item-title">⚠️ ${warning}</div>
    </div>
  `).join('');
}

function loadActivityTab(deal) {
  const content = document.getElementById('sidebar-activity-content');
  
  // Load saved activities from session storage
  const dealId = deal.id || currentDealId;
  let activities = [];
  
  // Get deal-specific activities
  if (dealId) {
    const dealActivities = sessionStorage.getItem(`celera_deal_${dealId}_activities`);
    if (dealActivities) {
      try {
        activities = JSON.parse(dealActivities);
      } catch (e) {
        console.error('Failed to parse deal activities:', e);
      }
    }
  }
  
  // Get all activities if no deal-specific ones
  if (activities.length === 0) {
    const allActivities = sessionStorage.getItem('celera_deal_activities');
    if (allActivities) {
      try {
        const parsed = JSON.parse(allActivities);
        // Filter by dealId if available
        if (dealId) {
          activities = parsed.filter(a => a.dealId === dealId);
        } else {
          activities = parsed;
        }
      } catch (e) {
        console.error('Failed to parse activities:', e);
      }
    }
  }
  
  // Add mock activities if none exist
  if (activities.length === 0) {
    activities = [
      {
        title: 'Call with Stakeholder',
        time: '2 weeks ago',
        summary: deal.lastInteractionSummary || 'Last interaction with the client',
        type: 'call'
      },
      {
        title: 'Email Exchange',
        time: '3 weeks ago',
        summary: 'Discussed initial requirements and pricing',
        type: 'email'
      }
    ];
  }
  
  // Sort by date (most recent first)
  activities.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });
  
  content.innerHTML = activities.map(activity => {
    const activityDate = activity.date ? new Date(activity.date) : null;
    const timeStr = activityDate ? formatActivityTime(activityDate) : activity.time || 'Recently';
    const title = activity.type === 'call' ? '📞 Call' : activity.title || 'Activity';
    const summary = activity.debrief || activity.summary || 'No details';
    const participants = activity.participants && activity.participants.length > 0 
      ? ` • ${activity.participants.length} participant${activity.participants.length > 1 ? 's' : ''}`
      : '';
    const duration = activity.duration ? ` • ${activity.duration} min` : '';
    
    return `
      <div class="activity-item">
        <div class="activity-item-header">
          <div class="activity-item-title">${title}</div>
          <div class="activity-item-time">${timeStr}${duration}${participants}</div>
        </div>
        <div class="activity-item-summary">${summary}</div>
        ${activity.nextSteps && activity.nextSteps.length > 0 ? `
          <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 600;">Next Steps:</div>
            <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary); font-size: 0.9rem;">
              ${activity.nextSteps.map(step => `<li>${step}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  if (activities.length === 0) {
    content.innerHTML = '<p style="color: var(--text-secondary);">No activities yet</p>';
  }
}

function formatActivityTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function loadTasksTab(deal) {
  const content = document.getElementById('sidebar-tasks-content');
  
  if (!window.todoService) {
    content.innerHTML = '<p style="color: var(--text-secondary);">Task service not available</p>';
    return;
  }
  
  const dealTasks = window.todoService.getDealTasks(deal.id);
  const allTasks = dealTasks.length > 0 ? dealTasks : window.todoService.getTasks({ dealId: deal.id });
  
  if (allTasks.length === 0) {
    content.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
        <p>No tasks for this deal</p>
        <button class="deal-sidebar-btn" onclick="createQuickTask()" style="margin-top: 1rem;">Create First Task</button>
      </div>
    `;
    return;
  }
  
  content.innerHTML = allTasks.map(task => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const now = new Date();
    let dueDateClass = '';
    let dueDateText = '';
    
    if (dueDate) {
      if (dueDate < now && !task.completed) {
        dueDateClass = 'overdue';
        dueDateText = 'Overdue';
      } else if (dueDate.toDateString() === now.toDateString()) {
        dueDateClass = 'today';
        dueDateText = 'Due today';
      } else {
        dueDateText = formatTaskDate(dueDate);
      }
    }
    
    const isEmailTask = task.metadata?.type === 'email_followup';
    const hasPreComposedEmail = task.metadata?.preComposedEmail !== null && task.metadata?.preComposedEmail !== undefined;
    
    return `
      <div class="activity-item" style="display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.75rem; padding-bottom: ${isEmailTask && hasPreComposedEmail ? '0.75rem' : '0'}; border-bottom: ${isEmailTask && hasPreComposedEmail ? '1px solid var(--border-color)' : 'none'};">
        <input type="checkbox" ${task.completed ? 'checked' : ''} 
               onchange="toggleDealTask('${task.id}')" 
               style="margin-top: 0.25rem; cursor: pointer; width: 18px; height: 18px;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; ${task.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
            ${escapeHtmlTask(task.title)}
            ${isEmailTask ? '<span style="margin-left: 0.5rem; padding: 0.125rem 0.5rem; background: rgba(102, 126, 234, 0.15); color: var(--accent-color); border-radius: 12px; font-size: 0.7rem; font-weight: 600;">📧 Email</span>' : ''}
          </div>
          <div style="display: flex; gap: 0.75rem; font-size: 0.85rem; color: var(--text-secondary); flex-wrap: wrap; margin-bottom: ${isEmailTask && hasPreComposedEmail ? '0.5rem' : '0'};">
            ${dueDate ? `<span style="${dueDateClass === 'overdue' ? 'color: var(--error-color); font-weight: 600;' : dueDateClass === 'today' ? 'color: var(--warning-color); font-weight: 600;' : ''}">📅 ${dueDateText}</span>` : ''}
            <span style="padding: 0.25rem 0.5rem; background: ${task.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : task.priority === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(156, 163, 175, 0.15)'}; border-radius: 12px; font-size: 0.75rem; color: ${task.priority === 'high' ? 'var(--error-color)' : task.priority === 'medium' ? 'var(--warning-color)' : 'var(--text-secondary)'};">
              ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
            ${task.source === 'call' ? '<span>📞 From call</span>' : ''}
          </div>
          ${isEmailTask && hasPreComposedEmail ? `
            <button class="deal-sidebar-btn" onclick="window.location.href='/todo.html?taskId=${task.id}'" style="width: 100%; margin-top: 0.5rem; background: var(--accent-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">
              📧 View & Send Email
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function toggleDealTask(taskId) {
  if (window.todoService) {
    window.todoService.toggleTask(taskId);
    // Reload tasks tab if currently viewing it
    if (currentDealData) {
      const activeTab = document.querySelector('.deal-sidebar-tab.active');
      if (activeTab && activeTab.dataset.tab === 'tasks') {
        loadTasksTab(currentDealData);
      }
    }
  }
}

/**
 * Send email from task (opens modal to view and send)
 * This function can be called from deal sidebar tasks tab
 */
async function sendEmailFromTask(taskId) {
  // Redirect to todo page with task modal open, or open modal if we're on todo page
  if (window.location.pathname.includes('todo.html')) {
    // We're on todo page, just open the modal
    if (typeof editTask === 'function') {
      editTask(taskId);
    }
  } else {
    // We're on deal sidebar, redirect to todo page
    window.location.href = `/todo.html?taskId=${taskId}`;
  }
}

function createQuickTask() {
  if (!currentDealData) {
    alert('No deal selected');
    return;
  }
  
  const taskTitle = prompt('Enter task title:');
  if (!taskTitle || !taskTitle.trim()) {
    return;
  }
  
  if (!window.todoService) {
    alert('Task service not available');
    return;
  }
  
  const task = window.todoService.createTask({
    title: taskTitle.trim(),
    dealId: currentDealData.id,
    dealName: currentDealData.accountName || currentDealData.name,
    priority: 'medium',
    source: 'manual'
  });
  
  // Reload tasks tab if currently viewing it
  const activeTab = document.querySelector('.deal-sidebar-tab.active');
  if (activeTab && activeTab.dataset.tab === 'tasks') {
    loadTasksTab(currentDealData);
  } else {
    // Switch to tasks tab
    switchTab('tasks');
  }
}

function formatTaskDate(date) {
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtmlTask(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


function openInCRM() {
  if (currentDealId) {
    // In production, this would open the deal in the CRM system
    alert(`Opening deal ${currentDealId} in CRM...`);
  }
}

function reviewAccount() {
  if (currentDealId) {
    // Switch to Review Account tab in sidebar
    switchTab('review');
  }
}

// Close sidebar when clicking outside
document.addEventListener('click', function(e) {
  const sidebar = document.getElementById('deal-sidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && !e.target.closest('.deals-table tbody tr')) {
      // Don't close if clicking on table rows (they should open sidebar)
      if (!e.target.closest('.deals-table')) {
        closeDealSidebar();
      }
    }
  }
});

// Add to deal (secondary action)
function addToDeal(dealId) {
  event.stopPropagation();
  console.log('Add to deal:', dealId);
  // Implement add functionality
}

// Search functionality
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('deal-search');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#deals-table-body tr');
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }
  
  // Load pipeline on page load
  loadPipeline();
  
  // Check for URL parameters to open deal sidebar
  const urlParams = new URLSearchParams(window.location.search);
  const dealId = urlParams.get('dealId');
  const tab = urlParams.get('tab') || 'contacts';
  
  if (dealId) {
    // Find deal and open sidebar
    setTimeout(() => {
      const deals = window.dataService?.getDeals() || [];
      const deal = deals.find(d => d.id === dealId);
      if (deal) {
        openDealSidebar(deal);
        // Switch to specified tab
        setTimeout(() => {
          switchTab(tab);
        }, 100);
      }
    }, 500);
  }
});



