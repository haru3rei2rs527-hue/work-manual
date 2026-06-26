const { del } = require('@vercel/blob');

/**
 * DELETE /api/delete
 * body: { url: string }  (Vercel Blob の公開URL)
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });

    await del(url);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/delete]', err);
    return res.status(500).json({ error: err.message });
  }
};
