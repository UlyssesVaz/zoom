/**
 * Calendar Page Logic
 * Handles calendar display, event rendering, and meeting actions
 */

let currentDate = new Date();
let currentView = 'month';
let calendarEvents = [];

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', function() {
  checkGoogleConnection();
  initializeCalendar();
});

/**
 * Check if Google Calendar is connected
 */
function checkGoogleConnection() {
  if (!window.googleService || !window.googleService.hasCalendarAccess()) {
    document.getElementById('calendar-connect-prompt').style.display = 'block';
    document.getElementById('calendar-container').style.display = 'none';
  } else {
    document.getElementById('calendar-connect-prompt').style.display = 'none';
    document.getElementById('calendar-container').style.display = 'block';
    loadCalendarEvents();
  }
}

/**
 * Connect Google Calendar
 */
async function connectGoogleCalendar() {
  try {
    await window.googleService.initiateOAuth();
    // User will be redirected to Google OAuth
  } catch (error) {
    alert('Failed to connect Google Calendar. Please try again.');
    console.error('Google OAuth error:', error);
  }
}

/**
 * Initialize calendar
 */
function initializeCalendar() {
  renderCalendar();
  
  // Check for OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const provider = urlParams.get('provider');
  
  if (code && provider === 'google') {
    handleOAuthCallback(code);
  }
}

/**
 * Handle OAuth callback
 */
async function handleOAuthCallback(code) {
  try {
    await window.googleService.handleCallback(code);
    window.googleService.setCalendarAccess(true);
    
    // Remove code from URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Reload calendar
    checkGoogleConnection();
  } catch (error) {
    console.error('OAuth callback error:', error);
    alert('Failed to complete Google Calendar connection.');
  }
}

/**
 * Load calendar events
 */
async function loadCalendarEvents() {
  try {
    const events = await window.googleCalendarService.getEvents({
      timeMin: new Date(),
      timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    calendarEvents = events;
    renderCalendar();
  } catch (error) {
    console.error('Failed to load calendar events:', error);
    calendarEvents = [];
    renderCalendar();
  }
}

/**
 * Render calendar based on current view
 */
function renderCalendar() {
  if (currentView === 'month') {
    renderMonthView();
  } else {
    renderListView();
  }
}

/**
 * Render month view
 */
function renderMonthView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Update title
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('calendar-title').textContent = `${monthNames[month]} ${year}`;
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Get events for this month
  const monthEvents = calendarEvents.filter(event => {
    if (!event.start) return false;
    const eventDate = new Date(event.start);
    return eventDate.getMonth() === month && eventDate.getFullYear() === year;
  });
  
  // Create calendar grid
  const grid = document.getElementById('calendar-month-view');
  grid.innerHTML = '';
  
  // Day headers
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    grid.appendChild(header);
  });
  
  // Previous month days
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = document.createElement('div');
    day.className = 'calendar-day other-month';
    day.innerHTML = `<div class="day-number">${prevMonthDays - i}</div>`;
    grid.appendChild(day);
  }
  
  // Current month days
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(year, month, day);
    const dayEvents = monthEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getDate() === day;
    });
    
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    if (dayDate.toDateString() === today.toDateString()) {
      dayElement.classList.add('today');
    }
    
    dayElement.innerHTML = `<div class="day-number">${day}</div>`;
    
    if (dayEvents.length > 0) {
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';
      
        dayEvents.slice(0, 3).forEach(event => {
          const eventElement = document.createElement('div');
          eventElement.className = 'day-event';
          eventElement.textContent = event.summary || 'No Title';
          
          if (event.zoomMeeting) {
            eventElement.classList.add('has-zoom');
          }
          if (event.dealId) {
            eventElement.classList.add('has-deal');
          }
          
          eventElement.onclick = (e) => {
            e.stopPropagation();
            handleEventClick(event);
          };
          
          eventsContainer.appendChild(eventElement);
        });
      
      if (dayEvents.length > 3) {
        const moreElement = document.createElement('div');
        moreElement.className = 'day-event';
        moreElement.textContent = `+${dayEvents.length - 3} more`;
        moreElement.style.opacity = '0.7';
        eventsContainer.appendChild(moreElement);
      }
      
      dayElement.appendChild(eventsContainer);
    }
    
    dayElement.onclick = () => {
      if (dayEvents.length > 0) {
        handleEventClick(dayEvents[0]);
      }
    };
    
    grid.appendChild(dayElement);
  }
  
  // Next month days to fill grid
  const totalCells = grid.children.length - 7; // Subtract headers
  const remainingCells = 42 - totalCells; // 6 rows * 7 days
  for (let day = 1; day <= remainingCells && day <= 14; day++) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day other-month';
    dayElement.innerHTML = `<div class="day-number">${day}</div>`;
    grid.appendChild(dayElement);
  }
}

