const { neon } = require('@neondatabase/serverless');

/**
 * DELETE /api/delete
 * body: { id: string }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id が必要です' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`DELETE FROM manuals WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/delete]', err);
    return res.status(500).json({ error: err.message });
  }
};
