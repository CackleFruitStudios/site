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

async function makeUniqueSlug(projectId, parentFolderId, baseSlug, folderId) {
  let slug = baseSlug || folderId;
  let counter = 2;

  while (true) {
    const existing = await runD1Query(
      `
      SELECT id
      FROM folders
      WHERE project_id = ?
        AND slug = ?
        AND (
          (? IS NULL AND parent_folder_id IS NULL)
          OR parent_folder_id = ?
        )
        AND id != ?
      LIMIT 1
      `,
      [projectId, slug, parentFolderId, parentFolderId, folderId]
    );

    if (!existing.length) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function deleteEmptyFolder(projectId, folderId) {
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
    return {
      success: false,
      status: 400,
      error: "Cannot delete folder because it contains child folders."
    };
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
    return {
      success: false,
      status: 400,
      error: "Cannot delete folder because it contains galleries."
    };
  }

  await runD1Query(
    `
    DELETE FROM folders
    WHERE id = ?
      AND project_id = ?
    `,
    [folderId, projectId]
  );

  return {
    success: true,
    folderId
  };
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

    const action =
      folder.action || "";

    const projectId =
      folder.projectId || folder.project_id || "";

    const folderId =
      folder.folderId || folder.id || "";

    if (action === "delete") {
      if (!folderId || !projectId) {
        return res.status(400).json({
          success: false,
          error: "Missing folderId or projectId"
        });
      }

      const result =
        await deleteEmptyFolder(projectId, folderId);

      if (!result.success) {
        return res.status(result.status || 400).json({
          success: false,
          error: result.error
        });
      }

      return res.status(200).json(result);
    }

    const parentFolderId =
      folder.parentFolderId || folder.parent_folder_id || null;

    const title =
      folder.title || folder.name || folderId;

    const baseSlug =
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

    const slug =
      await makeUniqueSlug(projectId, parentFolderId, baseSlug, folderId);

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
      folderId,
      slug
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
