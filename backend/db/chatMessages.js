/**
 * The persisted AI advisor conversation, so the chat survives a page refresh.
 * Replaces models/ChatMessage.js.
 */

const { query } = require('./pool');
const { toApiList } = require('./rows');

/** Oldest first - the order the chat is rendered and replayed to the model. */
const listForUser = async (userId, limit = 100) => {
  const rows = await query(
    `SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at, id LIMIT $2`,
    [userId, limit]
  );
  return toApiList(rows);
};

/**
 * The most recent `limit` messages, back in chronological order. Used to give
 * the model context without replaying an entire history.
 */
const recentForUser = async (userId, limit = 20) => {
  const rows = await query(
    `SELECT * FROM (
       SELECT * FROM chat_messages WHERE user_id = $1
        ORDER BY created_at DESC, id DESC LIMIT $2
     ) recent ORDER BY created_at, id`,
    [userId, limit]
  );
  return toApiList(rows);
};

/** Appends a turn of the conversation. */
const addMany = async (userId, messages) => {
  if (!messages.length) return [];

  const values = [userId];
  const tuples = messages.map((m, i) => {
    values.push(m.role, m.content);
    return `($1, $${2 + i * 2}, $${3 + i * 2})`;
  });

  const rows = await query(
    `INSERT INTO chat_messages (user_id, role, content) VALUES ${tuples.join(', ')} RETURNING *`,
    values
  );
  return toApiList(rows);
};

const clear = async (userId) => {
  await query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId]);
};

module.exports = { listForUser, recentForUser, addMany, clear };
