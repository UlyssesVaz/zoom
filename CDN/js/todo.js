/**
 * Todo Page Logic - Kanban Board View
 * Tasks grouped by call/meeting with drag-and-drop
 */

let currentFilter = 'all';
let editingTaskId = null;
let draggedTask = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  loadKanbanBoard();
  
  // Subscribe to task updates
  window.todoService.subscribe(() => {
    loadKanbanBoard();
  });
  
  // Check for taskId in URL to open modal
  const urlParams = new URLSearchParams(window.location.search);
  const taskId = urlParams.get('taskId');
  if (taskId) {
    setTimeout(() => {
      editTask(taskId);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 500);
  }
});

/**
 * Load and render Kanban board
 */
function loadKanbanBoard() {
  const container = document.getElementById('kanban-container');
  
  // Get all tasks
  let tasks = window.todoService.getTasks();
  
  // Apply priority filter
  if (currentFilter === 'high') {
    tasks = tasks.filter(t => t.priority === 'high');
  } else if (currentFilter === 'medium') {
    tasks = tasks.filter(t => t.priority === 'medium');
  } else if (currentFilter === 'low') {
    tasks = tasks.filter(t => t.priority === 'low');
  } else if (currentFilter === 'overdue') {
    const now = new Date();
    tasks = tasks.filter(t => 
      !t.completed && 
      t.dueDate && 
      new Date(t.dueDate) < now
    );
  } else if (currentFilter === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate >= today && dueDate < tomorrow;
    });
  }
  
  // Group tasks by call
  const callGroups = window.todoService.getTasksGroupedByCall();
  
  // Separate tasks by state
  const tasksByState = {
    not_started: [],
    in_progress: [],
    done: []
  };
  
  tasks.forEach(task => {
    const state = task.state || (task.completed ? 'done' : 'not_started');
    tasksByState[state].push(task);
  });
  
  // Render Kanban columns
  container.innerHTML = `
    <div class="kanban-column" data-state="not_started">
      <div class="kanban-column-header">
        <div class="kanban-column-icon not-started"></div>
        <div class="kanban-column-title">Not started</div>
        <div class="kanban-column-count">${tasksByState.not_started.length}</div>
      </div>
      <div class="kanban-column-content" ondrop="handleDrop(event, 'not_started')" ondragover="handleDragOver(event)">
        ${renderCallGroups(tasksByState.not_started, callGroups, 'not_started')}
      </div>
    </div>
    <div class="kanban-column" data-state="in_progress">
      <div class="kanban-column-header">
        <div class="kanban-column-icon in-progress"></div>
        <div class="kanban-column-title">In progress</div>
        <div class="kanban-column-count">${tasksByState.in_progress.length}</div>
      </div>
      <div class="kanban-column-content" ondrop="handleDrop(event, 'in_progress')" ondragover="handleDragOver(event)">
        ${renderCallGroups(tasksByState.in_progress, callGroups, 'in_progress')}
      </div>
    </div>
    <div class="kanban-column" data-state="done">
      <div class="kanban-column-header">
        <div class="kanban-column-icon done"></div>
        <div class="kanban-column-title">Done</div>
        <div class="kanban-column-count">${tasksByState.done.length}</div>
      </div>
      <div class="kanban-column-content" ondrop="handleDrop(event, 'done')" ondragover="handleDragOver(event)">
        ${renderCallGroups(tasksByState.done, callGroups, 'done')}
      </div>
    </div>
  `;
  
  // Attach event listeners
  attachTaskListeners();
}

/**
 * Render call groups with tasks
 */
