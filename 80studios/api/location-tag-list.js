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
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const galleryId = req.query.galleryId || "";

    let sql = `
      SELECT
        id,
        gallery_id AS galleryId,
        tag,
        created_at AS createdAt
      FROM location_tags
    `;

    const params = [];

    if (galleryId) {
      sql += `
        WHERE gallery_id = ?
      `;

      params.push(galleryId);
    }

    sql += `
      ORDER BY tag ASC
    `;

    const tags =
      await runD1Query(sql, params);

    return res.status(200).json({
      success: true,
      tags
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
