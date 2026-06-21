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
    const body = req.body || {};

    const folderId = body.folderId || body.id || "";
    const projectId = body.projectId || body.project_id || "";

    if (!folderId || !projectId) {
      return res.status(400).json({
        success: false,
        error: "Missing folderId or projectId"
      });
    }

    const childFolders = await runD1Query(
      `
      SELECT id
      FROM folders
      WHERE project_id = ?
        AND parent_folder_id = ?
      LIMIT 1
      `,
      [projectId, folderId]
    );

    if (childFolders.length) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete folder because it contains child folders."
      });
    }

    const galleries = await runD1Query(
      `
      SELECT id
      FROM galleries
      WHERE project_id = ?
        AND folder_id = ?
      LIMIT 1
      `,
      [projectId, folderId]
    );

    if (galleries.length) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete folder because it contains galleries."
      });
    }

    await runD1Query(
      `
      DELETE FROM folders
      WHERE id = ?
        AND project_id = ?
      `,
      [folderId, projectId]
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
