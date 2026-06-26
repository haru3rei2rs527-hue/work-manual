const { neon } = require('@neondatabase/serverless');

/**
 * POST /api/migrate
 * テーブルが存在しない場合に作成する（初回デプロイ時に1度だけ呼ぶ）
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS manuals (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL DEFAULT '無題',
        author      TEXT DEFAULT '',
        date_label  TEXT DEFAULT '',
        data        JSONB NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    return res.status(200).json({ ok: true, message: 'manuals テーブルを確認・作成しました' });
  } catch (err) {
    console.error('[api/migrate]', err);
    return res.status(500).json({ error: err.message });
  }
};
