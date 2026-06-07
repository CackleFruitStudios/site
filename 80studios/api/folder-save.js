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
      body: JSON.stringify({ sql, params })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(JSON.stringify(data));
  }

  return data.result?.[0]?.results || [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const folder = req.body || {};

    if (!folder.id || !folder.projectId) {
      return res.status(400).json({
        success: false,
        error: "Missing folder id or projectId"
      });
    }

    await runD1Query(
      `
      INSERT OR IGNORE INTO folders (
        id,
        project_id,
        parent_folder_id,
        title,
        slug,
        folder_type,
        sort_order,
        created_by,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        folder.id,
        folder.projectId,
        folder.parentFolderId || null,
        folder.title || folder.id,
        folder.slug || folder.id,
        folder.folderType || "location",
        folder.sortOrder || 0,
        folder.createdBy || "andrew-devlin"
      ]
    );

    return res.status(200).json({
      success: true,
      folderId: folder.id
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
