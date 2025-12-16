window.addEventListener("DOMContentLoaded", function (event) {
  console.log("Pre-call prep screen loaded");
  initializePrepScreen();
});

async function initializePrepScreen() {
  const testTool = window.testTool;
  
  // Initialize graph service
  if (window.graphService && !window.graphService.initialized) {
    await window.graphService.initialize();
  }
  
  // Check if we have a dealId or leadDealId parameter (coming from pipeline)
  const urlParams = testTool.parseQuery();
  const dealId = urlParams.dealId || urlParams.leadDealId;
  if (dealId) {
    // Load data from data service
    await loadLeadDealData(dealId);
  } else {
    // Load mock CRM data (in production, this would come from your CRM API)
    await loadMockCRMData();
  }
  
  // Handle form submission (if form exists - new design uses different form handling)
  const joinForm = document.getElementById("join-form");
  if (joinForm) {
    joinForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      await handleJoinCall();
    });
  }
  
  // Auto-fill meeting details from URL params if present (for old form structure)
  const meetingNumberInput = document.getElementById("meeting-number");
  const meetingPasswordInput = document.getElementById("meeting-password");
  if (meetingNumberInput && urlParams.mn) {
    meetingNumberInput.value = urlParams.mn;
  }
  if (meetingPasswordInput && urlParams.pwd) {
    meetingPasswordInput.value = urlParams.pwd;
  }
}

async function loadLeadDealData(leadDealId) {
  try {
    const data = await window.dataService.getLeadDeal(leadDealId);
    
    // Initialize graph service if not already done
    if (!window.graphService.initialized) {
      await window.graphService.initialize();
    }
    
    // Populate the UI with data from data service
    const accountNameEl = document.getElementById("account-name");
    const industryEl = document.getElementById("industry");
    const companySizeEl = document.getElementById("company-size");
    const locationEl = document.getElementById("location");
    const dealNameEl = document.getElementById("deal-name");
    const dealValueEl = document.getElementById("deal-value");
    const dealStageEl = document.getElementById("deal-stage");
    const dealProbabilityEl = document.getElementById("deal-probability");
    const lastInteractionDateEl = document.getElementById("last-interaction-date");
    const lastInteractionSummaryEl = document.getElementById("last-interaction-summary");
    
    if (accountNameEl) accountNameEl.textContent = data.accountName || data.name;
    if (industryEl) industryEl.textContent = data.industry || "-";
    if (companySizeEl) companySizeEl.textContent = data.companySize || "-";
    if (locationEl) locationEl.textContent = data.location || "-";
    if (dealNameEl) dealNameEl.textContent = data.dealName || "-";
    if (dealValueEl) {
      // Format deal value for new design (convert to K/M format)
      const value = data.dealValue || "-";
      if (value !== "-" && typeof value === 'string') {
        // Extract numeric value
        const numValue = parseInt(value.replace(/[^0-9]/g, ''));
        if (!isNaN(numValue)) {
          if (numValue >= 1000000) {
            dealValueEl.textContent = `$${(numValue / 1000000).toFixed(1)}M`;
          } else if (numValue >= 1000) {
            dealValueEl.textContent = `$${(numValue / 1000).toFixed(0)}K`;
          } else {
            dealValueEl.textContent = `$${numValue}`;
          }
        } else {
          dealValueEl.textContent = value;
        }
      } else if (typeof value === 'number') {
        // Handle numeric value directly
        if (value >= 1000000) {
          dealValueEl.textContent = `$${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
          dealValueEl.textContent = `$${(value / 1000).toFixed(0)}K`;
        } else {
          dealValueEl.textContent = `$${value}`;
        }
      } else {
        dealValueEl.textContent = value;
      }
    }
    if (dealStageEl) dealStageEl.textContent = data.dealStage || "-";
    if (dealProbabilityEl) dealProbabilityEl.textContent = data.dealProbability || "-";
    if (lastInteractionDateEl) lastInteractionDateEl.textContent = data.lastInteractionDate || "-";
    if (lastInteractionSummaryEl) lastInteractionSummaryEl.textContent = data.lastInteractionSummary || "-";
    
    // Populate contacts with influence scores from graph service
    const contactsList = document.getElementById("contacts-list");
    contactsList.innerHTML = "";
    if (data.contacts && data.contacts.length > 0) {
      data.contacts.forEach(contact => {
        // Find contact in graph service to get influence score
        const graphContact = window.graphService.nodes.find(n => 
          n.type === 'contact' && 
          n.name.toLowerCase().includes(contact.name.toLowerCase().split(' ')[0])
        );
        
        const influenceScore = graphContact?.influenceScore || 0;
        const influenceClass = influenceScore >= 70 ? 'influence-high' : 
                              influenceScore >= 50 ? 'influence-medium' : 'influence-low';
        
        const li = document.createElement("li");
        li.className = "contact-item";
        li.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div class="contact-name">${contact.name}</div>
              <div class="contact-role">${contact.role}</div>
            </div>
            ${influenceScore > 0 ? `
              <div>
                <span class="influence-badge ${influenceClass}">${influenceScore}</span>
              </div>
            ` : ''}
          </div>
        `;
        contactsList.appendChild(li);
      });
    }
    
    // Pre-fill meeting details if available (for old form structure)
    const meetingNumberInput = document.getElementById("meeting-number");
    const meetingPasswordInput = document.getElementById("meeting-password");
    if (data.meetingNumber && meetingNumberInput) {
      meetingNumberInput.value = data.meetingNumber;
    }
    if (data.meetingPassword && meetingPasswordInput) {
      meetingPasswordInput.value = data.meetingPassword;
    }
    
    // Store CRM context for post-call summary
    sessionStorage.setItem("celera_crm_context", JSON.stringify(data));
    sessionStorage.setItem("celera_lead_deal_id", leadDealId);
    
  } catch (error) {
    console.error("Failed to load lead/deal data:", error);
    // Fall back to mock data
    loadMockCRMData();
  }
}

