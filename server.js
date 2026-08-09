const express = require('express');
const path = require('path');
const { Pool } = require('pg');

// Optional local .env support (Render injects env vars directly)
try {
  require('dotenv').config();
} catch (_) {
  // dotenv is optional in production if env vars are set by the host
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;
const EXPORT_API_KEY = process.env.EXPORT_API_KEY || '';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in your environment or .env file.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false'
    ? false
    : NODE_ENV === 'production' || /render\.com|amazonaws\.com|neon\.tech|supabase\.co/i.test(DATABASE_URL)
      ? { rejectUnauthorized: false }
      : false,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const ALLOWED_TOPICS = [
  'Can a Christian struggle with mental illness?',
  'What is mental illness? What causes it, and how can I recognize it?',
  'Should Christians seek therapy or other professional mental health support?',
  'How can churches, families, and Christian communities support people living with mental illness?',
  'Can people recover from mental illness? Is there hope for healing?'
];

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        country TEXT NOT NULL,
        age_range TEXT NOT NULL,
        gender TEXT,
        audience_category TEXT NOT NULL,
        audience_category_other TEXT,
        religion TEXT NOT NULL,
        religion_other TEXT,
        referral_channel TEXT NOT NULL,
        referral_channel_other TEXT,
        registration_reasons TEXT NOT NULL,
        registration_reasons_other TEXT,
        topic_of_interest TEXT NOT NULL,
        speaker_question TEXT,
        attended_before TEXT NOT NULL,
        pre_assessment_q1 TEXT NOT NULL,
        pre_assessment_q2 TEXT NOT NULL,
        pre_assessment_q3 TEXT NOT NULL,
        pre_assessment_q4 TEXT NOT NULL,
        pre_assessment_q5 TEXT NOT NULL,
        consent_updates BOOLEAN NOT NULL DEFAULT TRUE,
        consent_recording BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_registrations_created_at
      ON registrations (created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_registrations_email
      ON registrations (email);
    `);
  } finally {
    client.release();
  }
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self';"
  );
  next();
});

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiter
const rateLimitMap = new Map();
const LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS = 10;

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((time) => now - time < LIMIT_WINDOW_MS);
    if (valid.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, valid);
  }
}, 300000).unref();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();

  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);

  let timestamps = rateLimitMap.get(ip).filter((time) => now - time < LIMIT_WINDOW_MS);
  rateLimitMap.set(ip, timestamps);

  if (timestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many registration attempts. Please wait a minute before trying again.'
    });
  }

  timestamps.push(now);
  next();
}

function requireExportAuth(req, res, next) {
  if (!EXPORT_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Export is not configured. Set EXPORT_API_KEY in the environment.'
    });
  }

  const headerKey = req.get('x-api-key') || '';
  const authHeader = req.get('authorization') || '';
  const bearerKey = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const queryKey = typeof req.query.key === 'string' ? req.query.key : '';
  const provided = headerKey || bearerKey || queryKey;

  if (!provided || provided !== EXPORT_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Provide a valid EXPORT_API_KEY.'
    });
  }

  next();
}

function validateString(val, name, min, max, required = true) {
  if (required && (val === undefined || val === null || val === '')) {
    throw new Error(`${name} is required.`);
  }
  if (val) {
    if (typeof val !== 'string') throw new Error(`Invalid data type for ${name}.`);
    const s = val.trim();
    if (s.length < min || s.length > max) {
      throw new Error(`${name} must be between ${min} and ${max} characters.`);
    }
    return s;
  }
  return '';
}

function validateEmail(email) {
  const trimmed = validateString(email, 'Email Address', 5, 100, true);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error('Please provide a valid email address.');
  }
  return trimmed.toLowerCase();
}

function escapeCsvCell(val) {
  if (typeof val !== 'string') val = String(val ?? '');
  if (/^[=+\-@\t\r\n]/.test(val)) return `'${val}`;
  return val;
}

function toCsvLine(values) {
  return (
    values
      .map((val) => {
        const escaped = escapeCsvCell(val).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',') + '\r\n'
  );
}

function buildRegistrationRecord(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request payload format.');
  }

  const fullName = validateString(data.fullName, 'Full Name (including Middle Name)', 3, 120, true);
  const email = validateEmail(data.email);
  const phone = validateString(data.phone, 'Phone Number', 5, 25, true);
  const country = validateString(data.country, 'Country of Residence', 2, 60, true);

  const allowedAges = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'];
  const ageRange = validateString(data.ageRange, 'Age Range', 2, 20, true);
  if (!allowedAges.includes(ageRange)) throw new Error('Invalid Age Range selected.');

  const allowedGenders = ['Male', 'Female', 'Prefer not to say', ''];
  const gender = validateString(data.gender, 'Gender', 0, 25, false);
  if (!allowedGenders.includes(gender)) throw new Error('Invalid Gender selected.');

  const allowedDescriptions = [
    'Student',
    'Healthcare Professional',
    'Pastor/Church Leader',
    'Mental Health Professional',
    'Counsellor/Therapist',
    'Teacher/Educator',
    'Parent',
    'General Public',
    'Other'
  ];
  const description = validateString(data.description, 'Occupation / Category', 2, 50, true);
  if (!allowedDescriptions.includes(description)) {
    throw new Error('Invalid audience category selection.');
  }
  const descriptionOther =
    description === 'Other'
      ? validateString(data.descriptionOther, 'Occupation details', 1, 100, true)
      : '';

  const allowedReligions = [
    'Christian',
    'Muslim',
    'African Traditionalist',
    'Hindu',
    'Buddhist',
    'Jewish',
    'Agnostic / Atheist',
    'Prefer not to say',
    'Other'
  ];
  const religion = validateString(data.religion, 'Religion / Faith Background', 2, 50, true);
  if (!allowedReligions.includes(religion)) throw new Error('Invalid Religion selection.');
  const religionOther =
    religion === 'Other'
      ? validateString(data.religionOther, 'Religion details', 1, 100, true)
      : '';

  const allowedChannels = [
    'Instagram',
    'LinkedIn',
    'Facebook',
    'WhatsApp',
    'Friend/Family',
    'Church',
    'Speaker',
    'Other'
  ];
  const referralChannel = validateString(data.referralChannel, 'Referral channel', 2, 30, true);
  if (!allowedChannels.includes(referralChannel)) {
    throw new Error('Invalid referral channel selection.');
  }
  const referralChannelOther =
    referralChannel === 'Other'
      ? validateString(data.referralChannelOther, 'Referral channel details', 1, 100, true)
      : '';

  const allowedReasons = [
    "I'm interested in mental health.",
    "I'm interested in the relationship between faith and mental health.",
    'I want to learn how to support others.',
    'Personal interest/experience.',
    'Professional development.',
    'Recommended by someone.',
    'Other.'
  ];

  let reasons = [];
  if (Array.isArray(data.reasons)) {
    reasons = data.reasons
      .filter((r) => typeof r === 'string')
      .map((r) => r.trim())
      .filter((r) => allowedReasons.includes(r));
  } else {
    throw new Error('Reasons format is invalid.');
  }
  if (reasons.length === 0) {
    throw new Error('At least one registration reason must be selected.');
  }
  const reasonsOther = reasons.includes('Other.')
    ? validateString(data.reasonsOther, 'Registration reason details', 1, 150, true)
    : '';

  const topicOfInterest = validateString(data.topicOfInterest, 'Topic of Interest', 5, 200, true);
  if (!ALLOWED_TOPICS.includes(topicOfInterest)) {
    throw new Error('Invalid Topic of Interest selection.');
  }

  const speakerQuestion = validateString(data.speakerQuestion, 'Question for speakers', 0, 500, false);

  const allowedAttended = ['Yes', 'No'];
  const attendedBefore = validateString(data.attendedBefore, 'Attended before', 2, 3, true);
  if (!allowedAttended.includes(attendedBefore)) {
    throw new Error('Invalid selection for webinar history.');
  }

  const allowedLikert = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];
  const preAssessment = [];
  for (let i = 1; i <= 5; i++) {
    const answer = validateString(
      data[`preAssessmentQ${i}`],
      `Pre-Assessment Question ${i}`,
      4,
      20,
      true
    );
    if (!allowedLikert.includes(answer)) {
      throw new Error(`Invalid response for Pre-Assessment Question ${i}.`);
    }
    preAssessment.push(answer);
  }

  if (data.consentUpdates !== true) {
    throw new Error('You must agree to receive reminders and updates.');
  }
  if (data.consentRecording !== true) {
    throw new Error('You must agree to the recording terms.');
  }

  return {
    fullName,
    email,
    phone,
    country,
    ageRange,
    gender,
    description,
    descriptionOther,
    religion,
    religionOther,
    referralChannel,
    referralChannelOther,
    reasons: reasons.join('; '),
    reasonsOther,
    topicOfInterest,
    speakerQuestion,
    attendedBefore,
    preAssessment,
    consentUpdates: true,
    consentRecording: true
  };
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ success: false, status: 'error', database: 'disconnected' });
  }
});

