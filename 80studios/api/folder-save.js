function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function folderIdExists(folderId) {
  const rows = await runD1Query(
    `
    SELECT id
    FROM folders
    WHERE id = ?
    LIMIT 1
    `,
    [folderId]
  );

  return rows.length > 0;
}

async function folderSlugExists(projectId, parentFolderId, slug) {
  const rows = await runD1Query(
    `
    SELECT id
    FROM folders
    WHERE project_id = ?
      AND (
        (? IS NULL AND parent_folder_id IS NULL)
        OR parent_folder_id = ?
      )
      AND slug = ?
    LIMIT 1
    `,
    [projectId, parentFolderId, parentFolderId, slug]
  );

  return rows.length > 0;
}

async function createUniqueFolderId(baseId) {
  let candidate = baseId;
  let counter = 2;

  while (await folderIdExists(candidate)) {
    candidate = `${baseId}-${counter}`;
    counter += 1;
  }

  return candidate;
}

async function createUniqueFolderSlug(projectId, parentFolderId, baseSlug) {
  let candidate = baseSlug;
  let counter = 2;

  while (await folderSlugExists(projectId, parentFolderId, candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
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

    const projectId =
      folder.projectId || folder.project_id || "";

    const parentFolderId =
      folder.parentFolderId || folder.parent_folder_id || null;

    const title =
      folder.title || folder.name || folder.id || "Untitled Folder";

    const baseSlug =
      slugify(folder.slug || title) || "folder";

    const baseFolderId =
      slugify(folder.id || baseSlug) || "folder";

    const folderId =
      await createUniqueFolderId(baseFolderId);

    const slug =
      await createUniqueFolderSlug(projectId, parentFolderId, baseSlug);

    const folderType =
      folder.folderType || folder.folder_type || "location";

    const sortOrder =
      Number(folder.sortOrder || folder.sort_order || 0);

    const createdBy =
      folder.createdBy || folder.created_by || "andrew-devlin";

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "Missing projectId"
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
