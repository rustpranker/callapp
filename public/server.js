require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const {Twilio} = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

const client = (accountSid && authToken) ? new Twilio(accountSid, authToken) : null;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true if using HTTPS
}));

// API: send verification code via Twilio Verify
app.post('/api/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if(!phone) return res.status(400).json({ error: 'Phone required' });
    if(!client || !verifySid) return res.status(500).json({ error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SID in .env' });
    const verification = await client.verify.services(verifySid).verifications.create({ to: phone, channel: 'sms' });
    return res.json({ ok: true, sid: verification.sid, status: verification.status });
  } catch (err) {
    console.error('send-code error', err);
    return res.status(500).json({ error: err.message || 'send-code failed' });
  }
});

// API: check verification code
app.post('/api/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if(!phone || !code) return res.status(400).json({ error: 'Phone and code required' });
    if(!client || !verifySid) return res.status(500).json({ error: 'Twilio not configured' });
    const check = await client.verify.services(verifySid).verificationChecks.create({ to: phone, code });
    if(check.status === 'approved') {
      // mark session as verified user
      req.session.verified = true;
      req.session.phone = phone;
      return res.json({ ok: true });
    } else {
      return res.status(401).json({ error: 'Неверный код' });
    }
  } catch (err) {
    console.error('verify-code error', err);
    return res.status(500).json({ error: err.message || 'verify-code failed' });
  }
});

// API: initiate a bridged call: call user first, then connect to target
app.post('/api/call', async (req, res) => {
  try {
    if(!req.session || !req.session.verified) return res.status(401).json({ error: 'Not verified' });
    const userPhone = req.session.phone;
    const { target } = req.body;
    if(!target) return res.status(400).json({ error: 'Target number required' });
    if(!client || !fromNumber) return res.status(500).json({ error: 'Twilio not configured. Set TWILIO_FROM_NUMBER in .env' });
    // Create an outbound call to the user; when the user answers, Twilio will request /voice with target as query
    const call = await client.calls.create({
      to: userPhone,
      from: fromNumber,
      url: `${req.protocol}://${req.get('host')}/voice?target=${encodeURIComponent(target)}`
    });
    // Save call SID in session (optional)
    req.session.lastCallSid = call.sid;
    return res.json({ ok: true, sid: call.sid });
  } catch (err) {
    console.error('call error', err);
    // Map common Twilio errors to messages
    const msg = err.message || 'call failed';
    return res.status(500).json({ error: msg });
  }
});

// TwiML voice handler: when Twilio calls the user, connect to target number
app.post('/voice', express.urlencoded({ extended: false }), (req, res) => {
  // Twilio will POST here when the user answers the call
  const target = req.query.target;
  // Return TwiML: Dial the target and bridge
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${fromNumber}">${target}</Dial></Response>`;
  res.type('text/xml');
  res.send(twiml);
});

// Simple middleware to protect dashboard route
app.get('/dashboard', (req, res) => {
  if(!req.session || !req.session.verified) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/call', (req,res)=>{
  if(!req.session || !req.session.verified) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'call.html'));
});

app.listen(port, () => {
  console.log('Server listening on port', port);
});
