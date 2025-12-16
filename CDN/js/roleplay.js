// Roleplay Page Logic

let currentSession = null;
let currentScenario = null;
let messages = [];

document.addEventListener('DOMContentLoaded', async function() {
  // Check if Yoodli is configured
  if (!window.yoodliService.isConfigured()) {
    document.getElementById('config-check').style.display = 'block';
    return;
  }

  // Check if we have a contextual session from URL
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');
  const isContextual = urlParams.get('contextual') === 'true';

  if (sessionId && isContextual) {
    // Load existing contextual session
    await loadContextualSession(sessionId);
  } else {
    // Load scenarios for normal roleplay
    await loadScenarios();
  }
});

async function loadContextualSession(sessionId) {
  try {
    // Get session info (would need API endpoint for this)
    currentSession = { id: sessionId };
    
    // Hide scenario selector
    document.querySelector('.scenario-selector').style.display = 'none';
    document.querySelector('.roleplay-container').style.gridTemplateColumns = '1fr';
    
    // Update UI
    document.getElementById('current-scenario-name').textContent = 'Contextual Practice Session';
    document.getElementById('session-status').textContent = 'Session active';
    document.getElementById('chat-input-container').style.display = 'flex';
    document.getElementById('end-session-btn').style.display = 'block';
    
    // Clear empty state
    const chatMessages = document.getElementById('chat-messages');
    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }
    
    // Send welcome message
    const welcomeMessage = {
      id: 'welcome',
      role: 'ai',
      message: "Hello! I've reviewed your deal context. Let's practice this call scenario together. How would you like to start?",
      timestamp: new Date().toISOString()
    };
    
    messages.push(welcomeMessage);
    renderMessages();
    
  } catch (error) {
    console.error('Failed to load contextual session:', error);
    alert('Failed to load session. Loading scenarios instead...');
    await loadScenarios();
  }
}

