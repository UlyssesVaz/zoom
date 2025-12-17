/**
 * Production Server for Celera
 * 
 * Serves static files and handles webhook endpoints
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 9999;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 4001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store webhook events (in production, use a database)
const webhookEvents = [];

// Webhook endpoints
app.post('/webhook/recording', (req, res) => {
  console.log('Received webhook event:', JSON.stringify(req.body, null, 2));
  
  const event = {
    timestamp: new Date().toISOString(),
    event: req.body.event,
    payload: req.body.payload,
    account_id: req.body.account_id,
    object: req.body.object
  };
  
  webhookEvents.push(event);
  
  if (req.body.event === 'recording.completed') {
    const recordingData = req.body.payload.object;
    console.log('Recording completed:', recordingData);
    
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

app.get('/webhook/events', (req, res) => {
  res.json({
    events: webhookEvents,
    count: webhookEvents.length
  });
});

// API endpoints placeholder (for telemetry, email, etc.)
app.get('/api/telemetry/email/open', (req, res) => {
  // Return 1x1 transparent PNG
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(pixel);
});

app.get('/api/telemetry/email/click', (req, res) => {
  const { url } = req.query;
  if (url) {
    res.redirect(decodeURIComponent(url));
  } else {
    res.status(400).json({ error: 'Missing url parameter' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Handle client-side routing - serve index.html for all routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhook/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start main server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Celera Server running on http://0.0.0.0:${PORT}`);
  console.log(`Webhook endpoint: http://0.0.0.0:${PORT}/webhook/recording`);
});

// Optional: Start separate webhook server if WEBHOOK_PORT is different and not already handled
if (WEBHOOK_PORT && parseInt(WEBHOOK_PORT) !== parseInt(PORT)) {
  const webhookApp = express();
  webhookApp.use(bodyParser.json());
  webhookApp.use(bodyParser.urlencoded({ extended: true }));
  
  webhookApp.post('/webhook/recording', (req, res) => {
    console.log('Received webhook event:', JSON.stringify(req.body, null, 2));
    
    const event = {
      timestamp: new Date().toISOString(),
      event: req.body.event,
      payload: req.body.payload,
      account_id: req.body.account_id,
      object: req.body.object
    };
    
    webhookEvents.push(event);
    
    if (req.body.event === 'recording.completed') {
      const recordingData = req.body.payload.object;
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
  
  webhookApp.get('/webhook/events', (req, res) => {
    res.json({
      events: webhookEvents,
      count: webhookEvents.length
    });
  });
  
  webhookApp.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  webhookApp.listen(WEBHOOK_PORT, '0.0.0.0', () => {
    console.log(`Celera Webhook Server running on http://0.0.0.0:${WEBHOOK_PORT}`);
  });
}

