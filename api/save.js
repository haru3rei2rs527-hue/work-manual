const { put } = require('@vercel/blob');

/**
 * POST /api/save
 * body: { id?: string, data: object }
 * → { id, url }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const id = body.id || crypto.randomUUID();
    const payload = JSON.stringify(body.data ?? body);

    const blob = await put(`manuals/${id}.json`, payload, {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    return res.status(200).json({ id, url: blob.url });
  } catch (err) {
    console.error('[api/save]', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};