app.post('/api/register', rateLimiter, async (req, res) => {
  try {
    const record = buildRegistrationRecord(req.body);

    await pool.query(
      `INSERT INTO registrations (
        full_name, email, phone, country, age_range, gender,
        audience_category, audience_category_other,
        religion, religion_other,
        referral_channel, referral_channel_other,
        registration_reasons, registration_reasons_other,
        topic_of_interest, speaker_question, attended_before,
        pre_assessment_q1, pre_assessment_q2, pre_assessment_q3,
        pre_assessment_q4, pre_assessment_q5,
        consent_updates, consent_recording
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,
        $9,$10,
        $11,$12,
        $13,$14,
        $15,$16,$17,
        $18,$19,$20,
        $21,$22,
        $23,$24
      )`,
      [
        record.fullName,
        record.email,
        record.phone,
        record.country,
        record.ageRange,
        record.gender || null,
        record.description,
        record.descriptionOther || null,
        record.religion,
        record.religionOther || null,
        record.referralChannel,
        record.referralChannelOther || null,
        record.reasons,
        record.reasonsOther || null,
        record.topicOfInterest,
        record.speakerQuestion || null,
        record.attendedBefore,
        record.preAssessment[0],
        record.preAssessment[1],
        record.preAssessment[2],
        record.preAssessment[3],
        record.preAssessment[4],
        record.consentUpdates,
        record.consentRecording
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Registration completed successfully.'
    });
  } catch (error) {
    const status = /required|Invalid|must be|format/i.test(error.message || '') ? 400 : 500;
    res.status(status).json({
      success: false,
      error:
        status === 400
          ? error.message || 'Validation error during submission.'
          : 'Unable to save registration right now. Please try again.'
    });
  }
});

