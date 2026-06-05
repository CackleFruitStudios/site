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

    const projects =
      await runD1Query(`
        SELECT
          id,
          title,
          slug,
          description,
          status,
          created_by AS createdBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM projects
        ORDER BY created_at DESC
      `);

    res.status(200).json({
      success: true,
      projects
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
