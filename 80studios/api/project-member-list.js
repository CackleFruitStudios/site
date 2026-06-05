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
    const members = await runD1Query(`
      SELECT
        id,
        project_id AS projectId,
        user_id AS userId,
        project_role AS projectRole,
        active,
        invited_by AS invitedBy,
        joined_at AS joinedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM project_members
      WHERE active = 1
      ORDER BY created_at DESC
    `);

    return res.status(200).json({
      success: true,
      members
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