/**
 * Render list view
 */
function renderListView() {
  const container = document.getElementById('calendar-list-content');
  const upcomingEvents = calendarEvents
    .filter(event => event.start && new Date(event.start) >= new Date())
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  
  if (upcomingEvents.length === 0) {
    container.innerHTML = `
      <div class="calendar-empty">
        <div class="calendar-empty-icon">📅</div>
        <p>No upcoming events</p>
      </div>
    `;
    return;
  }
  
    container.innerHTML = upcomingEvents.map((event, index) => {
      const startDate = new Date(event.start);
      const endDate = event.end ? new Date(event.end) : null;
      const timeStr = formatEventTime(startDate, endDate);
      const dateStr = formatEventDate(startDate);
      
      let actionsHTML = '';
      if (event.zoomMeeting) {
        const meetingNum = event.zoomMeeting.meetingNumber || '';
        const password = (event.zoomMeeting.password || '').replace(/'/g, "\\'");
        actionsHTML += `<button class="event-action-btn join" onclick="joinMeeting('${meetingNum}', '${password}')">Join Meeting</button>`;
      }
      if (event.dealId) {
        const dealId = event.dealId.replace(/'/g, "\\'");
        actionsHTML += `<button class="event-action-btn view-deal" onclick="viewDeal('${dealId}')">View Deal</button>`;
      }
      
      return `
        <div class="event-list-item" onclick="handleEventClickByIndex(${index})">
          <div class="event-time">${dateStr} • ${timeStr}</div>
          <div class="event-title">${escapeHtml(event.summary)}</div>
          <div class="event-details">
            ${event.location ? `<span>📍 ${escapeHtml(event.location)}</span>` : ''}
            ${event.attendees && event.attendees.length > 0 ? `<span>👥 ${event.attendees.length} attendee${event.attendees.length > 1 ? 's' : ''}</span>` : ''}
          </div>
          ${actionsHTML ? `<div class="event-actions">${actionsHTML}</div>` : ''}
        </div>
      `;
    }).join('');
}

/**
 * Handle event click by index (for list view)
 */
function handleEventClickByIndex(index) {
  const upcomingEvents = calendarEvents
    .filter(event => event.start && new Date(event.start) >= new Date())
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  
  if (index >= 0 && index < upcomingEvents.length) {
    handleEventClick(upcomingEvents[index]);
  }
}

/**
 * Handle event click
 */
function handleEventClick(event) {
  // Show event details modal or navigate
  if (event.zoomMeeting) {
    joinMeeting(event.zoomMeeting.meetingNumber, event.zoomMeeting.password || '');
  } else if (event.dealId) {
    viewDeal(event.dealId);
  } else {
    // Show event details
    alert(`Event: ${event.summary}\n\n${event.description || 'No description'}\n\nTime: ${formatEventTime(new Date(event.start), event.end ? new Date(event.end) : null)}`);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Join Zoom meeting
 */
function joinMeeting(meetingNumber, password) {
  // Store meeting info and navigate to prep/meeting page
  sessionStorage.setItem('celera_meeting_number', meetingNumber);
  if (password) {
    sessionStorage.setItem('celera_meeting_password', password);
  }
  
  // Navigate to prep page or directly to meeting
  window.location.href = `/prep.html?meeting=${meetingNumber}${password ? `&pwd=${password}` : ''}`;
}

/**
 * View deal in pipeline
 */
function viewDeal(dealId) {
  window.location.href = `/sales/pipeline.html?dealId=${dealId}&tab=contacts`;
}

/**
 * Format event time
 */
function formatEventTime(start, end) {
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (!end) {
    return startTime;
  }
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${startTime} - ${endTime}`;
}

/**
 * Format event date
 */
function formatEventDate(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

/**
 * Navigate to previous month
 */
function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

/**
 * Navigate to next month
 */
function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}

/**
 * Switch view (month/list)
 */
function switchView(view) {
  currentView = view;
  
  // Update toggle buttons
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  
  // Show/hide views
  if (view === 'month') {
    document.getElementById('calendar-month-view').style.display = 'grid';
    document.getElementById('calendar-list-view').classList.remove('active');
  } else {
    document.getElementById('calendar-month-view').style.display = 'none';
    document.getElementById('calendar-list-view').classList.add('active');
  }
  
  renderCalendar();
}

