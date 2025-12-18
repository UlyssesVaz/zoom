# Celera - Custom Video Conferencing Tool

Celera is a custom video conferencing tool built on Zoom's Meeting SDK for Web that turns sales and customer success calls into actionable intelligence.

## Features

### 🎯 Pre-Call Context Room
Before joining any video call, users see a "Prep Screen" displaying:
- Client/Account information
- Deal details (size, stage, value)
- Last interaction history
- Key contacts and stakeholders
- Industry and company context
- Relevant notes or reminders

### 📹 Embedded Video Calls
- Seamless Zoom video call experience embedded in the application
- No redirects, no separate windows—everything stays within Celera
- Cloud recording enabled automatically

### 📊 Post-Call Intelligence Summary
Immediately after a call ends, users are redirected to an "Intelligence Summary" page showing:
- Call context (who was on the call, deal details)
- Recording status (processing, ready, download link)
- Next steps and action items
- Integration with webhook system for automatic data capture

## Getting Started

### Prerequisites
- Node.js installed
- Zoom Meeting SDK credentials (Client ID and Secret)
- Auth endpoint server running (see Zoom SDK documentation)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the main application:
```bash
npm start
```

3. (Optional) Start the webhook server in a separate terminal:
```bash
npm run webhook
```

The application will be available at:
- Main app: http://127.0.0.1:9999
- Webhook server: http://localhost:4001

## User Flow

1. **Pre-Call Prep** (`/prep.html`)
   - Review CRM context
   - Enter your name and meeting details
   - Click "Join Call"

2. **Video Call** (`/meeting.html`)
   - Standard Zoom meeting experience
   - Embedded in the application

3. **Post-Call Summary** (`/summary.html`)
   - View call intelligence
   - Check recording status
   - Review next steps

## Webhook Integration

The webhook server (`webhook-server.js`) receives events from Zoom when recordings are completed. To set up:

1. Configure Zoom webhooks to point to: `http://your-domain.com/webhook/recording`
2. The webhook server will process recording events and update the summary page

### Webhook Events Supported
- `recording.completed` - When a recording finishes processing

## File Structure

```
CDN/
├── prep.html          # Pre-call context room
├── meeting.html       # Embedded Zoom meeting
├── summary.html       # Post-call intelligence summary
├── webhook.html       # Webhook receiver page
├── webhook-server.js  # Webhook server (Node.js/Express)
├── js/
│   ├── prep.js        # Pre-call logic
│   ├── meeting.js     # Meeting logic (modified to redirect to summary)
│   ├── summary.js     # Post-call summary logic
│   └── tool.js        # Utility functions
└── index.html         # Original Zoom SDK demo (with Celera link)
```

## Mock Data

Currently, the application uses mock CRM data. To integrate with a real CRM:

1. Update `js/prep.js` - Replace `loadMockCRMData()` with API calls to your CRM
2. Update `js/summary.js` - Replace mock participants with real meeting data
3. Add authentication/authorization as needed

## Future Enhancements

- AI-powered call transcription and summarization
- Key moment detection (objections, buying signals, next steps)
- Automatic sentiment analysis
- Smart action item extraction
- CRM integration (Salesforce, HubSpot, Pipedrive)
- Analytics dashboard

## Notes

- The application stores call context in `sessionStorage` for the duration of the session
- Webhook data can be passed via URL parameters or stored in `sessionStorage`
- Recording processing is simulated in the MVP; real processing would come from Zoom webhooks

## License

See LICENSE.md for details.






