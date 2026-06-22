function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function runD1Query(sql, params = []) {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const databaseId = requireEnv("D1_DATABASE_ID");
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sql,
        params
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(JSON.stringify(data));
  }

  return data.result?.[0]?.results || [];
}

export default async function handler(req, res) {
  try {
    const { galleryId } = req.query;

    if (!galleryId) {
      return res.status(400).json({
        success: false,
        error: "galleryId is required"
      });
    }

    const images = await runD1Query(
      `
        SELECT
          id,
          gallery_id AS galleryId,
          url,
          display_url AS displayUrl,
          thumbnail_url AS thumbnailUrl,
          filename,
          content_type AS contentType,
          caption,
          tags_json AS tagsJson,
          source,
          sort_order AS sortOrder,
          created_at AS createdAt
        FROM images
        WHERE gallery_id = ?
        ORDER BY
          sort_order ASC,
          created_at ASC
      `,
      [galleryId]
    );

    res.status(200).json({
      success: true,
      images
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
