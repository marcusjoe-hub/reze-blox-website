// server.js
// ------------------------------------------------------------
// Main Express server for the Reze Blox YT quiz website.
// Phase 4 adds real questions, scoring, rules agreement,
// cheat detection saving, credits scene, and admin score views.
// ------------------------------------------------------------

// Load environment variables from .env before reading process.env anywhere else.
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const supabase = require('./config/supabase');
const passport = require('./config/passport');
const {
  requireAuth,
  requireAdmin,
  verifyAdminAction,
  checkAdminReferer,
  requireRulesAccepted,
  requireEventActive,
  blockIfAlreadySubmitted,
  attachUser
} = require('./middleware/auth');
const {
  calculateScore,
  getOrCreateUser,
  saveRobloxUsername,
  getUserByDiscordId,
  getSubmissionByDiscordId,
  saveSubmission,
  getAllSubmissions,
  clearAllSubmissions,
  getEventStatus,
  setEventStatus,
  resetEventStatus
} = require('./services/db');
const quizQuestions = require('./data/quizQuestions');
const { sendCompletedDm, sendCheatedDm } = require('./services/discordDm');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Tell Express to trust Render's proxy in production.
// This helps secure cookies work correctly after deploying to Render.
if (isProduction) {
  app.set('trust proxy', 1);
}

// Tell Express to use EJS templates from the /views folder.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve CSS, JavaScript, images, and other static assets from /public.
app.use(express.static(path.join(__dirname, 'public')));

// This lets Express read normal forms and JSON fetch() requests.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions remember who logged in after Discord OAuth succeeds.
// The cookie is httpOnly so frontend JavaScript cannot read it.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-change-this-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: isProduction
    }
  })
);

// Start Passport and enable login sessions.
app.use(passport.initialize());
app.use(passport.session());

// Make req.user available in all EJS views as "user".
app.use(attachUser);

function getFrontendQuestions() {
  // Never send correctAnswer to the browser.
  return quizQuestions.map(({ id, text, choices }) => ({ id, text, choices }));
}

function renderFriendlyError(res, message, statusCode = 500) {
  return res.status(statusCode).render('event-inactive', {
    pageTitle: 'Temporary Error | Reze Blox YT',
    eventStatus: null,
    errorMessage: message
  });
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function sanitizePartialAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((answer) => Number.isInteger(answer) && answer >= 0 && answer <= 3).slice(0, 20);
}

function getRulesAcceptedAt(req) {
  return req.session && req.session.rulesAcceptedAt ? req.session.rulesAcceptedAt : null;
}

// GET /ping
// Public health check route for uptime monitors. Keep it quiet so logs stay clean.
app.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// GET /auth/discord
// Starts real Discord OAuth. Discord will redirect back to DISCORD_CALLBACK_URL.
app.get('/auth/discord', (req, res, next) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_CALLBACK_URL) {
    return res.redirect('/?error=discord_not_configured');
  }

  return passport.authenticate('discord')(req, res, next);
});

// GET /auth/discord/callback
// Discord sends users here after approving login.
// Success: create/update the user in Supabase, then go to /rules.
app.get('/auth/discord/callback', (req, res, next) => {
  try {
    passport.authenticate('discord', (error, user) => {
      if (error || !user) {
        console.error('Discord OAuth failed:', error);
        return res.redirect('/?error=discord_oauth_failed');
      }

      req.login(user, async (loginError) => {
        if (loginError) {
          console.error('Discord session login failed:', loginError);
          return res.redirect('/?error=session_login_failed');
        }

        try {
          await getOrCreateUser(user.id, user.username);
          return res.redirect('/rules');
        } catch (dbError) {
          console.error('Could not create/update Discord user after OAuth:', dbError);
          return res.redirect('/?error=database_unavailable');
        }
      });
    })(req, res, next);
  } catch (error) {
    console.error('Unexpected OAuth callback error:', error);
    return res.redirect('/?error=unexpected_oauth_error');
  }
});

// GET /auth/logout
// Logs the user out of the local website session.
app.get('/auth/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) {
      return next(error);
    }

    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.redirect('/');
    });
  });
});

// GET /
// First page users see. Sign Up / Log In use real Discord OAuth.
app.get('/', (req, res) => {
  res.render('home', {
    pageTitle: 'Reze Blox YT | Server Quiz',
    authError: req.query.error || null
  });
});

