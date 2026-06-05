// /api/folder-list.js

function requireEnv(name) {

  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
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
          Authorization: `Bearer ${apiToken}`,
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

  try {

    const { projectId } = req.query;

    if (!projectId) {

      return res.status(400).json({
        success: false,
        error: "projectId is required"
      });
    }

    const folders =
      await runD1Query(
        `
        SELECT
          id,
          project_id AS projectId,
          name,
          description,
          sort_order AS sortOrder,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM folders
        WHERE project_id = ?
        ORDER BY
          sort_order ASC,
          name ASC
        `,
        [projectId]
      );

    res.status(200).json({
      success: true,
      folders
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