async function loadScenarios() {
  const scenariosList = document.getElementById('scenarios-list');
  
  try {
    const data = await window.yoodliService.listScenarios();
    const scenarios = data.scenarios || [];
    
    if (scenarios.length === 0) {
      scenariosList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No scenarios available</div>';
      return;
    }
    
    scenariosList.innerHTML = scenarios.map(scenario => `
      <div class="scenario-card" onclick="selectScenario('${scenario.id}')" data-scenario-id="${scenario.id}">
        <div class="scenario-name">${scenario.name}</div>
        <div class="scenario-desc">${scenario.description}</div>
        <div class="scenario-meta">
          <span>${scenario.category}</span> • 
          <span>~${scenario.estimatedDuration} min</span>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Failed to load scenarios:', error);
    scenariosList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--error-color);">Failed to load scenarios</div>';
  }
}

async function selectScenario(scenarioId) {
  // Remove previous selection
  document.querySelectorAll('.scenario-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Mark selected
  const selectedCard = document.querySelector(`[data-scenario-id="${scenarioId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
  
  // Get scenario details
  try {
    const data = await window.yoodliService.listScenarios();
    const scenario = data.scenarios.find(s => s.id === scenarioId);
    
    if (!scenario) {
      alert('Scenario not found');
      return;
    }
    
    currentScenario = scenario;
    document.getElementById('current-scenario-name').textContent = scenario.name;
    
    // Create session
    await startSession(scenarioId);
    
  } catch (error) {
    console.error('Failed to select scenario:', error);
    alert('Failed to start scenario. Please try again.');
  }
}

async function startSession(scenarioId) {
  try {
    // Show loading state
    document.getElementById('session-status').textContent = 'Starting session...';
    document.getElementById('chat-input-container').style.display = 'none';
    
    // Create session
    currentSession = await window.yoodliService.createRoleplaySession(scenarioId);
    
    // Clear previous messages
    messages = [];
    renderMessages();
    
    // Show chat interface
    document.getElementById('session-status').textContent = 'Session active';
    document.getElementById('chat-input-container').style.display = 'flex';
    document.getElementById('end-session-btn').style.display = 'block';
    
    // Hide empty state
    const chatMessages = document.getElementById('chat-messages');
    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }
    
    // Send welcome message from AI
    const welcomeMessage = {
      id: 'welcome',
      role: 'ai',
      message: `Hello! I'm ready to practice ${currentScenario.name} with you. Let's begin!`,
      timestamp: new Date().toISOString()
    };
    
    messages.push(welcomeMessage);
    renderMessages();
    
  } catch (error) {
    console.error('Failed to start session:', error);
    alert('Failed to start session. Please try again.');
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message || !currentSession) {
    return;
  }
  
  // Clear input
  input.value = '';
  
  // Add user message
  const userMessage = {
    id: `user_${Date.now()}`,
    role: 'user',
    message: message,
    timestamp: new Date().toISOString()
  };
  
  messages.push(userMessage);
  renderMessages();
  
  // Show typing indicator
  const typingIndicator = {
    id: 'typing',
    role: 'ai',
    message: '...',
    timestamp: new Date().toISOString(),
    typing: true
  };
  
  messages.push(typingIndicator);
  renderMessages();
  
  try {
    // Send message to Yoodli API
    const aiResponse = await window.yoodliService.sendMessage(currentSession.id, message);
    
    // Remove typing indicator
    messages = messages.filter(m => m.id !== 'typing');
    
    // Add AI response
    messages.push(aiResponse);
    renderMessages();
    
  } catch (error) {
    console.error('Failed to send message:', error);
    
    // Remove typing indicator
    messages = messages.filter(m => m.id !== 'typing');
    
    // Show error message
    const errorMessage = {
      id: `error_${Date.now()}`,
      role: 'ai',
      message: 'Sorry, I encountered an error. Please try again.',
      timestamp: new Date().toISOString()
    };
    
    messages.push(errorMessage);
    renderMessages();
  }
}

function renderMessages() {
  const chatMessages = document.getElementById('chat-messages');
  
  if (messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <p>Select a scenario to start practicing</p>
      </div>
    `;
    return;
  }
  
  chatMessages.innerHTML = messages.map(msg => {
    const isUser = msg.role === 'user';
    const isTyping = msg.typing;
    
    return `
      <div class="message ${isUser ? 'user' : 'ai'}">
        <div class="message-avatar">
          ${isUser ? '👤' : '🤖'}
        </div>
        <div class="message-content">
          ${isTyping ? '<em>Typing...</em>' : msg.message}
        </div>
      </div>
    `;
  }).join('');
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function endSession() {
  if (!currentSession) {
    return;
  }
  
  if (!confirm('End this practice session? You will receive feedback.')) {
    return;
  }
  
  try {
    // Disable input
    document.getElementById('chat-input-container').style.display = 'none';
    document.getElementById('end-session-btn').style.display = 'none';
    document.getElementById('session-status').textContent = 'Ending session...';
    
    // End session and get analysis
    const analysis = await window.yoodliService.endSession(currentSession.id);
    
    // Show feedback panel
    displayFeedback(analysis);
    
    // Reset session
    currentSession = null;
    currentScenario = null;
    
  } catch (error) {
    console.error('Failed to end session:', error);
    alert('Failed to end session. Please try again.');
  }
}

function displayFeedback(analysis) {
  const feedbackPanel = document.getElementById('feedback-panel');
  const feedbackContent = document.getElementById('feedback-content');
  
  const feedback = analysis.feedback || {};
  const strengths = feedback.strengths || [];
  const improvements = feedback.improvements || [];
  const metrics = feedback.metrics || {};
  
  feedbackContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 2rem;">
      <div class="score-circle">${analysis.overallScore || 0}</div>
      <h3>Overall Score</h3>
    </div>
    
    ${strengths.length > 0 ? `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 0.75rem; color: var(--success-color);">✅ Strengths</h4>
        ${strengths.map(strength => `
          <div class="strength-item">${strength}</div>
        `).join('')}
      </div>
    ` : ''}
    
    ${improvements.length > 0 ? `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 0.75rem; color: var(--warning-color);">📈 Areas for Improvement</h4>
        ${improvements.map(improvement => `
          <div class="improvement-item">${improvement}</div>
        `).join('')}
      </div>
    ` : ''}
    
    ${Object.keys(metrics).length > 0 ? `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 0.75rem;">📊 Metrics</h4>
        <div class="info-grid">
          ${metrics.fillerWords ? `
            <div class="info-item">
              <div class="info-label">Filler Words</div>
              <div class="info-value">${metrics.fillerWords}</div>
            </div>
          ` : ''}
          ${metrics.speakingPace ? `
            <div class="info-item">
              <div class="info-label">Speaking Pace</div>
              <div class="info-value">${metrics.speakingPace} wpm</div>
            </div>
          ` : ''}
          ${metrics.clarity ? `
            <div class="info-item">
              <div class="info-label">Clarity</div>
              <div class="info-value">${metrics.clarity}/10</div>
            </div>
          ` : ''}
          ${metrics.engagement ? `
            <div class="info-item">
              <div class="info-label">Engagement</div>
              <div class="info-value">${metrics.engagement}/10</div>
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}
    
    ${analysis.recommendations && analysis.recommendations.length > 0 ? `
      <div>
        <h4 style="margin-bottom: 0.75rem;">💡 Recommendations</h4>
        <ul style="list-style: none; padding: 0;">
          ${analysis.recommendations.map(rec => `
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
              ${rec}
            </li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
    
    <div style="margin-top: 2rem; text-align: center;">
      <button class="btn btn-primary" onclick="location.reload()">Practice Again</button>
      <button class="btn btn-secondary" onclick="window.location.href='/prep.html'" style="margin-left: 0.5rem;">
        Go to Prep
      </button>
    </div>
  `;
  
  feedbackPanel.classList.add('active');
  feedbackPanel.scrollIntoView({ behavior: 'smooth' });
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