// GET /rules
// Users must accept rules before entering Roblox setup or quiz.
app.get('/rules', requireAuth, requireEventActive, blockIfAlreadySubmitted, (req, res) => {
  res.render('rules', {
    pageTitle: 'Rules | Reze Blox YT',
    formError: null
  });
});

// POST /rules
// Stores rules agreement in the user's session.
app.post('/rules', requireAuth, requireEventActive, blockIfAlreadySubmitted, (req, res) => {
  try {
    if (req.body.acceptRules !== 'on') {
      return res.status(400).render('rules', {
        pageTitle: 'Rules | Reze Blox YT',
        formError: 'You must accept the rules before continuing.'
      });
    }

    req.session.rulesAccepted = true;
    req.session.rulesAcceptedAt = new Date().toISOString();
    return res.redirect('/roblox-setup');
  } catch (error) {
    console.error('POST /rules failed:', error);
    return renderFriendlyError(res, 'We could not save your agreement right now. Please try again later.');
  }
});

// GET /roblox-setup
// Page shown after Discord OAuth login and rules acceptance.
app.get('/roblox-setup', requireAuth, requireRulesAccepted, requireEventActive, blockIfAlreadySubmitted, async (req, res) => {
  try {
    const dbUser = await getUserByDiscordId(req.user.id);

    res.render('roblox-setup', {
      pageTitle: 'Roblox Setup | Reze Blox YT',
      robloxUsername: dbUser ? dbUser.roblox_username : '',
      formError: null
    });
  } catch (error) {
    console.error('GET /roblox-setup failed:', error);
    return renderFriendlyError(res, 'We could not load your profile right now. Please try again later.');
  }
});

// POST /roblox-setup
// Saves Roblox username for the authenticated Discord user.
app.post('/roblox-setup', requireAuth, requireRulesAccepted, requireEventActive, blockIfAlreadySubmitted, async (req, res) => {
  try {
    const robloxUsername = String(req.body.robloxUsername || req.body.roblox_username || '').trim();

    if (!robloxUsername) {
      return res.status(400).render('roblox-setup', {
        pageTitle: 'Roblox Setup | Reze Blox YT',
        robloxUsername,
        formError: 'Please enter your Roblox username before continuing.'
      });
    }

    if (robloxUsername.length > 20) {
      return res.status(400).render('roblox-setup', {
        pageTitle: 'Roblox Setup | Reze Blox YT',
        robloxUsername,
        formError: 'Roblox usernames cannot be longer than 20 characters.'
      });
    }

    await saveRobloxUsername(req.user.id, robloxUsername);
    return res.redirect('/quiz');
  } catch (error) {
    console.error('POST /roblox-setup failed:', error);
    return renderFriendlyError(res, 'We could not save your Roblox username right now. Please try again later.');
  }
});

// GET /quiz
// One-question-at-a-time quiz UI using real questions with answer key hidden.
app.get('/quiz', requireAuth, requireRulesAccepted, requireEventActive, blockIfAlreadySubmitted, async (req, res) => {
  try {
    const dbUser = await getUserByDiscordId(req.user.id);

    if (!dbUser || !dbUser.roblox_username) {
      return res.redirect('/roblox-setup');
    }

    res.render('quiz', {
      pageTitle: 'Quiz | Reze Blox YT',
      questions: getFrontendQuestions()
    });
  } catch (error) {
    console.error('GET /quiz failed:', error);
    return renderFriendlyError(res, 'We could not load the quiz right now. Please try again later.');
  }
});

