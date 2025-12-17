# Telemetry API Endpoints

These endpoints need to be implemented in your backend server to handle telemetry tracking.

## Email Tracking

### GET /api/telemetry/email/open
Track email opens via tracking pixel.

**Query Parameters:**
- `emailId` - Unique email identifier
- `dealId` - Deal ID (optional)
- `contactId` - Contact ID (optional)
- `token` - Security token

**Response:**
Returns a 1x1 transparent PNG image

**Implementation:**
```javascript
app.get('/api/telemetry/email/open', async (req, res) => {
  const { emailId, dealId, contactId, token } = req.query;
  
  // Verify token (optional security check)
  // Log email open event
  // Update database/storage
  
  // Return 1x1 transparent PNG
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(pixel);
});
```

### GET /api/telemetry/email/click
Track email link clicks and redirect to original URL.

**Query Parameters:**
- `url` - Original URL (encoded)
- `emailId` - Unique email identifier
- `dealId` - Deal ID (optional)
- `contactId` - Contact ID (optional)
- `token` - Security token

**Response:**
Redirects to original URL

**Implementation:**
```javascript
app.get('/api/telemetry/email/click', async (req, res) => {
  const { url, emailId, dealId, contactId, token } = req.query;
  
  // Verify token
  // Log click event
  // Update database/storage
  
  // Redirect to original URL
  res.redirect(decodeURIComponent(url));
});
```

## Document Tracking

### GET /api/telemetry/document/view
Track document views (PDFs, proposals, etc.).

**Query Parameters:**
- `docId` - Document identifier
- `dealId` - Deal ID (optional)
- `contactId` - Contact ID (optional)
- `type` - Document type (pdf, docx, etc.)
- `token` - Security token
- `redirect` - Original document URL (optional)

**Response:**
- If `redirect` is provided: Redirects to document URL
- Otherwise: Returns document file with embedded tracking

**Implementation:**
```javascript
app.get('/api/telemetry/document/view', async (req, res) => {
  const { docId, dealId, contactId, type, token, redirect } = req.query;
  
  // Verify token
  // Log document view event
  // Update database/storage
  
  if (redirect) {
    // Redirect to original document
    res.redirect(decodeURIComponent(redirect));
  } else {
    // Return document with tracking (for PDFs, you'd embed tracking pixels)
    // This is more complex and may require PDF manipulation libraries
    res.sendFile(pathToDocument);
  }
});
```

## Calendar Tracking

### GET /api/telemetry/calendar/invite
Track calendar invite opens.

**Query Parameters:**
- `eventId` - Calendar event identifier
- `dealId` - Deal ID (optional)
- `contactId` - Contact ID (optional)
- `token` - Security token

**Response:**
Returns calendar invite (.ics file) or redirects to calendar

**Implementation:**
```javascript
app.get('/api/telemetry/calendar/invite', async (req, res) => {
  const { eventId, dealId, contactId, token } = req.query;
  
  // Verify token
  // Log invite opened event
  // Update database/storage
  
  // Return .ics file or redirect to calendar
  // For Google Calendar, you might redirect to the event URL
});
```

### GET /api/telemetry/calendar/accept
Track calendar acceptances.

**Query Parameters:**
- `eventId` - Calendar event identifier
- `dealId` - Deal ID (optional)
- `contactId` - Contact ID (optional)
- `token` - Security token

**Response:**
Redirects to calendar acceptance URL

### GET /api/telemetry/calendar/decline
Track calendar declines.

**Query Parameters:**
- `eventId` - Calendar event identifier
- `dealId` - Deal ID (optional)
- `contactId` - Contact ID (optional)
- `token` - Security token

**Response:**
Redirects to calendar decline URL

## Notes

- All endpoints should log events to your database/storage
- Consider rate limiting to prevent abuse
- Token verification adds security but can be optional for MVP
- For production, use proper authentication and encryption
- Store telemetry data for analytics and reporting

