function requireEnv(name) {

  const value =
    process.env[name];

  if (!value) {

    throw new Error(
      `Missing environment variable: ${name}`
    );
  }

  return value;
}

async function runD1Query(sql, params = []) {

  const accountId =
    requireEnv("CLOUDFLARE_ACCOUNT_ID");

  const databaseId =
    requireEnv("D1_DATABASE_ID");

  const apiToken =
    requireEnv("CLOUDFLARE_API_TOKEN");

  const response =
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sql,
          params
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok || !data.success) {

    throw new Error(
      JSON.stringify(data)
    );
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

    const galleries =
      await runD1Query(
        `
        SELECT
          galleries.id,
          galleries.title,
          galleries.project_id AS projectId,
          galleries.folder_id AS folderId,
          galleries.owner_id AS ownerId,
          galleries.created_by AS createdBy,
          galleries.visibility,
          galleries.share_token AS shareToken,
          galleries.location_name AS locationName,
          galleries.town,
          galleries.state,
          galleries.country,
          galleries.notes,
          galleries.cover,
          galleries.created_at AS createdAt,
          COUNT(images.id) AS imageCount
        FROM galleries
        LEFT JOIN images
          ON images.gallery_id = galleries.id
        GROUP BY galleries.id
        ORDER BY galleries.created_at DESC
        `
      );

    return res.status(200).json({
      success: true,
      galleries
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