function renderCallGroups(tasks, callGroups, state) {
  if (tasks.length === 0) {
    return `<div class="empty-column">No tasks</div>`;
  }
  
  // Group tasks by call
  const tasksByCall = {};
  const manualTasks = [];
  
  tasks.forEach(task => {
    const callId = task.sourceId || task.metadata?.callId || 'manual';
    if (callId === 'manual' || !callId) {
      manualTasks.push(task);
    } else {
      if (!tasksByCall[callId]) {
        tasksByCall[callId] = [];
      }
      tasksByCall[callId].push(task);
    }
  });
  
  let html = '';
  
  // Render call groups
  callGroups.forEach(group => {
    const groupTasks = tasksByCall[group.callId] || [];
    if (groupTasks.length === 0) return;
    
    const callDate = new Date(group.callDate);
    const callDateStr = callDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    html += `
      <div class="call-group expanded" data-call-id="${group.callId}">
        <div class="call-group-header" onclick="toggleCallGroup('${group.callId}')">
          <span class="call-group-toggle expanded">▶</span>
          <span class="call-group-icon">📞</span>
          <span class="call-group-title">${escapeHtml(group.dealName)} - ${callDateStr}</span>
          <span class="call-group-count">${groupTasks.length}</span>
        </div>
        <div class="call-group-tasks">
          ${groupTasks.map(task => renderKanbanTask(task, state)).join('')}
        </div>
      </div>
    `;
  });
  
  // Render manual tasks (not from calls)
  if (manualTasks.length > 0) {
    html += `
      <div class="call-group expanded" data-call-id="manual">
        <div class="call-group-header" onclick="toggleCallGroup('manual')">
          <span class="call-group-toggle expanded">▶</span>
          <span class="call-group-icon">📝</span>
          <span class="call-group-title">Manual Tasks</span>
          <span class="call-group-count">${manualTasks.length}</span>
        </div>
        <div class="call-group-tasks">
          ${manualTasks.map(task => renderKanbanTask(task, state)).join('')}
        </div>
      </div>
    `;
  }
  
  return html;
}

/**
 * Render a single Kanban task card
 */
function renderKanbanTask(task, currentState) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  let dueDateClass = '';
  let dueDateText = '';
  
  if (dueDate) {
    if (dueDate < now && task.state !== 'done') {
      dueDateClass = 'overdue';
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      dueDateText = `${daysOverdue}d overdue`;
    } else if (dueDate >= today && dueDate < tomorrow) {
      dueDateClass = 'today';
      dueDateText = 'Today';
    } else {
      dueDateText = formatDate(dueDate);
    }
  }
  
  // Priority badge styling
  const priorityClass = task.priority || 'medium';
  const priorityColors = {
    high: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--error-color)', label: 'High' },
    medium: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning-color)', label: 'Med' },
    low: { bg: 'rgba(156, 163, 175, 0.15)', color: 'var(--text-secondary)', label: 'Low' }
  };
  const priorityStyle = priorityColors[priorityClass] || priorityColors.medium;
  
  const isEmailTask = task.metadata?.type === 'email_followup';
  const hasPreComposedEmail = task.metadata?.preComposedEmail !== null && task.metadata?.preComposedEmail !== undefined;
  
  return `
    <div class="kanban-task" 
         draggable="true" 
         data-task-id="${task.id}"
         data-priority="${task.priority || 'medium'}"
         ondragstart="handleDragStart(event, '${task.id}')"
         ondragend="handleDragEnd(event)">
      <div class="kanban-task-title" onclick="editTask('${task.id}')">${escapeHtml(task.title)}</div>
      <div class="kanban-task-meta">
        <span class="kanban-task-priority" style="background: ${priorityStyle.bg}; color: ${priorityStyle.color}; padding: 0.125rem 0.5rem; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">${priorityStyle.label}</span>
        ${task.dealName ? `<span class="kanban-task-deal" onclick="event.stopPropagation(); window.location.href='/sales/pipeline.html?dealId=${task.dealId || ''}&tab=activity';">📋 ${escapeHtml(task.dealName)}</span>` : ''}
        ${dueDate ? `<span class="kanban-task-due ${dueDateClass}">📅 ${dueDateText}</span>` : ''}
        ${task.source === 'call' ? '<span>📞</span>' : ''}
      </div>
      ${isEmailTask && hasPreComposedEmail ? `
        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          <button class="kanban-task-action-btn" onclick="event.stopPropagation(); editTask('${task.id}')" style="width: 100%; padding: 0.5rem; background: var(--accent-color); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">
            📧 View & Send Email
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Toggle call group expand/collapse
 */
