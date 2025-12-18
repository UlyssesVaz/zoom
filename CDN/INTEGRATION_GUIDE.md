# CRM Integration Guide

This guide explains how the HubSpot and LinkedIn integration works and how to set up the backend services.

## Overview

The application now supports:
1. **HubSpot Import** - Import contacts, deals, companies, and relationships from HubSpot
2. **LinkedIn Enrichment** - Enrich contact data with LinkedIn profiles and relationship suggestions
3. **Enhanced Relationship Mapping** - Map organizational hierarchies (who reports to whom)
4. **Comprehensive Interaction Tracking** - Track calls, emails, meetings with detailed metadata
5. **Influence Score Calculation** - Automatically calculate influence scores based on multiple factors

## Architecture

The frontend services (`hubspot-service.js`, `linkedin-service.js`) are designed to work with a backend API that handles:
- OAuth authentication with HubSpot and LinkedIn
- API rate limiting and error handling
- Data normalization and transformation
- Secure credential storage

## Backend API Endpoints Required

### HubSpot Endpoints

```
POST /api/hubspot/sync
  Body: { syncContacts, syncDeals, syncCompanies, syncAssociations, fullSync }
  Returns: { success, syncedCount, errors }

GET /api/hubspot/contacts
  Query params: limit, after, properties
  Returns: { results: [contact objects] }

GET /api/hubspot/deals
  Query params: limit, after, properties
  Returns: { results: [deal objects] }

GET /api/hubspot/companies
  Query params: limit, after
  Returns: { results: [company objects] }

GET /api/hubspot/associations/:objectType/:objectId/:toObjectType
  Returns: { results: [association objects] }

GET /api/hubspot/contacts/:id/interactions
  Returns: { results: [interaction objects] }

POST /api/hubspot/interactions
  Body: { contactId, type, date, duration, subject, notes }
  Creates/updates interaction in HubSpot
```

### LinkedIn Endpoints

```
GET /api/linkedin/profile/:email
  Returns: { profile: { profileUrl, headline, summary, location, ... } }

POST /api/linkedin/search
  Body: { name, company }
  Returns: { profile: { ... } or results: [...] }

GET /api/linkedin/company/:domain
  Returns: { name, industry, size, ... }

POST /api/linkedin/relationships
  Body: { contactId, otherContactIds: [...] }
  Returns: { results: [{ sourceId, targetId, type, confidence, ... }] }
```

## Frontend Services

### HubSpotService (`hubspot-service.js`)

**Key Methods:**
- `isConfigured()` - Check if HubSpot is connected
- `syncFromHubSpot(options)` - Trigger sync from HubSpot
- `getContacts(filters)` - Get contacts with optional filters
- `getDeals(filters)` - Get deals
- `getCompanies(filters)` - Get companies
- `getAssociations(objectType, objectId, toObjectType)` - Get relationships
- `getOrgRelationships(companyId)` - Get reporting structure
- `getContactInteractions(contactId)` - Get interaction history

**Data Normalization:**
- Converts HubSpot data format to internal format
- Extracts organizational relationships from custom properties
- Maps interaction types (CALL, EMAIL, MEETING, etc.)

### LinkedInService (`linkedin-service.js`)

**Key Methods:**
- `isConfigured()` - Check if LinkedIn enrichment is enabled
- `enrichContact(contact)` - Enrich a single contact
- `enrichContacts(contacts)` - Batch enrich multiple contacts
- `getProfileByEmail(email)` - Get LinkedIn profile by email
- `searchProfile(name, company)` - Search for profile
- `getRelationshipSuggestions(contactId, otherContacts)` - Get relationship suggestions

**Enrichment Data:**
- Profile URL, headline, summary
- Location, industry
- Profile picture
- Experience and education history
- Skills
- Mutual connections
- Shared companies/schools

### GraphService Enhancements

**New Features:**
- `loadFromHubSpot()` - Load graph data from HubSpot
- `enrichWithLinkedIn()` - Enrich contacts with LinkedIn data
- `loadInteractionHistory()` - Load interactions from HubSpot
- `getContactInteractions(contactId, filters)` - Get filtered interactions
- `getInteractionStats(contactId)` - Get interaction statistics
- Enhanced `getOrgChart()` - Better hierarchy visualization with levels

