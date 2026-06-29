// config/passport.js
// ------------------------------------------------------------
// Passport configuration for Discord OAuth2 login.
// Phase 2 uses Discord login only. Database storage comes later.
// ------------------------------------------------------------

const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

// Discord OAuth only needs the "identify" scope for this project.
// That gives us the user's Discord ID and username.
const discordScopes = ['identify'];

// These values must come from .env. Never put real secrets in code.
const hasDiscordConfig =
  process.env.DISCORD_CLIENT_ID &&
  process.env.DISCORD_CLIENT_SECRET &&
  process.env.DISCORD_CALLBACK_URL;

if (hasDiscordConfig) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL,
        scope: discordScopes
      },
      (accessToken, refreshToken, profile, done) => {
        // Phase 2: store the full Discord profile in the session.
        // Phase 3: use profile.id to find or create a user in Supabase.
        return done(null, profile);
      }
    )
  );
} else {
  console.warn(
    'Discord OAuth is not fully configured. Add DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_CALLBACK_URL to .env.'
  );
}

// Save the logged-in Discord user object into the session.
passport.serializeUser((user, done) => {
  done(null, user);
});

// Read the logged-in Discord user object back out of the session.
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;