function toggleCallGroup(callId) {
  const group = document.querySelector(`[data-call-id="${callId}"]`);
  if (group) {
    group.classList.toggle('expanded');
    const toggle = group.querySelector('.call-group-toggle');
    if (toggle) {
      toggle.classList.toggle('expanded');
    }
  }
}

/**
 * Drag and drop handlers
 */
function handleDragStart(event, taskId) {
  draggedTask = taskId;
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dragging');
}

function handleDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  draggedTask = null;
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleDrop(event, newState) {
  event.preventDefault();
  
  if (!draggedTask) return;
  
  // Move task to new state
  window.todoService.moveTaskToState(draggedTask, newState);
  
  draggedTask = null;
}

/**
 * Attach event listeners to tasks
 */
function attachTaskListeners() {
  // Task click handlers are in renderKanbanTask (onclick)
}

// Removed updateStats - stats bars removed per user request

/**
 * Filter tasks
 */
function filterTasks(filter) {
  currentFilter = filter;
  
  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    }
  });
  
  loadKanbanBoard();
}

/**
 * Toggle task completion (cycle through states)
 */
function toggleTask(taskId) {
  window.todoService.toggleTask(taskId);
}

/**
 * Delete task
 */
function deleteTask(taskId) {
  if (confirm('Are you sure you want to delete this task?')) {
    window.todoService.deleteTask(taskId);
  }
}

/**
 * Open task modal for editing/viewing
 */
function editTask(taskId) {
  const task = window.todoService.getTasks().find(t => t.id === taskId);
  if (!task) return;
  
  editingTaskId = taskId;
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-description').value = task.description || '';
  document.getElementById('task-due-date').value = task.dueDate ? task.dueDate.split('T')[0] : '';
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-state').value = task.state || (task.completed ? 'done' : 'not_started');
  document.getElementById('task-deal').value = task.dealName || '';
  document.getElementById('task-deal-id').value = task.dealId || '';
  
  // Show deal link if task has a deal (linked section)
  const dealLinkSection = document.getElementById('deal-link-section');
  if (task.dealId) {
    dealLinkSection.style.display = 'block';
    const dealLink = document.getElementById('deal-link');
    dealLink.href = `/sales/pipeline.html?dealId=${task.dealId}&tab=tasks`;
    dealLink.textContent = `View ${task.dealName || 'Deal'} →`;
  } else {
    dealLinkSection.style.display = 'none';
  }
  
  // Also update the Related Deal input to show it's linked
  if (task.dealId) {
    const dealInput = document.getElementById('task-deal');
    dealInput.style.color = 'var(--accent-color)';
    dealInput.style.fontWeight = '600';
  }
  
  // Check if it's an email task
  const isEmailTask = task.metadata?.type === 'email_followup';
  const emailContentSection = document.getElementById('email-content-section');
  const regularButtons = document.getElementById('regular-task-buttons');
  const emailSendButtonTop = document.getElementById('email-send-button-top');
  const stateGroup = document.getElementById('state-group');
  
  if (isEmailTask && task.metadata?.preComposedEmail) {
    // Show email content
    emailContentSection.style.display = 'block';
    const email = task.metadata.preComposedEmail;
    document.getElementById('email-to-preview').textContent = Array.isArray(email.to) ? email.to.join(', ') : email.to || 'N/A';
    document.getElementById('email-subject-preview').textContent = email.subject || 'No subject';
    document.getElementById('email-body-preview').textContent = email.body || 'No body';
    
    // Hide regular buttons, show email button at top
    regularButtons.style.display = 'none';
    emailSendButtonTop.style.display = 'block';
    stateGroup.style.display = 'none';
    
    // Store email data for sending
    window.currentModalEmailData = email;
    window.currentModalTaskId = taskId;
  } else {
    // Hide email content, show regular form
    emailContentSection.style.display = 'none';
    regularButtons.style.display = 'flex';
    emailSendButtonTop.style.display = 'none';
    stateGroup.style.display = 'block';
    window.currentModalEmailData = null;
    window.currentModalTaskId = null;
  }
  
  openTaskModal();
}

/**
 * Open task modal for new task
 */
