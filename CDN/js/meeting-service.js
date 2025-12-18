/**
 * Meeting Service - Abstracts Zoom and Google Meet
 * 
 * Handles platform detection, joining, and user preferences
 * Supports both Zoom SDK and Google Meet links
 */

class MeetingService {
  constructor() {
    this.defaultProvider = localStorage.getItem('celera_default_meeting_provider') || 'zoom';
  }

  /**
   * Set default meeting provider
   */
  setDefaultProvider(provider) {
    this.defaultProvider = provider;
    localStorage.setItem('celera_default_meeting_provider', provider);
  }

  /**
   * Get default provider
   */
  getDefaultProvider() {
    return this.defaultProvider;
  }

  /**
   * Detect meeting platform from URL/link
   */
  detectPlatform(meetingLink) {
    if (!meetingLink) return null;
    
    const link = meetingLink.toLowerCase();
    
    if (link.includes('zoom.us') || link.includes('zoom.com')) {
      return 'zoom';
    }
    if (link.includes('meet.google.com') || link.includes('google.com/meet')) {
      return 'google-meet';
    }
    
    // Check for meeting number patterns (Zoom)
    const zoomPattern = /([0-9]{9,11})/;
    if (zoomPattern.test(meetingLink)) {
      return 'zoom'; // Likely Zoom meeting number
    }
    
    return null;
  }

  /**
   * Extract meeting info from link
   */
  extractMeetingInfo(meetingLink, platform = null) {
    platform = platform || this.detectPlatform(meetingLink);
    
    if (platform === 'zoom') {
      return this.extractZoomInfo(meetingLink);
    } else if (platform === 'google-meet') {
      return this.extractGoogleMeetInfo(meetingLink);
    }
    
    return null;
  }

  /**
   * Extract Zoom meeting info
   */
  extractZoomInfo(link) {
    const zoomPattern = /(?:zoom\.us\/j\/|zoom\.us\/join\/|zoom\.us\/meeting\/)([0-9]{9,11})/i;
    const passwordPattern = /(?:pwd|password)[\s:=]+([a-zA-Z0-9]{6,})/i;
    
    const match = link.match(zoomPattern);
    if (match) {
      const passwordMatch = link.match(passwordPattern);
      return {
        platform: 'zoom',
        meetingNumber: match[1],
        password: passwordMatch ? passwordMatch[1] : null,
        joinUrl: link.includes('http') ? link : `https://zoom.us/j/${match[1]}`
      };
    }
    
    // Check if it's just a meeting number
    const numberMatch = link.match(/([0-9]{9,11})/);
    if (numberMatch) {
      return {
        platform: 'zoom',
        meetingNumber: numberMatch[1],
        password: null,
        joinUrl: `https://zoom.us/j/${numberMatch[1]}`
      };
    }
    
    return null;
  }

  /**
   * Extract Google Meet info
   */
  extractGoogleMeetInfo(link) {
    // Google Meet links: https://meet.google.com/abc-defg-hij
    // Or: meet.google.com/abc-defg-hij
    const meetPattern = /(?:meet\.google\.com\/|google\.com\/meet\/)([a-z-]+)/i;
    const match = link.match(meetPattern);
    
    if (match) {
      return {
        platform: 'google-meet',
        meetingCode: match[1],
        joinUrl: link.startsWith('http') ? link : `https://meet.google.com/${match[1]}`
      };
    }
    
    // Check if it's just a meeting code (abc-defg-hij format)
    const codePattern = /^([a-z]{3}-[a-z]{4}-[a-z]{3})$/i;
    const codeMatch = link.trim().match(codePattern);
    if (codeMatch) {
      return {
        platform: 'google-meet',
        meetingCode: codeMatch[1],
        joinUrl: `https://meet.google.com/${codeMatch[1]}`
      };
    }
    
    return null;
  }

