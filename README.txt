Twilio Verify + Call Bridge Project
==================================

What this project does
- Verifies user phone numbers via Twilio Verify (SMS codes).
- After verification, allows initiating real outbound calls via Twilio.
- Call behavior: Twilio will first call the verified user (your phone). When the user answers, Twilio dials the target number and connects (bridge).

Important notes and limits
- This project places outbound calls from your Twilio phone number (TWILIO_FROM_NUMBER). Charges for calls/SMS are billed to your Twilio account.
- It is NOT possible to automatically and legally debit a user's mobile carrier "balance" from their SIM via this code. If you need carrier-billing, you must integrate with operators that provide carrier-billing APIs and sign contracts.
- Make sure you comply with local laws and carrier rules for calling and SMS delivery.

Setup
1. Copy `.env.example` to `.env` and fill with your Twilio credentials:
   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID, TWILIO_FROM_NUMBER, SESSION_SECRET, PORT.
2. Install dependencies:
   npm install
3. Run the server:
   node server.js
4. Open http://localhost:3000 in your browser.

Files of interest
- server.js  -- Express server with endpoints: /api/send-code, /api/verify-code, /api/call, /voice
- public/index.html -- initial phone input + code verification
- public/dashboard.html -- Skype-like dashboard after verification
- public/call.html -- active call UI
- public/app.js -- frontend logic (fetch API calls)
- .env.example -- example environment variables

Security & production
- Use HTTPS in production.
- Secure your session secret.
- Consider rate-limiting send-code to prevent abuse.
