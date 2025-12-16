window.addEventListener("DOMContentLoaded", async function (event) {
  console.log("Call debrief screen loaded");
  
  // Initialize services
  if (window.graphService) {
    if (!window.graphService.initialized) {
      await window.graphService.initialize();
    }
  }
  
  // Load and auto-populate debrief
  await initializeDebrief();
});

async function initializeDebrief() {
  // Get call data from session storage
  const userName = sessionStorage.getItem("celera_user_name") || "Unknown";
  const meetingNumber = sessionStorage.getItem("celera_meeting_number") || "-";
  const meetingStartTime = sessionStorage.getItem("celera_meeting_start_time");
  const meetingEndTime = sessionStorage.getItem("celera_meeting_end_time") || new Date().toISOString();
  const dealId = sessionStorage.getItem("celera_lead_deal_id");
  
  // Load CRM context
  const crmContextStr = sessionStorage.getItem("celera_crm_context");
  let crmContext = null;
  if (crmContextStr) {
    try {
      crmContext = JSON.parse(crmContextStr);
    } catch (e) {
      console.error("Failed to parse CRM context", e);
    }
  }
  
  // Calculate call duration
  let callDuration = 0;
  if (meetingStartTime) {
    const start = new Date(meetingStartTime);
    const end = new Date(meetingEndTime);
    callDuration = Math.floor((end - start) / 60000); // minutes
  }
  
  // Auto-populate participants
  await loadParticipants(userName);
  
  // Auto-populate debrief from AI transcription/analysis
  await loadAutoDebrief(meetingNumber, callDuration, crmContext);
  
  // Auto-populate next steps from AI analysis
  await loadAutoNextSteps(crmContext);
  
  // Track call completion
  if (dealId && window.graphService) {
    trackCallCompletion(dealId, callDuration, crmContext);
  }
}

async function loadParticipants(userName) {
  // Get participants from meeting data or session storage
  // In production, this would come from Zoom API
  const participantsData = sessionStorage.getItem("celera_meeting_participants");
  let participants = [];
  
  if (participantsData) {
    try {
      participants = JSON.parse(participantsData);
    } catch (e) {
      console.error("Failed to parse participants", e);
    }
  }
  
  // If no participants stored, use mock/default
  if (participants.length === 0) {
    const crmContextStr = sessionStorage.getItem("celera_crm_context");
    if (crmContextStr) {
      try {
        const crmContext = JSON.parse(crmContextStr);
        if (crmContext.contacts) {
          participants = crmContext.contacts.map(c => 
            typeof c === 'object' ? c.name : c
          );
        }
      } catch (e) {
        console.error("Failed to parse CRM context for participants", e);
      }
    }
  }
  
  // Always include current user
  if (!participants.includes(userName) && !participants.some(p => 
    p.toLowerCase().includes(userName.toLowerCase()) || 
    p.toLowerCase() === "you" ||
    p.toLowerCase() === "me"
  )) {
    participants.push(userName);
  }
  
  // Render participants
  const participantsList = document.getElementById("participants-list");
  participantsList.innerHTML = "";
  
  participants.forEach(participant => {
    const badge = document.createElement("span");
    badge.className = "participant-badge";
    const isYou = participant.toLowerCase().includes(userName.toLowerCase()) || 
                   participant.toLowerCase() === "you" ||
                   participant.toLowerCase() === "me" ||
                   participant === userName;
    if (isYou) {
      badge.classList.add("you");
      badge.textContent = "You";
    } else {
      badge.textContent = participant;
    }
    participantsList.appendChild(badge);
  });
}

async function loadAutoDebrief(meetingNumber, duration, crmContext) {
  const debriefEditor = document.getElementById("debrief-editor");
  
  // Try to get AI-generated debrief from session storage or API
  // In production, this would come from your AI transcription service
  const aiDebrief = sessionStorage.getItem("celera_ai_debrief");
  
  if (aiDebrief) {
    debriefEditor.textContent = aiDebrief;
  } else {
    // Generate mock debrief based on call context
    let debriefText = `Call Summary:\n\n`;
    
    if (crmContext) {
      debriefText += `Discussed ${crmContext.dealName || 'the deal'} with ${crmContext.accountName || 'the client'}.\n\n`;
    }
    
    debriefText += `Key discussion points:\n`;
    debriefText += `• Reviewed current requirements and needs\n`;
    debriefText += `• Discussed potential solutions and next steps\n`;
    debriefText += `• Addressed questions and concerns\n\n`;
    
    debriefText += `Call duration: ${duration} minutes\n`;
    debriefText += `Meeting ID: ${meetingNumber}`;
    
    debriefEditor.textContent = debriefText;
  }
  
  // Set placeholder behavior
  debriefEditor.addEventListener('focus', function() {
    if (this.textContent.trim() === '') {
      this.textContent = '';
    }
  });
}

async function loadAutoNextSteps(crmContext) {
  const nextStepsList = document.getElementById("next-steps-list");
  nextStepsList.innerHTML = "";
  
  // Try to get AI-generated next steps
  const aiNextSteps = sessionStorage.getItem("celera_ai_next_steps");
  let nextSteps = [];
  
  if (aiNextSteps) {
    try {
      nextSteps = JSON.parse(aiNextSteps);
    } catch (e) {
      console.error("Failed to parse next steps", e);
    }
  }
  
  // If no AI next steps, generate defaults
  if (nextSteps.length === 0) {
    nextSteps = [
      "Follow up with proposal document",
      "Schedule next meeting",
      "Send meeting notes to participants"
    ];
    
    if (crmContext) {
      nextSteps.unshift(`Update CRM with call notes for ${crmContext.dealName || 'deal'}`);
    }
  }
  
  // Render next steps
  nextSteps.forEach((step, index) => {
    addNextStepItem(step, index);
  });
}