// POST /quiz/submit
// Saves a normal scored quiz submission in Supabase. Never trust client data.
app.post('/quiz/submit', requireAuth, requireRulesAccepted, requireEventActive, blockIfAlreadySubmitted, async (req, res) => {
  try {
    const answers = req.body.answers;

    if (!Array.isArray(answers) || answers.length !== quizQuestions.length) {
      return res.status(400).json({ success: false, message: 'Please answer all 20 questions before submitting.' });
    }

    const validAnswers = answers.every((answer) => Number.isInteger(answer) && answer >= 0 && answer <= 3);

    if (!validAnswers) {
      return res.status(400).json({ success: false, message: 'Invalid answer data. Please refresh and try again.' });
    }

    const dbUser = await getUserByDiscordId(req.user.id);

    if (!dbUser || !dbUser.roblox_username) {
      return res.status(400).json({ success: false, message: 'Please save your Roblox username before submitting.' });
    }

    const score = calculateScore(answers, quizQuestions);

    await saveSubmission(req.user.id, req.user.username, dbUser.roblox_username, answers, {
      score,
      totalQuestions: quizQuestions.length,
      status: 'completed',
      rulesAcceptedAt: getRulesAcceptedAt(req)
    });

    console.log(`Quiz submitted by ${req.user.username} with score ${score}/${quizQuestions.length}`);

    try {
      await sendCompletedDm(req.user.id, req.user.username, score, quizQuestions.length, dbUser.roblox_username);
    } catch (dmError) {
      console.error('Completed quiz DM failed but submission will continue:', dmError);
    }

    // Never send score to frontend. Only admins can view scores.
    return res.json({ success: true, redirectTo: '/credits' });
  } catch (error) {
    if (error.code === 'ALREADY_SUBMITTED' || error.message === 'ALREADY_SUBMITTED') {
      return res.json({ success: true, redirectTo: '/credits' });
    }

    console.error('POST /quiz/submit failed:', error);
    return res.status(500).json({ success: false, message: 'We could not save your submission right now. Please try again later.' });
  }
});

// POST /quiz/cheated
// Instantly locks a user with score 0/20 if tab/window switching is detected.
app.post('/quiz/cheated', requireAuth, requireRulesAccepted, requireEventActive, blockIfAlreadySubmitted, async (req, res) => {
  try {
    const answers = sanitizePartialAnswers(req.body.answers);
    const dbUser = await getUserByDiscordId(req.user.id);

    if (!dbUser || !dbUser.roblox_username) {
      return res.status(400).json({ success: false, message: 'Roblox username is missing.' });
    }

    await saveSubmission(req.user.id, req.user.username, dbUser.roblox_username, answers, {
      score: 0,
      totalQuestions: quizQuestions.length,
      status: 'cheated',
      rulesAcceptedAt: getRulesAcceptedAt(req)
    });

    console.log(`Tab-switch cheat detected for ${req.user.username}`);

    try {
      await sendCheatedDm(req.user.id, req.user.username);
    } catch (dmError) {
      console.error('Cheated quiz DM failed but submission will continue:', dmError);
    }

    return res.json({ success: true, redirectTo: '/credits' });
  } catch (error) {
    if (error.code === 'ALREADY_SUBMITTED' || error.message === 'ALREADY_SUBMITTED') {
      return res.json({ success: true, redirectTo: '/credits' });
    }

    console.error('POST /quiz/cheated failed:', error);
    return res.status(500).json({ success: false, message: 'We could not lock your submission right now.' });
  }
});

// GET /credits
// Cinematic credits scene after normal or cheated submission.
app.get('/credits', requireAuth, requireRulesAccepted, async (req, res) => {
  res.render('credits', {
    pageTitle: 'Credits | Reze Blox YT'
  });
});

// GET /submitted
// Shows real submission info if it exists. Scores stay hidden from users.
app.get('/submitted', requireAuth, requireRulesAccepted, async (req, res) => {
  try {
    const submission = await getSubmissionByDiscordId(req.user.id);

    res.render('submitted', {
      pageTitle: 'Submitted | Reze Blox YT',
      submission,
      formattedSubmittedAt: submission ? formatDate(submission.submitted_at) : null
    });
  } catch (error) {
    console.error('GET /submitted failed:', error);
    return renderFriendlyError(res, 'We could not load your submission status right now. Please try again later.');
  }
});

// GET /admin
// Protected admin dashboard with real Supabase submissions, scores, and event status.
app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const submissions = await getAllSubmissions();
    const eventStatus = await getEventStatus();
    const scoredSubmissions = submissions.filter((submission) => Number.isFinite(Number(submission.score)));
    const averageScore = scoredSubmissions.length
      ? (scoredSubmissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) / scoredSubmissions.length).toFixed(1)
      : '0.0';

    const stats = {
      totalSubmissions: submissions.length,
      todaysSubmissions: submissions.filter((submission) => isToday(submission.submitted_at)).length,
      uniqueDiscordUsers: new Set(submissions.map((submission) => submission.discord_id)).size,
      averageScore
    };

    res.render('admin', {
      pageTitle: 'Admin Dashboard | Reze Blox YT',
      submissions,
      stats,
      eventStatus,
      formatDate
    });
  } catch (error) {
    console.error('GET /admin failed:', error);
    return renderFriendlyError(res, 'Admin data could not be loaded right now. Please check Supabase settings and try again.');
  }
});