  /**
   * Join meeting (platform-agnostic)
   */
  async joinMeeting(meetingInfo, displayName, options = {}) {
    const platform = options.platform || meetingInfo.platform || this.defaultProvider;
    
    if (platform === 'zoom') {
      return await this.joinZoomMeeting(meetingInfo, displayName, options);
    } else if (platform === 'google-meet') {
      return await this.joinGoogleMeet(meetingInfo, displayName, options);
    }
    
    throw new Error(`Unsupported meeting platform: ${platform}`);
  }

  /**
   * Join Zoom meeting using SDK
   */
  async joinZoomMeeting(meetingInfo, displayName, options) {
    const meetingNumber = meetingInfo.meetingNumber || meetingInfo.meetingCode;
    const password = meetingInfo.password || null;
    
    if (!window.testTool) {
      throw new Error('testTool not available - make sure tool.js is loaded');
    }
    
    const authEndpoint = options.authEndpoint || "http://127.0.0.1:4000";
    
    if (!meetingNumber || meetingNumber.trim().length < 9) {
      throw new Error('Invalid Zoom meeting number');
    }
    
    if (!displayName || displayName.trim().length === 0) {
      throw new Error('Display name is required');
    }
    
    try {
      const response = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingNumber: meetingNumber,
          role: 0 // Attendee
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Auth endpoint returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.signature || !data.sdkKey) {
        throw new Error('Invalid response from auth endpoint');
      }
      
      const meetingConfig = {
        mn: meetingNumber,
        name: window.testTool.b64EncodeUnicode(displayName),
        pwd: password || '',
        role: 0,
        email: '',
        lang: 'en-US',
        signature: data.signature,
        sdkKey: data.sdkKey,
        china: 0,
      };
      
      const meetingUrl = "/meeting.html?" + window.testTool.serialize(meetingConfig);
      window.location.href = meetingUrl;
      
    } catch (error) {
      console.error("Failed to join Zoom meeting:", error);
      throw error;
    }
  }

  /**
   * Join Google Meet (opens in new window/tab)
   */
  async joinGoogleMeet(meetingInfo, displayName, options) {
    const joinUrl = meetingInfo.joinUrl || `https://meet.google.com/${meetingInfo.meetingCode}`;
    
    // Store context for post-call debrief
    sessionStorage.setItem('celera_meeting_platform', 'google-meet');
    sessionStorage.setItem('celera_meeting_code', meetingInfo.meetingCode);
    sessionStorage.setItem('celera_meeting_start_time', new Date().toISOString());
    sessionStorage.setItem('celera_user_name', displayName);
    
    // Try to open in new window
    const meetWindow = window.open(
      joinUrl, 
      '_blank', 
      'width=1280,height=720,menubar=no,toolbar=no,location=no'
    );
    
    if (meetWindow) {
      // Listen for window close to trigger debrief
      const checkClosed = setInterval(() => {
        if (meetWindow.closed) {
          clearInterval(checkClosed);
          sessionStorage.setItem('celera_meeting_end_time', new Date().toISOString());
          
          // Redirect to debrief after a short delay
          setTimeout(() => {
            if (window.location.pathname !== '/summary.html') {
              window.location.href = '/summary.html';
            }
          }, 1000);
        }
      }, 1000);
      
      // Also set a timeout in case window doesn't close properly
      setTimeout(() => {
        clearInterval(checkClosed);
      }, 24 * 60 * 60 * 1000); // 24 hours max
    } else {
      // Popup blocked - redirect in same window
      window.location.href = joinUrl;
    }
  }

  /**
   * Get platform display name
   */
  getPlatformDisplayName(platform) {
    const names = {
      'zoom': 'Zoom',
      'google-meet': 'Google Meet'
    };
    return names[platform] || platform;
  }

  /**
   * Get platform icon
   */
  getPlatformIcon(platform) {
    const icons = {
      'zoom': '📹',
      'google-meet': '💬'
    };
    return icons[platform] || '📞';
  }
}

// Export singleton instance
window.meetingService = new MeetingService();


