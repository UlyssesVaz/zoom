/**
 * Google OAuth Service
 * 
 * Handles Google OAuth authentication and user profile data
 * Designed to work with a backend service that handles OAuth and API calls
 * 
 * Backend API endpoints expected:
 * - GET /api/google/auth/url - Get OAuth authorization URL
 * - GET /api/google/auth/callback?code=... - Handle OAuth callback
 * - GET /api/google/user - Get authenticated user profile
 * - POST /api/google/disconnect - Disconnect Google account
 */

class GoogleService {
  constructor() {
    // Backend API base URL - configure via settings
    this.apiBase = localStorage.getItem('google_api_base') || '/api/google';
    this.isAuthenticated = localStorage.getItem('google_authenticated') === 'true';
    this.userProfile = this.getStoredProfile();
  }

  /**
   * Check if Google is configured and authenticated
   */
  isConfigured() {
    return this.isAuthenticated && !!localStorage.getItem('google_access_token');
  }

  /**
   * Set authentication status (called from settings page after OAuth)
   */
  setAuthenticated(authenticated = true, profile = null) {
    this.isAuthenticated = authenticated;
    localStorage.setItem('google_authenticated', authenticated ? 'true' : '');
    
    if (profile) {
      this.userProfile = profile;
      localStorage.setItem('google_user_profile', JSON.stringify(profile));
    } else if (!authenticated) {
      localStorage.removeItem('google_user_profile');
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_refresh_token');
    }
  }

  /**
   * Get stored user profile
   */
  getStoredProfile() {
    const stored = localStorage.getItem('google_user_profile');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Initiate Google OAuth flow
   * Redirects user to Google OAuth consent screen
   */
  async initiateOAuth() {
    try {
      // Get OAuth URL from backend
      const response = await fetch(`${this.apiBase}/auth/url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get OAuth URL: ${response.status}`);
      }

      const data = await response.json();
      const authUrl = data.authUrl || data.url;

      if (!authUrl) {
        throw new Error('No auth URL returned from backend');
      }

      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate Google OAuth:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth callback (called from callback page)
   * @param {string} code - Authorization code from Google
   */
  async handleCallback(code) {
    try {
      const response = await fetch(`${this.apiBase}/auth/callback?code=${encodeURIComponent(code)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`OAuth callback failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Store tokens (backend should handle secure storage, but store minimal info client-side)
      if (data.accessToken) {
        localStorage.setItem('google_access_token', data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('google_refresh_token', data.refreshToken);
      }
      if (data.profile) {
        this.setAuthenticated(true, data.profile);
      } else {
        // Fetch user profile
        await this.fetchUserProfile();
      }

      return data;
    } catch (error) {
      console.error('Failed to handle OAuth callback:', error);
      throw error;
    }
  }

  /**
   * Fetch user profile from Google
   */
  async fetchUserProfile() {
    try {
      const response = await fetch(`${this.apiBase}/user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }

      const profile = await response.json();
      this.setAuthenticated(true, profile);
      return profile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw error;
    }
  }

  /**
   * Disconnect Google account
   */
  async disconnect() {
    try {
      const response = await fetch(`${this.apiBase}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.status}`);
      }

      this.setAuthenticated(false);
      return true;
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  getUserProfile() {
    return this.userProfile;
  }

  /**
   * Check if user has granted calendar permissions
   */
  hasCalendarAccess() {
    return this.isConfigured() && localStorage.getItem('google_calendar_enabled') === 'true';
  }

  /**
   * Set calendar access status
   */
  setCalendarAccess(enabled) {
    localStorage.setItem('google_calendar_enabled', enabled ? 'true' : '');
  }
}

// Export singleton instance
window.googleService = new GoogleService();

