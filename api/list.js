const { list } = require('@vercel/blob');

/**
 * GET /api/list
 * → { manuals: [{ id, url, uploadedAt, size }] }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { blobs } = await list({ prefix: 'manuals/' });

    const manuals = blobs
      .map(b => ({
        id: b.pathname.replace('manuals/', '').replace('.json', ''),
        url: b.url,
        uploadedAt: b.uploadedAt,
        size: b.size,
      }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.status(200).json({ manuals });
  } catch (err) {
    console.error('[api/list]', err);
    return res.status(500).json({ error: err.message });
  }
};
