// services/db.js
// ------------------------------------------------------------
// Clean database service layer for Supabase.
// Routes call these functions instead of writing Supabase queries
// directly inside server.js. This keeps the project beginner-friendly.
// ------------------------------------------------------------

const supabase = require('../config/supabase');

function ensureSupabase() {
  if (!supabase) {
    const error = new Error('Supabase is not configured. Please check SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  }
}

function markAlreadySubmittedError() {
  const error = new Error('ALREADY_SUBMITTED');
  error.code = 'ALREADY_SUBMITTED';
  return error;
}

function calculateScore(answers, questions) {
  if (!Array.isArray(answers) || !Array.isArray(questions)) return 0;

  return questions.reduce((score, question, index) => {
    return answers[index] === question.correctAnswer ? score + 1 : score;
  }, 0);
}

async function getOrCreateUser(discordId, discordUsername) {
  try {
    ensureSupabase();

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          discord_id: discordId,
          discord_username: discordUsername
        },
        {
          onConflict: 'discord_id'
        }
      )
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw error;
  }
}

async function saveRobloxUsername(discordId, robloxUsername) {
  try {
    ensureSupabase();

    const { data, error } = await supabase
      .from('users')
      .update({ roblox_username: robloxUsername })
      .eq('discord_id', discordId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Database error in saveRobloxUsername:', error);
    throw error;
  }
}

async function getUserByDiscordId(discordId) {
  try {
    ensureSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Database error in getUserByDiscordId:', error);
    throw error;
  }
}

async function hasSubmitted(discordId) {
  try {
    ensureSupabase();

    const { data, error } = await supabase
      .from('submissions')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    console.error('Database error in hasSubmitted:', error);
    throw error;
  }
}

async function getSubmissionByDiscordId(discordId) {
  try {
    ensureSupabase();

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Database error in getSubmissionByDiscordId:', error);
    throw error;
  }
}

async function saveSubmission(discordId, discordUsername, robloxUsername, answers, options = {}) {
  try {
    ensureSupabase();

    const alreadySubmitted = await hasSubmitted(discordId);
    if (alreadySubmitted) {
      throw markAlreadySubmittedError();
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        discord_id: discordId,
        discord_username: discordUsername,
        roblox_username: robloxUsername,
        answers,
        score: options.score || 0,
        total_questions: options.totalQuestions || 20,
        status: options.status || 'completed',
        rules_accepted_at: options.rulesAcceptedAt || null
      })
      .select('*')
      .single();

    // PostgreSQL unique violation. This is a backup protection for race conditions.
    if (error && error.code === '23505') {
      throw markAlreadySubmittedError();
    }

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Database error in saveSubmission:', error);
    throw error;
  }
}

async function getAllSubmissions() {
  try {
    ensureSupabase();

    const { data, error } = await supabase
      .from('submissions')
      .select('id, discord_id, discord_username, roblox_username, answers, submitted_at, score, total_questions, status, rules_accepted_at')
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Database error in getAllSubmissions:', error);
    throw error;
  }
}

async function clearAllSubmissions() {
  try {
    ensureSupabase();

    const { error } = await supabase
      .from('submissions')
      .delete()
      .not('id', 'is', null);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Database error in clearAllSubmissions:', error);
    throw error;
  }
}

async function getEventStatus() {
  try {
    ensureSupabase();

    const { data, error } = await supabase
      .from('event_status')
      .select('state, is_active, updated_at')
      .eq('id', 1)
      .single();

    if (error) throw error;

    const state = data.state || (data.is_active ? 'active' : 'not_started');

    return {
      state,
      is_active: state === 'active',
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('Database error in getEventStatus:', error);
    throw error;
  }
}

async function setEventStatus(state) {
  try {
    ensureSupabase();

    const validStates = ['not_started', 'active', 'finished'];

    if (!validStates.includes(state)) {
      throw new Error(`Invalid event status state: ${state}`);
    }

    const { data, error } = await supabase
      .from('event_status')
      .upsert(
        {
          id: 1,
          state,
          is_active: state === 'active',
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'id'
        }
      )
      .select('state, is_active, updated_at')
      .single();

    if (error) throw error;

    return {
      state: data.state,
      is_active: data.state === 'active',
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('Database error in setEventStatus:', error);
    throw error;
  }
}

async function resetEventStatus() {
  return setEventStatus('not_started');
}

module.exports = {
  calculateScore,
  getOrCreateUser,
  saveRobloxUsername,
  getUserByDiscordId,
  hasSubmitted,
  getSubmissionByDiscordId,
  saveSubmission,
  getAllSubmissions,
  clearAllSubmissions,
  getEventStatus,
  setEventStatus,
  resetEventStatus
};