async function loadMockCRMData() {
  // Mock CRM data - in production, fetch from your CRM API
  const mockData = {
    accountName: "Acme Corporation",
    industry: "Technology",
    companySize: "500-1000 employees",
    location: "San Francisco, CA",
    dealName: "Q4 Enterprise License",
    dealValue: "$250,000",
    dealStage: "Negotiation",
    dealProbability: "75%",
    lastInteractionDate: "2 weeks ago",
    lastInteractionSummary: "Discussed pricing and implementation timeline. Client is evaluating our solution against competitor. Decision expected by end of month.",
    contacts: [
      { name: "Sarah Johnson", role: "VP of Engineering" },
      { name: "Michael Chen", role: "CTO" },
      { name: "Emily Rodriguez", role: "Procurement Manager" }
    ]
  };
  
  // Populate the UI with mock data
  const accountNameEl = document.getElementById("account-name");
  const industryEl = document.getElementById("industry");
  const companySizeEl = document.getElementById("company-size");
  const locationEl = document.getElementById("location");
  const dealNameEl = document.getElementById("deal-name");
  const dealValueEl = document.getElementById("deal-value");
  const dealStageEl = document.getElementById("deal-stage");
  const dealProbabilityEl = document.getElementById("deal-probability");
  const lastInteractionDateEl = document.getElementById("last-interaction-date");
  const lastInteractionSummaryEl = document.getElementById("last-interaction-summary");
  
  if (accountNameEl) accountNameEl.textContent = mockData.accountName;
  if (industryEl) industryEl.textContent = mockData.industry;
  if (companySizeEl) companySizeEl.textContent = mockData.companySize;
  if (locationEl) locationEl.textContent = mockData.location;
  if (dealNameEl) dealNameEl.textContent = mockData.dealName;
  if (dealValueEl) {
    // Format deal value for new design (convert to K/M format)
    const value = mockData.dealValue || "-";
    if (value !== "-" && typeof value === 'string') {
      // Extract numeric value
      const numValue = parseInt(value.replace(/[^0-9]/g, ''));
      if (!isNaN(numValue)) {
        if (numValue >= 1000000) {
          dealValueEl.textContent = `$${(numValue / 1000000).toFixed(1)}M`;
        } else if (numValue >= 1000) {
          dealValueEl.textContent = `$${(numValue / 1000).toFixed(0)}K`;
        } else {
          dealValueEl.textContent = `$${numValue}`;
        }
      } else {
        dealValueEl.textContent = value;
      }
    } else {
      dealValueEl.textContent = value;
    }
  }
  if (dealStageEl) dealStageEl.textContent = mockData.dealStage;
  if (dealProbabilityEl) dealProbabilityEl.textContent = mockData.dealProbability;
  if (lastInteractionDateEl) lastInteractionDateEl.textContent = mockData.lastInteractionDate;
  if (lastInteractionSummaryEl) lastInteractionSummaryEl.textContent = mockData.lastInteractionSummary;
  
  // Initialize graph service if not already done
  if (window.graphService && !window.graphService.initialized) {
    await window.graphService.initialize();
  }
  
  // Populate contacts with influence scores
  const contactsList = document.getElementById("contacts-list");
  contactsList.innerHTML = "";
  mockData.contacts.forEach(contact => {
    // Find contact in graph service to get influence score
    const graphContact = window.graphService?.nodes.find(n => 
      n.type === 'contact' && 
      n.name.toLowerCase().includes(contact.name.toLowerCase().split(' ')[0])
    );
    
    const influenceScore = graphContact?.influenceScore || 0;
    const influenceClass = influenceScore >= 70 ? 'influence-high' : 
                          influenceScore >= 50 ? 'influence-medium' : 'influence-low';
    
    const li = document.createElement("li");
    li.className = "contact-item";
    li.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="contact-name">${contact.name}</div>
          <div class="contact-role">${contact.role}</div>
        </div>
        ${influenceScore > 0 ? `
          <div>
            <span class="influence-badge ${influenceClass}">${influenceScore}</span>
          </div>
        ` : ''}
      </div>
    `;
    contactsList.appendChild(li);
  });
  
  // Store CRM context for post-call summary
  sessionStorage.setItem("celera_crm_context", JSON.stringify(mockData));
}

async function handleJoinCall() {
  const testTool = window.testTool;
  const authEndpoint = "http://127.0.0.1:4000";
  
  const displayName = document.getElementById("display-name").value;
  const meetingNumber = document.getElementById("meeting-number").value;
  const meetingPassword = document.getElementById("meeting-password").value;
  
  if (!displayName || !meetingNumber) {
    alert("Please enter your name and meeting number");
    return;
  }
  
  // Store user info for post-call summary
  sessionStorage.setItem("celera_user_name", displayName);
  sessionStorage.setItem("celera_meeting_number", meetingNumber);
  sessionStorage.setItem("celera_meeting_start_time", new Date().toISOString());
  
  try {
    // Get signature from auth endpoint
    const response = await fetch(authEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingNumber: meetingNumber,
        role: 0, // Attendee by default
      }),
    });
    
    const data = await response.json();
    const signature = data.signature;
    const sdkKey = data.sdkKey; // Extract sdkKey from auth response
    
    // Build meeting config
    const meetingConfig = {
      mn: meetingNumber,
      name: testTool.b64EncodeUnicode(displayName),
      pwd: meetingPassword,
      role: 0, // Attendee
      email: "",
      lang: "en-US",
      signature: signature,
      sdkKey: sdkKey, // Include sdkKey
      china: 0,
    };
    
    // Navigate to meeting page
    const meetingUrl = "/meeting.html?" + testTool.serialize(meetingConfig);
    window.location.href = meetingUrl;
    
  } catch (error) {
    console.error("Failed to get signature", error);
    alert("Failed to authenticate. Please check your meeting credentials.");
  }
}

