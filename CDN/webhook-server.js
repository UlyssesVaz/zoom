/**
 * Simple Webhook Server for Celera
 * 
 * This is a basic Express server that receives webhook events from Zoom
 * and forwards them to the frontend. In production, you'd want to:
 * - Add proper authentication
 * - Store webhook data in a database
 * - Process recordings asynchronously
 * - Handle multiple concurrent webhooks
 */

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 4001; // Different port from auth server

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store webhook events (in production, use a database)
const webhookEvents = [];

// Webhook endpoint for Zoom recording events
app.post('/webhook/recording', (req, res) => {
  console.log('Received webhook event:', JSON.stringify(req.body, null, 2));
  
  const event = {
    timestamp: new Date().toISOString(),
    event: req.body.event,
    payload: req.body.payload,
    account_id: req.body.account_id,
    object: req.body.object
  };
  
  // Store the event
  webhookEvents.push(event);
  
  // Process recording events
  if (req.body.event === 'recording.completed') {
    const recordingData = req.body.payload.object;
    console.log('Recording completed:', recordingData);
    
    // In production, you would:
    // 1. Store recording metadata in database
    // 2. Process the recording (transcription, AI analysis, etc.)
    // 3. Update CRM with call data
    // 4. Send notification to user
    
    // For MVP, we'll just log it and return success
    res.status(200).json({
      success: true,
      message: 'Webhook received',
      recording_id: recordingData.id,
      recording_url: recordingData.recording_files?.[0]?.download_url || null
    });
  } else {
    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  }
});

// Get webhook events (for debugging)
app.get('/webhook/events', (req, res) => {
  res.json({
    events: webhookEvents,
    count: webhookEvents.length
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Celera Webhook Server running on http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/recording`);
  console.log(`Events endpoint: http://localhost:${PORT}/webhook/events`);
});





