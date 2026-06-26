const { neon } = require('@neondatabase/serverless');

/**
 * GET /api/list
 * → { manuals: [{ id, title, author, date_label, updated_at }] }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT id, title, author, date_label, created_at, updated_at
      FROM manuals
      ORDER BY updated_at DESC
      LIMIT 100
    `;

    return res.status(200).json({ manuals: rows });
  } catch (err) {
    console.error('[api/list]', err);
    return res.status(500).json({ error: err.message });
  }
};
