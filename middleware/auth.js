// middleware/auth.js
// ------------------------------------------------------------
// Authentication helper middleware.
// These functions keep route protection organized and beginner-friendly.
// ------------------------------------------------------------

const { getEventStatus, hasSubmitted } = require('../services/db');

const allowedAdminUsernames = ['chill_guy_rblx', 'rishi_24_3_08', 'ue_vegito'];

function isApprovedAdmin(user) {
  const username = user && user.username;
  return allowedAdminUsernames.includes(username);
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
  // Discord's newer username system uses profile.username without discriminator.
  if (req.isAuthenticated && req.isAuthenticated() && isApprovedAdmin(req.user)) {
    return next();
  }

  return res.status(404).render('404', {
    pageTitle: '404 | Reze Blox YT'
  });
}

function requireRulesAccepted(req, res, next) {
  // Admins can bypass the rules gate for testing.
  if (req.isAuthenticated && req.isAuthenticated() && isApprovedAdmin(req.user)) {
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
    if (req.isAuthenticated && req.isAuthenticated() && isApprovedAdmin(req.user)) {
      return next();
    }

    const eventStatus = await getEventStatus();

    if (eventStatus.is_active) {
      return next();
    }

    return res.status(403).render('event-inactive', {
      pageTitle: 'Event Not Active | Reze Blox YT',
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
  res.locals.user = req.user || null;
  res.locals.isAdmin = isApprovedAdmin(req.user);
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireRulesAccepted,
  requireEventActive,
  blockIfAlreadySubmitted,
  attachUser,
  isApprovedAdmin
};
