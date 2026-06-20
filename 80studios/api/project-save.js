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
    const project = req.body || {};

    const projectId = project.id || "";
    const createdBy = project.createdBy || project.created_by || "andrew-devlin";

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "Missing project id"
      });
    }

    await runD1Query(
      `
      INSERT INTO projects (
        id,
        title,
        slug,
        description,
        status,
        created_by,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        slug = excluded.slug,
        description = excluded.description,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        projectId,
        project.title || project.name || projectId,
        project.slug || projectId,
        project.description || "",
        project.status || "active",
        createdBy
      ]
    );

    await runD1Query(
      `
      INSERT OR IGNORE INTO project_members (
        project_id,
        user_id,
        project_role
      )
      VALUES (?, ?, ?)
      `,
      [
        projectId,
        createdBy,
        project.projectRole || project.project_role || "lm"
      ]
    );

    return res.status(200).json({
      success: true,
      projectId
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