// Protected export endpoint — CSV download of all registrations
app.get('/api/export', requireExportAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        created_at,
        full_name,
        email,
        phone,
        country,
        age_range,
        gender,
        audience_category,
        audience_category_other,
        religion,
        religion_other,
        referral_channel,
        referral_channel_other,
        registration_reasons,
        registration_reasons_other,
        topic_of_interest,
        speaker_question,
        attended_before,
        pre_assessment_q1,
        pre_assessment_q2,
        pre_assessment_q3,
        pre_assessment_q4,
        pre_assessment_q5,
        consent_updates,
        consent_recording
      FROM registrations
      ORDER BY created_at DESC
    `);

    const headers = [
      'ID',
      'Timestamp',
      'Full Name (Inc. Middle)',
      'Email Address',
      'Phone Number',
      'Country of Residence',
      'Age Range',
      'Gender',
      'Audience Category',
      'Audience Category (Other)',
      'Religion / Faith Background',
      'Religion / Faith Background (Other)',
      'Referral Channel',
      'Referral Channel (Other)',
      'Registration Reasons',
      'Registration Reasons (Other)',
      'Topic of Interest',
      'Speaker Question',
      'Attended Webinar Before',
      'Pre-Assessment Q1',
      'Pre-Assessment Q2',
      'Pre-Assessment Q3',
      'Pre-Assessment Q4',
      'Pre-Assessment Q5',
      'Consent: Marketing & Resources',
      'Consent: Recording'
    ];

    const format = String(req.query.format || 'csv').toLowerCase();

    if (format === 'json') {
      return res.json({
        success: true,
        count: result.rows.length,
        data: result.rows
      });
    }

    let csv = toCsvLine(headers);
    for (const row of result.rows) {
      csv += toCsvLine([
        row.id,
        row.created_at ? new Date(row.created_at).toISOString() : '',
        row.full_name,
        row.email,
        row.phone,
        row.country,
        row.age_range,
        row.gender || '',
        row.audience_category,
        row.audience_category_other || '',
        row.religion,
        row.religion_other || '',
        row.referral_channel,
        row.referral_channel_other || '',
        row.registration_reasons,
        row.registration_reasons_other || '',
        row.topic_of_interest,
        row.speaker_question || '',
        row.attended_before,
        row.pre_assessment_q1,
        row.pre_assessment_q2,
        row.pre_assessment_q3,
        row.pre_assessment_q4,
        row.pre_assessment_q5,
        row.consent_updates ? 'Yes' : 'No',
        row.consent_recording ? 'Yes' : 'No'
      ]);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mind-you-registrations-${stamp}.csv"`
    );
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Unable to export registrations right now.'
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found.' });
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, HOST, () => {
      console.log(`Mind You Mental Health server running at http://${HOST}:${PORT}`);
      console.log(`Database: connected`);
      console.log(`Export: ${EXPORT_API_KEY ? 'enabled (/api/export)' : 'disabled (set EXPORT_API_KEY)'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();

process.on('SIGTERM', async () => {
  await pool.end().catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  await pool.end().catch(() => {});
  process.exit(0);
});
