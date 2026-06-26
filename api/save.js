const { neon } = require('@neondatabase/serverless');

/**
 * POST /api/save
 * body: { id?: string, data: object }
 * → { id }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const body = req.body || {};
    const data = body.data ?? body;
    const id = body.id || crypto.randomUUID();

    const title     = (data.header?.title  || '無題').slice(0, 200);
    const author    = (data.header?.author || '').slice(0, 100);
    const dateLabel = (data.header?.date   || '').slice(0, 50);

    await sql`
      INSERT INTO manuals (id, title, author, date_label, data)
      VALUES (${id}, ${title}, ${author}, ${dateLabel}, ${JSON.stringify(data)})
      ON CONFLICT (id) DO UPDATE SET
        title      = EXCLUDED.title,
        author     = EXCLUDED.author,
        date_label = EXCLUDED.date_label,
        data       = EXCLUDED.data,
        updated_at = NOW()
    `;

    return res.status(200).json({ id });
  } catch (err) {
    console.error('[api/save]', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};