**Relationship Types:**
- `reports_to` - Organizational reporting structure
- `manages` - Management relationships
- `works_at` - Contact works at company
- `belongs_to` - Deal belongs to company
- `decision_maker_for` - Contact is decision maker for deal
- `influencer_for` - Contact influences deal
- `former_colleague` - LinkedIn-suggested relationship
- `alumni` - Shared school connection
- `mutual_connection` - Mutual LinkedIn connections

### DataService Updates

**HubSpot Integration:**
- Automatically uses HubSpot when configured
- Falls back to mock data if HubSpot unavailable
- Formats dates and handles data transformation

## Configuration

### HubSpot Setup

1. Configure HubSpot OAuth in your backend
2. Set `hubspot_configured` in localStorage after OAuth completes
3. Set `hubspot_api_base` if using custom backend URL (default: `/api/hubspot`)

```javascript
// After OAuth completes
window.hubspotService.setConfigured(true);
localStorage.setItem('hubspot_api_base', '/api/hubspot');
```

### LinkedIn Setup

1. Configure LinkedIn API access in your backend
2. Enable enrichment: `window.linkedinService.setEnabled(true)`
3. Set configured: `window.linkedinService.setConfigured(true)`
4. Set API base if needed: `localStorage.setItem('linkedin_api_base', '/api/linkedin')`

```javascript
window.linkedinService.setEnabled(true);
window.linkedinService.setConfigured(true);
```

## Usage Examples

### Sync from HubSpot

```javascript
// Trigger full sync
await window.hubspotService.syncFromHubSpot({
  syncContacts: true,
  syncDeals: true,
  syncCompanies: true,
  syncAssociations: true,
  fullSync: true
});
```

### Enrich Contact with LinkedIn

```javascript
const contact = {
  name: 'John Doe',
  email: 'john@example.com',
  company: 'Acme Corp'
};

const enriched = await window.linkedinService.enrichContact(contact);
console.log(enriched.linkedin); // LinkedIn data
```

### Get Interaction History

```javascript
const interactions = window.graphService.getContactInteractions('contact_1', {
  type: 'call',
  dateRange: {
    start: '2024-01-01',
    end: '2024-01-31'
  }
});

const stats = window.graphService.getInteractionStats('contact_1');
console.log(stats.total, stats.byType, stats.totalCallDuration);
```

### Get Org Chart

```javascript
const orgChart = window.graphService.getOrgChart('account_1');
// Returns hierarchy with levels, reportsTo, manages relationships
```

## Influence Score Calculation

Influence scores are calculated based on:

1. **Role-based score (30 points max)**
   - CEO: 30 points
   - CTO/CFO: 25 points
   - VP: 20 points
   - Director: 15 points
   - Manager: 10 points

2. **Deal influence (20 points max)**
   - 10 points per deal association

3. **Relationship strength (20 points max)**
   - Based on strong relationships (strength >= 0.7)

4. **Interaction frequency (15 points max)**
   - Recent interactions (last 90 days)
   - 2 points per interaction

5. **Network centrality (15 points max)**
   - Number of connections
   - 1.5 points per connection

**Total: 100 points maximum**

## Interaction Tracking

Interactions are tracked with:
- Type: `call`, `email`, `meeting`, `note`, `task`
- Duration (for calls/meetings)
- Subject/title
- Notes/content
- Deal association
- Completion status

Relationship strength increases based on:
- Call duration (longer = stronger)
- Meeting participation (higher value)
- Email exchanges (lower value)
- Completion status

## Next Steps

1. **Build Backend API** - Implement the endpoints listed above
2. **Set up OAuth** - Configure HubSpot and LinkedIn OAuth flows
3. **Test Integration** - Test with real HubSpot data
4. **Configure Settings Page** - Add UI for connecting HubSpot/LinkedIn
5. **Add Sync Scheduling** - Implement periodic syncs

## Notes

- All services gracefully fall back to mock data if backend unavailable
- LinkedIn enrichment is optional and can be disabled
- HubSpot sync can be incremental or full
- Relationship suggestions from LinkedIn are marked as unconfirmed
- Interaction tracking syncs back to HubSpot when configured






