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

    const folderId =
      folder.id || "";

    const projectId =
      folder.projectId || folder.project_id || "";

    const parentFolderId =
      folder.parentFolderId || folder.parent_folder_id || null;

    const title =
      folder.title || folder.name || folderId;

    const slug =
      folder.slug || folderId;

    const folderType =
      folder.folderType || folder.folder_type || "location";

    const sortOrder =
      Number(folder.sortOrder || folder.sort_order || 0);

    const createdBy =
      folder.createdBy || folder.created_by || "andrew-devlin";

    if (!folderId || !projectId) {
      return res.status(400).json({
        success: false,
        error: "Missing folder id or projectId"
      });
    }

    await runD1Query(
      `
      INSERT INTO folders (
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
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        parent_folder_id = excluded.parent_folder_id,
        title = excluded.title,
        slug = excluded.slug,
        folder_type = excluded.folder_type,
        sort_order = excluded.sort_order,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        folderId,
        projectId,
        parentFolderId,
        title,
        slug,
        folderType,
        sortOrder,
        createdBy
      ]
    );

    return res.status(200).json({
      success: true,
      folderId
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