function openTaskModal() {
  if (!editingTaskId) {
    // Reset form for new task
    document.getElementById('modal-title').textContent = 'New Task';
    document.getElementById('task-form').reset();
    document.getElementById('task-deal-id').value = '';
    document.getElementById('task-state').value = 'not_started';
  }
  
  document.getElementById('task-modal').classList.add('open');
}

/**
 * Close task modal (Cancel)
 */
function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('open');
  editingTaskId = null;
  document.getElementById('task-form').reset();
  document.getElementById('email-content-section').style.display = 'none';
  document.getElementById('regular-task-buttons').style.display = 'flex';
  document.getElementById('email-send-button-top').style.display = 'none';
  document.getElementById('state-group').style.display = 'block';
  window.currentModalEmailData = null;
  window.currentModalTaskId = null;
}

/**
 * Update task state (for regular tasks)
 */
function updateTaskState(newState) {
  if (!editingTaskId) return;
  
  const task = window.todoService.getTasks().find(t => t.id === editingTaskId);
  if (!task) return;
  
  // Update task with new state
  window.todoService.updateTask(editingTaskId, {
    state: newState,
    completed: newState === 'done'
  });
  
  closeTaskModal();
  loadKanbanBoard();
}

/**
 * Send email from modal (for email tasks)
 */
async function sendEmailFromModal() {
  if (!window.currentModalEmailData || !window.currentModalTaskId) {
    alert('Email data not found');
    return;
  }
  
  const task = window.todoService.getTasks().find(t => t.id === window.currentModalTaskId);
  if (!task) {
    alert('Task not found');
    return;
  }
  
  const email = window.currentModalEmailData;
  const dealId = task.dealId || null;
  const contactId = task.contactId || null;
  
  // Try to use email service if available, otherwise fallback to mailto
  if (window.emailService) {
    try {
      // Compose email with telemetry tracking
      await window.emailService.composeEmail(email, dealId, contactId);
      
      // Auto-complete the task
      window.todoService.updateTask(window.currentModalTaskId, { 
        state: 'done',
        completed: true,
        metadata: { 
          ...task.metadata, 
          emailSent: true,
          emailSentAt: new Date().toISOString()
        } 
      });
      
      closeTaskModal();
      loadKanbanBoard();
      return;
    } catch (error) {
      console.error('Failed to compose email via service:', error);
      // Fall through to mailto fallback
    }
  }
  
  // Fallback: Use mailto directly (always works)
  try {
    const to = Array.isArray(email.to) ? email.to.join(',') : email.to;
    const subject = encodeURIComponent(email.subject || '');
    const body = encodeURIComponent(email.body || '');
    const mailtoLink = `mailto:${to}?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
    
    // Auto-complete the task
    window.todoService.updateTask(window.currentModalTaskId, { 
      state: 'done',
      completed: true,
      metadata: { 
        ...task.metadata, 
        emailSent: true,
        emailSentAt: new Date().toISOString()
      } 
    });
    
    closeTaskModal();
    loadKanbanBoard();
  } catch (error) {
    console.error('Failed to open email:', error);
    alert('Failed to open email composer. Please check your email configuration.');
  }
}

/**
 * Save task (new or edit) - only for regular tasks now
 */
function saveTask(event) {
  event.preventDefault();
  
  const taskData = {
    title: document.getElementById('task-title').value.trim(),
    description: document.getElementById('task-description').value.trim(),
    dueDate: document.getElementById('task-due-date').value || null,
    priority: document.getElementById('task-priority').value,
    state: document.getElementById('task-state').value,
    dealId: document.getElementById('task-deal-id').value || null,
    dealName: document.getElementById('task-deal').value.trim() || null
  };
  
  if (editingTaskId) {
    window.todoService.updateTask(editingTaskId, taskData);
  } else {
    window.todoService.createTask(taskData);
  }
  
  closeTaskModal();
  loadKanbanBoard();
}

/**
 * Format date for display
 */
function formatDate(date) {
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays}d`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Send email from task (opens modal to view and send)
 * This function can be called from anywhere (todo page, deal sidebar, etc.)
 */
function sendEmailFromTask(taskId) {
  // Open the task modal to show email content
  editTask(taskId);
}

// Expose refresh function globally
window.refreshTodoList = loadKanbanBoard;
