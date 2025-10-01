require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const { Twilio } = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

// Для Voice Token
const apiKey = process.env.TWILIO_API_KEY_SID;
const apiSecret = process.env.TWILIO_API_KEY_SECRET;
const appSid = process.env.TWILIO_TWIML_APP_SID;

const client = (accountSid && authToken) ? new Twilio(accountSid, authToken) : null;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // ставь true если используешь HTTPS
}));

// ======== AUTH: VERIFY ========
app.post('/api/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone required' });
    if (!client || !verifySid) return res.status(500).json({ error: 'Twilio not configured' });
    const verification = await client.verify.services(verifySid).verifications.create({ to: phone, channel: 'sms' });
    return res.json({ ok: true, sid: verification.sid, status: verification.status });
  } catch (err) {
    console.error('send-code error', err);
    return res.status(500).json({ error: err.message || 'send-code failed' });
  }
});

app.post('/api/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });
    if (!client || !verifySid) return res.status(500).json({ error: 'Twilio not configured' });
    const check = await client.verify.services(verifySid).verificationChecks.create({ to: phone, code });
    if (check.status === 'approved') {
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

// ======== CALL API ========
// 1) Исходящий звонок: звонит на твой телефон, потом соединяет с target
app.post('/api/call', async (req, res) => {
  try {
    if (!req.session || !req.session.verified) return res.status(401).json({ error: 'Not verified' });
    const userPhone = req.session.phone;
    const { target } = req.body;
    if (!target) return res.status(400).json({ error: 'Target number required' });
    if (!client || !fromNumber) return res.status(500).json({ error: 'Twilio not configured' });

    const call = await client.calls.create({
      to: userPhone,
      from: fromNumber,
      url: `${req.protocol}://${req.get('host')}/voice?target=${encodeURIComponent(target)}`
    });
    req.session.lastCallSid = call.sid;
    return res.json({ ok: true, sid: call.sid });
  } catch (err) {
    console.error('call error', err);
    return res.status(500).json({ error: err.message || 'call failed' });
  }
});

// 2) TwiML обработчик: соединяет вызов с target
app.post('/voice', express.urlencoded({ extended: false }), (req, res) => {
  const target = req.query.target;
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (target) {
    twiml += `<Dial callerId="${fromNumber}" timeout="20">${target}</Dial>`;
  } else {
    twiml += '<Say voice="alice">Извините, абонент недоступен.</Say>';
  }

  twiml += '</Response>';
  res.type('text/xml');
  res.send(twiml);
});

// ======== TOKEN для Web-клиента (если хочешь звонки прямо из браузера) ========
app.get('/api/token', (req, res) => {
  if (!apiKey || !apiSecret || !accountSid) return res.status(500).json({ error: 'Twilio API key not configured' });
  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const identity = req.session.phone || 'user-' + Date.now();

  const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });
  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: true
  }));

  res.json({ token: token.toJwt(), identity });
});

// ======== ROUTES ========
app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.verified) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/call', (req, res) => {
  if (!req.session || !req.session.verified) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'call.html'));
});

app.listen(port, () => {
  console.log('Server listening on port', port);
});