// POST /admin/event/start
// Admin-only route to open the event.
app.post('/admin/event/start', requireAdmin, verifyAdminAction, checkAdminReferer, async (req, res) => {
  try {
    await setEventStatus('active');
    console.log(`Event started by admin ${req.user.username}`);
    return res.redirect('/admin');
  } catch (error) {
    console.error('POST /admin/event/start failed:', error);
    return renderFriendlyError(res, 'Could not start the event right now. Please try again later.');
  }
});

// POST /admin/event/stop
// Admin-only route to close the event.
app.post('/admin/event/stop', requireAdmin, verifyAdminAction, checkAdminReferer, async (req, res) => {
  try {
    await setEventStatus('finished');
    console.log(`Event stopped by admin ${req.user.username}`);
    return res.redirect('/admin');
  } catch (error) {
    console.error('POST /admin/event/stop failed:', error);
    return renderFriendlyError(res, 'Could not stop the event right now. Please try again later.');
  }
});

// POST /admin/event/restart
// Admin-only route to set the event back to NOT STARTED. Optionally clears submissions.
app.post('/admin/event/restart', requireAdmin, verifyAdminAction, checkAdminReferer, async (req, res) => {
  try {
    await resetEventStatus();

    if (req.body.clearSubmissions === 'true') {
      await clearAllSubmissions();
      console.log(`Event restarted to NOT STARTED and submissions cleared by admin ${req.user.username}`);
    } else {
      console.log(`Event restarted to NOT STARTED by admin ${req.user.username}`);
    }

    return res.redirect('/admin');
  } catch (error) {
    console.error('POST /admin/event/restart failed:', error);
    return renderFriendlyError(res, 'Could not restart the event right now. Please try again later.');
  }
});

// POST /admin/submissions/clear
// Admin-only dangerous route to delete every submission.
app.post('/admin/submissions/clear', requireAdmin, verifyAdminAction, checkAdminReferer, async (req, res) => {
  try {
    await clearAllSubmissions();
    console.log(`All submissions cleared by admin ${req.user.username}`);
    return res.redirect('/admin');
  } catch (error) {
    console.error('POST /admin/submissions/clear failed:', error);
    return renderFriendlyError(res, 'Could not clear submissions right now. Please try again later.');
  }
});

// GET /admin/export.csv
// Admin-only real CSV export from Supabase data.
app.get('/admin/export.csv', requireAdmin, async (req, res) => {
  try {
    const submissions = await getAllSubmissions();
    const rows = [
      ['Discord Username', 'Discord ID', 'Roblox Username', 'Score', 'Status', 'Submitted At', 'Rules Accepted At', 'Answers'],
      ...submissions.map((submission) => [
        submission.discord_username,
        submission.discord_id,
        submission.roblox_username,
        `${submission.score || 0}/${submission.total_questions || quizQuestions.length}`,
        submission.status || 'completed',
        submission.submitted_at,
        submission.rules_accepted_at || '',
        Array.isArray(submission.answers) ? submission.answers.join(',') : JSON.stringify(submission.answers || [])
      ])
    ];

    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reze-submissions.csv"');
    return res.send(csv);
  } catch (error) {
    console.error('GET /admin/export.csv failed:', error);
    return renderFriendlyError(res, 'Could not export CSV right now. Please try again later.');
  }
});

// Mention the Supabase client so beginners know where it is configured.
if (!supabase) {
  console.warn('The app can start without Supabase, but database routes will show friendly errors until .env is configured.');
}

// 404 fallback page. This must stay after all other routes.
app.use((req, res) => {
  res.status(404).render('404', {
    pageTitle: '404 | Reze Blox YT'
  });
});

// Start the server. Render will provide process.env.PORT automatically.
app.listen(PORT, () => {
  console.log(`Reze Blox YT quiz app running on port ${PORT}`);
});
