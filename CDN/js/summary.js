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
  
  // Auto-create tasks from meeting (including email follow-up and reschedule)
  // This replaces the old "next steps" section - tasks are created automatically
  await createMeetingTasksFromDebrief(crmContext);
  
  // Load meeting-specific tasks to display
  await loadMeetingTasks(meetingNumber, dealId, crmContext);
  
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

/**
 * Create meeting tasks from debrief context
 * This replaces the old "next steps" section - tasks are created automatically
 */
async function createMeetingTasksFromDebrief(crmContext) {
  if (!window.todoService) {
    return;
  }

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
      "Update CRM with call notes"
    ];
    
    if (crmContext) {
      nextSteps.unshift(`Update CRM with call notes for ${crmContext.dealName || 'deal'}`);
    }
  }
  
  // Create tasks (this will also create email follow-up and reschedule tasks)
  await createMeetingTasks(nextSteps, crmContext);
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
  
  // Get participants
  const participants = Array.from(document.querySelectorAll('.participant-badge'))
    .map(badge => badge.textContent)
    .filter(p => p !== "You");
  
  // Get next steps from task titles (if user edited them)
  const nextSteps = [];
  const meetingNumber = sessionStorage.getItem("celera_meeting_number");
  const meetingTaskIds = sessionStorage.getItem(`celera_meeting_${meetingNumber}_tasks`);
  
  if (meetingTaskIds && window.todoService) {
    try {
      const taskIds = JSON.parse(meetingTaskIds);
      const allTasks = window.todoService.getTasks();
      taskIds.forEach(taskId => {
        const task = allTasks.find(t => t.id === taskId);
        if (task && task.metadata?.type !== 'email_followup' && task.metadata?.type !== 'reschedule_meeting') {
          nextSteps.push(task.title);
        }
      });
    } catch (e) {
      console.error('Failed to parse task IDs for next steps', e);
    }
  }
  
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
  
  // Tasks are already created in loadAutoNextSteps/createMeetingTasks
  // Just ensure they're linked to this activity
  if (window.todoService) {
    const meetingNumber = sessionStorage.getItem("celera_meeting_number");
    const meetingTaskIds = sessionStorage.getItem(`celera_meeting_${meetingNumber}_tasks`);
    
    if (meetingTaskIds) {
      try {
        const taskIds = JSON.parse(meetingTaskIds);
        // Update tasks with activity ID
        const allTasks = window.todoService.getTasks();
        taskIds.forEach(taskId => {
          const task = allTasks.find(t => t.id === taskId);
          if (task) {
            window.todoService.updateTask(taskId, {
              metadata: {
                ...task.metadata,
                activityId: activityEntry.id
              }
            });
          }
        });
      } catch (e) {
        console.error('Failed to update task metadata:', e);
      }
    }
  }
  
  // Trigger orchestrator re-analysis if on dashboard
  if (window.salesOrchestratorService && window.location.pathname.includes('dashboard')) {
    // Debounce: only re-analyze if dashboard is loaded
    setTimeout(() => {
      if (typeof loadOrchestrator === 'function') {
        loadOrchestrator();
      }
    }, 1000);
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

/**
 * Create tasks from meeting (including email follow-up)
 */
async function createMeetingTasks(nextSteps, crmContext) {
  if (!window.todoService) {
    return;
  }

  const meetingNumber = sessionStorage.getItem("celera_meeting_number");
  const meetingEndTime = sessionStorage.getItem("celera_meeting_end_time") || new Date().toISOString();
  const dealId = sessionStorage.getItem("celera_lead_deal_id");
  const userName = sessionStorage.getItem("celera_user_name") || "Unknown";
  
  // Get participants
  const participantsData = sessionStorage.getItem("celera_meeting_participants");
  let participants = [];
  if (participantsData) {
    try {
      participants = JSON.parse(participantsData);
    } catch (e) {
      console.error("Failed to parse participants", e);
    }
  }
  
  // Get from CRM context if available
  if (participants.length === 0 && crmContext && crmContext.contacts) {
    participants = crmContext.contacts.map(c => typeof c === 'object' ? c.name : c);
  }
  
  // Always add email follow-up task (high priority, due tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0); // 5 PM tomorrow
  
  // Pre-compose email so it's ready to send
  let preComposedEmail = null;
  if (window.emailService) {
    try {
      const debriefText = document.getElementById("debrief-editor")?.textContent.trim() || '';
      preComposedEmail = window.emailService.generateFollowUpEmail({
        debrief: debriefText,
        participants: participants,
        dealName: crmContext?.dealName || null,
        accountName: crmContext?.accountName || null,
        nextSteps: nextSteps
      });
    } catch (e) {
      console.error('Failed to pre-compose email:', e);
    }
  }
  
  const emailFollowUpTask = window.todoService.createTask({
    title: `Send follow-up email: ${crmContext?.dealName || crmContext?.accountName || 'Meeting'}`,
    description: 'Follow-up email to meeting participants',
    dealId: dealId,
    dealName: crmContext?.dealName || crmContext?.accountName || null,
    contactId: participants.length > 0 ? participants[0] : null,
    contactName: participants.length > 0 ? participants[0] : null,
    dueDate: tomorrow.toISOString(),
    priority: 'high',
    source: 'call',
    sourceId: `call_${meetingNumber}`,
    metadata: {
      type: 'email_followup',
      meetingNumber: meetingNumber,
      participants: participants,
      callDate: meetingEndTime,
      preComposedEmail: preComposedEmail // Store pre-composed email
    }
  });
  
  // Calculate suggested follow-up meeting date based on deal stage
  const followUpDate = calculateFollowUpDate(crmContext, dealId);
  
  // Always add reschedule meeting task
  const rescheduleTask = window.todoService.createTask({
    title: `Schedule follow-up meeting: ${crmContext?.dealName || crmContext?.accountName || 'Deal'}`,
    description: `Follow-up meeting with ${participants.length > 0 ? participants.join(', ') : 'participants'}`,
    dealId: dealId,
    dealName: crmContext?.dealName || crmContext?.accountName || null,
    contactId: participants.length > 0 ? participants[0] : null,
    contactName: participants.length > 0 ? participants[0] : null,
    dueDate: followUpDate.toISOString(),
    priority: 'high',
    source: 'call',
    sourceId: `call_${meetingNumber}`,
    metadata: {
      type: 'reschedule_meeting',
      meetingNumber: meetingNumber,
      participants: participants,
      callDate: meetingEndTime,
      suggestedDate: followUpDate.toISOString(),
      suggestedDuration: 30 // 30 minutes default
    }
  });
  
  // Create tasks from other next steps
  if (nextSteps.length > 0) {
    const context = {
      dealId: dealId,
      dealName: crmContext?.dealName || crmContext?.accountName || null,
      contactId: participants.length > 0 ? participants[0] : null,
      contactName: participants.length > 0 ? participants[0] : null,
      callId: `call_${meetingNumber}`,
      callDate: meetingEndTime,
      callDuration: 0, // Will be calculated
      participants: participants,
      priority: 'medium'
    };
    
    // Filter out email follow-up from next steps (we already created it)
    const otherSteps = nextSteps.filter(step => 
      !step.toLowerCase().includes('email') && 
      !step.toLowerCase().includes('follow-up email')
    );
    
    if (otherSteps.length > 0) {
      window.todoService.createTasksFromNextSteps(otherSteps, context);
    }
  }
  
  // Store meeting task IDs for display
  const allTasks = window.todoService.getTasks();
  const meetingTaskIds = allTasks
    .filter(t => 
      (t.metadata?.meetingNumber === meetingNumber || t.id === emailFollowUpTask.id || t.id === rescheduleTask.id) &&
      (t.metadata?.type === 'email_followup' || t.metadata?.type === 'reschedule_meeting' || t.source === 'call')
    )
    .map(t => t.id);
  sessionStorage.setItem(`celera_meeting_${meetingNumber}_tasks`, JSON.stringify(meetingTaskIds));
}

/**
 * Calculate suggested follow-up meeting date based on deal stage/probability
 */
function calculateFollowUpDate(crmContext, dealId) {
  const now = new Date();
  let daysToAdd = 7; // Default: 1 week
  
  // Try to get deal data for smart scheduling
  let deal = null;
  if (dealId && window.dataService) {
    try {
      const deals = window.dataService.getDeals();
      deal = deals.find(d => d.id === dealId);
    } catch (e) {
      console.error('Failed to get deal for scheduling:', e);
    }
  }
  
  // Smart scheduling based on deal stage/probability
  if (deal) {
    const stage = deal.stage || deal.dealStage || '';
    const probability = deal.probability || 0;
    
    if (probability >= 80 || stage === 'negotiation' || stage === 'closed-won') {
      daysToAdd = 3; // Hot deal: 3 days
    } else if (probability >= 50 || stage === 'proposal' || stage === 'presentation') {
      daysToAdd = 5; // Warm: 5 days
    } else if (probability >= 20 || stage === 'qualification' || stage === 'discovery') {
      daysToAdd = 10; // Early stage: 10 days
    } else {
      daysToAdd = 14; // Cold/early: 2 weeks
    }
  } else if (crmContext) {
    // Fallback: use deal stage from context
    const stage = crmContext.dealStage || '';
    if (stage.includes('negotiation') || stage.includes('proposal')) {
      daysToAdd = 5;
    } else if (stage.includes('qualification') || stage.includes('discovery')) {
      daysToAdd = 10;
    }
  }
  
  const followUpDate = new Date(now);
  followUpDate.setDate(followUpDate.getDate() + daysToAdd);
  
  // Set to 2 PM on that day (good meeting time)
  followUpDate.setHours(14, 0, 0, 0);
  
  return followUpDate;
}

/**
 * Load and display meeting-specific tasks
 */
async function loadMeetingTasks(meetingNumber, dealId, crmContext) {
  const tasksContainer = document.getElementById('meeting-tasks-list');
  
  if (!window.todoService) {
    tasksContainer.innerHTML = '<p style="color: var(--text-secondary);">Task service not available</p>';
    return;
  }
  
  // Get tasks for this meeting
  const meetingTaskIds = sessionStorage.getItem(`celera_meeting_${meetingNumber}_tasks`);
  let meetingTasks = [];
  
  if (meetingTaskIds) {
    try {
      const taskIds = JSON.parse(meetingTaskIds);
      const allTasks = window.todoService.getTasks();
      meetingTasks = allTasks.filter(t => taskIds.includes(t.id));
    } catch (e) {
      console.error('Failed to parse meeting task IDs:', e);
    }
  }
  
  // Also get tasks by dealId and source
  if (meetingTasks.length === 0 && dealId) {
    const dealTasks = window.todoService.getTasks({ dealId });
    meetingTasks = dealTasks.filter(t => 
      t.source === 'call' && 
      t.metadata?.meetingNumber === meetingNumber
    );
  }
  
  if (meetingTasks.length === 0) {
    tasksContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📋</div>
        <p>Tasks are being created...</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">They will appear here and be added to your <a href="/todo.html" style="color: var(--accent-color);">Tasks page</a></p>
      </div>
    `;
    return;
  }
  
  // Render tasks
  tasksContainer.innerHTML = meetingTasks.map(task => {
    const isEmailTask = task.metadata?.type === 'email_followup';
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const now = new Date();
    let dueDateText = '';
    let dueDateClass = '';
    
    if (dueDate) {
      if (dueDate < now && !task.completed) {
        dueDateClass = 'overdue';
        dueDateText = 'Overdue';
      } else if (dueDate.toDateString() === now.toDateString()) {
        dueDateClass = 'today';
        dueDateText = 'Due today';
      } else {
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          dueDateText = 'Due tomorrow';
        } else {
          dueDateText = `Due in ${diffDays} days`;
        }
      }
    }
    
    const isRescheduleTask = task.metadata?.type === 'reschedule_meeting';
    
    return `
      <div class="meeting-task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
        <div class="meeting-task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleMeetingTask('${task.id}')"></div>
        <div class="meeting-task-content">
          <div class="meeting-task-title">
            ${task.completed ? escapeHtml(task.title) : `<input type="text" value="${escapeHtml(task.title)}" onblur="updateMeetingTaskTitle('${task.id}', this.value)" onkeypress="if(event.key==='Enter') this.blur()">`}
            ${isEmailTask ? '<span class="task-email-badge">📧 Email</span>' : ''}
            ${isRescheduleTask ? '<span class="task-email-badge" style="background: rgba(26, 138, 62, 0.1); color: var(--success-color);">📅 Meeting</span>' : ''}
          </div>
          ${dueDate ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem; ${dueDateClass === 'overdue' ? 'color: var(--error-color); font-weight: 600;' : dueDateClass === 'today' ? 'color: var(--warning-color); font-weight: 600;' : ''}">📅 ${dueDateText}</div>` : ''}
          <div class="meeting-task-actions">
            ${isEmailTask ? `<button class="meeting-task-action-btn email" onclick="sendFollowUpEmail('${task.id}')">📧 Send Email</button>` : ''}
            ${isRescheduleTask ? `<button class="meeting-task-action-btn schedule" onclick="scheduleFollowUpMeeting('${task.id}')">📅 Schedule Meeting</button>` : ''}
            ${!task.completed ? `<button class="meeting-task-action-btn edit" onclick="editMeetingTask('${task.id}')">Edit</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Toggle meeting task completion
 */
function toggleMeetingTask(taskId) {
  if (window.todoService) {
    window.todoService.toggleTask(taskId);
    // Reload meeting tasks
    const meetingNumber = sessionStorage.getItem("celera_meeting_number");
    const dealId = sessionStorage.getItem("celera_lead_deal_id");
    const crmContextStr = sessionStorage.getItem("celera_crm_context");
    let crmContext = null;
    if (crmContextStr) {
      try {
        crmContext = JSON.parse(crmContextStr);
      } catch (e) {
        console.error("Failed to parse CRM context", e);
      }
    }
    loadMeetingTasks(meetingNumber, dealId, crmContext);
  }
}

/**
 * Update meeting task title
 */
function updateMeetingTaskTitle(taskId, newTitle) {
  if (window.todoService && newTitle.trim()) {
    window.todoService.updateTask(taskId, { title: newTitle.trim() });
    // Reload to show updated state
    const meetingNumber = sessionStorage.getItem("celera_meeting_number");
    const dealId = sessionStorage.getItem("celera_lead_deal_id");
    const crmContextStr = sessionStorage.getItem("celera_crm_context");
    let crmContext = null;
    if (crmContextStr) {
      try {
        crmContext = JSON.parse(crmContextStr);
      } catch (e) {
        console.error("Failed to parse CRM context", e);
      }
    }
    loadMeetingTasks(meetingNumber, dealId, crmContext);
  }
}

/**
 * Edit meeting task (open full edit modal)
 */
function editMeetingTask(taskId) {
  // Navigate to todo page with task ID to edit
  window.location.href = `/todo.html?edit=${taskId}`;
}

/**
 * Send follow-up email
 * Uses pre-composed email from task metadata if available, otherwise generates new one
 */
async function sendFollowUpEmail(taskId) {
  if (!window.emailService) {
    alert('Email service not available');
    return;
  }
  
  const allTasks = window.todoService.getTasks();
  const task = allTasks.find(t => t.id === taskId);
  if (!task) {
    alert('Task not found');
    return;
  }
  
  let emailData = null;
  
  // Use pre-composed email if available (90% ready!)
  if (task.metadata?.preComposedEmail) {
    emailData = task.metadata.preComposedEmail;
    console.log('Using pre-composed email from task metadata');
  } else {
    // Fallback: Generate email from current context (for tasks created outside of post-call flow)
    const debriefText = document.getElementById("debrief-editor")?.textContent.trim() || '';
    const participants = task.metadata?.participants || Array.from(document.querySelectorAll('.participant-badge'))
      .map(badge => badge.textContent)
      .filter(p => p !== "You");
    
    // Get next steps from tasks (excluding email/reschedule tasks)
    const nextSteps = [];
    const meetingNumber = task.metadata?.meetingNumber || sessionStorage.getItem("celera_meeting_number");
    const meetingTaskIds = sessionStorage.getItem(`celera_meeting_${meetingNumber}_tasks`);
    
    if (meetingTaskIds) {
      try {
        const taskIds = JSON.parse(meetingTaskIds);
        taskIds.forEach(tid => {
          const t = allTasks.find(ta => ta.id === tid);
          if (t && t.metadata?.type !== 'email_followup' && t.metadata?.type !== 'reschedule_meeting') {
            nextSteps.push(t.title);
          }
        });
      } catch (e) {
        console.error('Failed to parse task IDs', e);
      }
    }
    
    const crmContextStr = sessionStorage.getItem("celera_crm_context");
    let crmContext = null;
    if (crmContextStr) {
      try {
        crmContext = JSON.parse(crmContextStr);
      } catch (e) {
        console.error("Failed to parse CRM context", e);
      }
    }
    
    // Generate email
    emailData = window.emailService.generateFollowUpEmail({
      debrief: debriefText,
      participants: participants,
      dealName: task.dealName || crmContext?.dealName || null,
      accountName: crmContext?.accountName || null,
      nextSteps: nextSteps
    });
  }
  
  // Compose email with telemetry tracking
  try {
    const dealId = task.dealId || null;
    const contactId = task.contactId || null;
    await window.emailService.composeEmail(emailData, dealId, contactId);
    
    // Mark task as in progress
    window.todoService.updateTask(taskId, { 
      state: 'in_progress',
      metadata: { 
        ...task.metadata, 
        emailSent: true,
        emailSentAt: new Date().toISOString()
      } 
    });
  } catch (error) {
    console.error('Failed to compose email:', error);
    alert('Failed to open email composer. Please check your email configuration.');
  }
}

/**
 * Schedule follow-up meeting (opens calendar with pre-filled details)
 */
async function scheduleFollowUpMeeting(taskId) {
  const allTasks = window.todoService.getTasks();
  const task = allTasks.find(t => t.id === taskId);
  if (!task) {
    alert('Task not found');
    return;
  }
  
  // Get suggested date from task metadata
  const suggestedDate = task.metadata?.suggestedDate || task.dueDate;
  const date = new Date(suggestedDate);
  const duration = task.metadata?.suggestedDuration || 30; // minutes
  
  // Format for calendar
  const startTime = date.toISOString();
  const endTime = new Date(date.getTime() + duration * 60 * 1000).toISOString();
  
  // Get participants
  const participants = task.metadata?.participants || [];
  const dealName = task.dealName || 'Meeting';
  
  // Create calendar event via Google Calendar API if available
  if (window.googleCalendarService && window.googleCalendarService.isAvailable()) {
    try {
      const event = {
        summary: `Follow-up: ${dealName}`,
        description: task.description || `Follow-up meeting for ${dealName}`,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: participants.map(p => {
          // Try to extract email from participant name
          // In production, this would come from contact data
          const email = p.toLowerCase().replace(/\s+/g, '.') + '@example.com';
          return { email: email, displayName: p };
        })
      };
      
      const createdEvent = await window.googleCalendarService.createEvent(event);
      
      // Track calendar event with telemetry
      if (window.calendarTelemetryService && task.dealId) {
        try {
          await window.calendarTelemetryService.trackCalendarEventCreated(
            createdEvent.id || `event_${Date.now()}`,
            task.dealId,
            null, // contactId could be extracted from participants
            {
              title: event.summary,
              startTime: event.start?.dateTime,
              endTime: event.end?.dateTime
            }
          );
        } catch (e) {
          console.error('Failed to track calendar event:', e);
        }
      }
      
      // Update task with calendar link
      window.todoService.updateTask(taskId, {
        metadata: {
          ...task.metadata,
          calendarEventId: createdEvent.id,
          calendarLink: createdEvent.metadata?.htmlLink || createdEvent.htmlLink,
          scheduled: true,
          scheduledAt: new Date().toISOString()
        }
      });
      
      // Open calendar event
      if (createdEvent.metadata?.htmlLink || createdEvent.htmlLink) {
        window.open(createdEvent.metadata.htmlLink || createdEvent.htmlLink, '_blank');
      } else {
        alert('Meeting scheduled! Check your calendar.');
      }
      
      return;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      // Fall through to fallback
    }
  }
  
  // Fallback: open Google Calendar with pre-filled details (ready to schedule - human in the loop)
  const formatGoogleCalendarDate = (dateString) => {
    const d = new Date(dateString);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const title = encodeURIComponent(`Follow-up: ${dealName}`);
  const details = encodeURIComponent(task.description || `Follow-up meeting for ${dealName}`);
  const dates = `${formatGoogleCalendarDate(startTime)}/${formatGoogleCalendarDate(endTime)}`;
  
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
  window.open(calendarUrl, '_blank');
  
  // Mark task as scheduled
  window.todoService.updateTask(taskId, {
    metadata: {
      ...task.metadata,
      calendarOpened: true,
      calendarOpenedAt: new Date().toISOString()
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