function addNextStepItem(text = '', index = null) {
  const nextStepsList = document.getElementById("next-steps-list");
  const li = document.createElement("li");
  li.className = "next-step-item";
  
  const input = document.createElement("input");
  input.type = "text";
  input.value = text;
  input.placeholder = "Enter next step...";
  
  const removeBtn = document.createElement("button");
  removeBtn.className = "next-step-remove";
  removeBtn.textContent = "×";
  removeBtn.onclick = () => {
    li.remove();
  };
  
  li.appendChild(input);
  li.appendChild(removeBtn);
  
  if (index !== null) {
    nextStepsList.insertBefore(li, nextStepsList.children[index]);
  } else {
    nextStepsList.appendChild(li);
  }
  
  return li;
}

function addNextStep() {
  addNextStepItem();
  // Focus the new input
  const inputs = document.querySelectorAll('.next-step-item input');
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus();
  }
}

async function saveDebrief() {
  // Get debrief content
  const debriefText = document.getElementById("debrief-editor").textContent.trim();
  
  // Get next steps
  const nextSteps = Array.from(document.querySelectorAll('.next-step-item input'))
    .map(input => input.value.trim())
    .filter(step => step.length > 0);
  
  // Get participants
  const participants = Array.from(document.querySelectorAll('.participant-badge'))
    .map(badge => badge.textContent)
    .filter(p => p !== "You");
  
  // Get call metadata
  const meetingNumber = sessionStorage.getItem("celera_meeting_number");
  const meetingStartTime = sessionStorage.getItem("celera_meeting_start_time");
  const meetingEndTime = sessionStorage.getItem("celera_meeting_end_time") || new Date().toISOString();
  const dealId = sessionStorage.getItem("celera_lead_deal_id");
  const userName = sessionStorage.getItem("celera_user_name") || "Unknown";
  
  // Calculate duration
  let duration = 0;
  if (meetingStartTime) {
    const start = new Date(meetingStartTime);
    const end = new Date(meetingEndTime);
    duration = Math.floor((end - start) / 60000);
  }
  
  // Create activity entry
  const activityEntry = {
    id: `call_${Date.now()}`,
    type: 'call',
    date: meetingEndTime,
    duration: duration,
    participants: participants,
    debrief: debriefText,
    nextSteps: nextSteps,
    meetingNumber: meetingNumber,
    userName: userName,
    metadata: {
      savedAt: new Date().toISOString()
    }
  };
  
  // Save to deal's activity (if dealId exists)
  if (dealId && window.dataService) {
    try {
      // Save activity to deal
      await window.dataService.saveDealActivity(dealId, activityEntry);
    } catch (error) {
      console.error("Failed to save activity to deal:", error);
    }
  }
  
  // Track in graph service
  if (window.graphService) {
    const crmContextStr = sessionStorage.getItem("celera_crm_context");
    if (crmContextStr) {
      try {
        const crmContext = JSON.parse(crmContextStr);
        if (crmContext.contacts) {
          crmContext.contacts.forEach(contact => {
            const contactName = typeof contact === 'object' ? contact.name : contact;
            const graphContact = window.graphService.nodes.find(n => 
              n.type === 'contact' && 
              n.name.toLowerCase().includes(contactName.toLowerCase().split(' ')[0])
            );
            
            if (graphContact) {
              window.graphService.trackInteraction(graphContact.id, 'call', {
                duration: duration,
                dealId: dealId,
                completed: true,
                notes: debriefText,
                nextSteps: nextSteps
              });
            }
          });
        }
      } catch (e) {
        console.error('Failed to track call interactions:', e);
      }
    }
  }
  
  // Store in session storage for activity tab
  const existingActivities = JSON.parse(sessionStorage.getItem("celera_deal_activities") || "[]");
  existingActivities.push(activityEntry);
  sessionStorage.setItem("celera_deal_activities", JSON.stringify(existingActivities));
  
  // Also store per-deal if dealId exists
  if (dealId) {
    const dealActivities = JSON.parse(sessionStorage.getItem(`celera_deal_${dealId}_activities`) || "[]");
    dealActivities.push(activityEntry);
    sessionStorage.setItem(`celera_deal_${dealId}_activities`, JSON.stringify(dealActivities));
  }
  
  // Redirect to pipeline (or deal if dealId exists)
  if (dealId) {
    window.location.href = `/sales/pipeline.html?dealId=${dealId}&tab=activity`;
  } else {
    window.location.href = '/sales/pipeline.html';
  }
}

function trackCallCompletion(dealId, duration, crmContext) {
  // This is called during initialization to track the call
  if (window.graphService && crmContext && crmContext.contacts) {
    crmContext.contacts.forEach(contact => {
      const contactName = typeof contact === 'object' ? contact.name : contact;
      const graphContact = window.graphService.nodes.find(n => 
        n.type === 'contact' && 
        n.name.toLowerCase().includes(contactName.toLowerCase().split(' ')[0])
      );
      
      if (graphContact) {
        window.graphService.trackInteraction(graphContact.id, 'call', {
          duration: duration,
          dealId: dealId,
          completed: true
        });
      }
    });
  }
}
