const { neon } = require('@neondatabase/serverless');

/**
 * GET /api/load?id=<uuid>
 * → { data: object }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id クエリパラメータが必要です' });

  try {
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT data FROM manuals WHERE id = ${id}
    `;

    if (!rows.length) {
      return res.status(404).json({ error: '指定されたマニュアルが見つかりません' });
    }

    return res.status(200).json({ data: rows[0].data });
  } catch (err) {
    console.error('[api/load]', err);
    return res.status(500).json({ error: err.message });
  }
};
