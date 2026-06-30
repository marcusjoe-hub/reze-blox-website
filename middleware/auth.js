// middleware/auth.js
// ------------------------------------------------------------
// Authentication and security helper middleware.
// Admin authorization is based on Discord IDs only because usernames
// can change or be copied, but Discord IDs cannot be faked by users.
// ------------------------------------------------------------

const { getEventStatus, hasSubmitted } = require('../services/db');

const allowedAdminIds = [
  '1420438749984194600', // chill_guy_rblx
  '1481997331112001630', // rishi_24_3_08 (Reze)
  '1442846221910675516'  // ue_vegito
];

function isApprovedAdmin(user) {
  const discordId = user && user.id;
  return Boolean(discordId && allowedAdminIds.includes(discordId));
}

function logUnauthorizedAdminAttempt(req) {
  console.warn(`Unauthorized admin access attempt by user ID: ${req.user?.id} username: ${req.user?.username}`);
}

function requireAuth(req, res, next) {
  // Passport adds req.isAuthenticated() after passport.session() is enabled.
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  return res.redirect('/');
}

function requireAdmin(req, res, next) {
  // Hide the admin panel from anyone who is not an approved Discord admin.
  if (req.isAuthenticated && req.isAuthenticated() && req.user && isApprovedAdmin(req.user)) {
    return next();
  }

  logUnauthorizedAdminAttempt(req);

  return res.status(404).render('404', {
    pageTitle: '404 | Reze Blox YT'
  });
}

function verifyAdminAction(req, res, next) {
  // Extra server-side re-check for admin POST routes.
  // This is intentionally separate from requireAdmin so admin actions are protected twice.
  if (req.isAuthenticated && req.isAuthenticated() && req.user && isApprovedAdmin(req.user)) {
    return next();
  }

  logUnauthorizedAdminAttempt(req);

  return res.status(404).render('404', {
    pageTitle: '404 | Reze Blox YT'
  });
}

function checkAdminReferer(req, res, next) {
  const referer = req.get('Referer') || '';
  const host = req.get('Host') || '';

  if (!referer || !host || !referer.includes(host)) {
    console.warn(`Suspicious admin POST without matching referer: ${referer} from ${req.user?.id}`);
    return res.status(403).render('404', {
      pageTitle: '404 | Reze Blox YT'
    });
  }

  return next();
}

function requireRulesAccepted(req, res, next) {
  // Admins can bypass the rules gate for testing.
  if (req.isAuthenticated && req.isAuthenticated() && req.user && isApprovedAdmin(req.user)) {
    return next();
  }

  if (req.session && req.session.rulesAccepted) {
    return next();
  }

  return res.redirect('/rules');
}

async function requireEventActive(req, res, next) {
  try {
    // Admins can bypass the event lock so they can test pages before opening the event.
    if (req.isAuthenticated && req.isAuthenticated() && req.user && isApprovedAdmin(req.user)) {
      return next();
    }

    const eventStatus = await getEventStatus();

    if (eventStatus.state === 'active') {
      return next();
    }

    if (eventStatus.state === 'finished') {
      return res.status(403).render('event-finished', {
        pageTitle: 'Event Ended | Reze Blox YT',
        eventStatus
      });
    }

    return res.status(403).render('event-not-started', {
      pageTitle: 'Event Not Started | Reze Blox YT',
      eventStatus
    });
  } catch (error) {
    console.error('Event status check failed:', error);
    return res.status(500).render('event-inactive', {
      pageTitle: 'Event Unavailable | Reze Blox YT',
      eventStatus: null,
      errorMessage: 'We could not check the event status right now. Please try again later.'
    });
  }
}

async function blockIfAlreadySubmitted(req, res, next) {
  try {
    const discordId = req.user && req.user.id;

    if (!discordId) {
      return res.redirect('/');
    }

    const alreadySubmitted = await hasSubmitted(discordId);

    if (alreadySubmitted) {
      return res.redirect('/submitted');
    }

    return next();
  } catch (error) {
    console.error('Submission lock check failed:', error);
    return res.status(500).render('event-inactive', {
      pageTitle: 'Temporary Error | Reze Blox YT',
      eventStatus: null,
      errorMessage: 'We could not check your submission status right now. Please try again later.'
    });
  }
}

function attachUser(req, res, next) {
  // Makes the logged-in Discord user available in every EJS template as "user".
  // Admin status is calculated server-side from Discord ID only.
  res.locals.user = req.user || null;
  res.locals.isAdmin = isApprovedAdmin(req.user);
  next();
}

module.exports = {
  allowedAdminIds,
  requireAuth,
  requireAdmin,
  verifyAdminAction,
  checkAdminReferer,
  requireRulesAccepted,
  requireEventActive,
  blockIfAlreadySubmitted,
  attachUser,
  isApprovedAdmin
};
