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

    const {
      email,
      passwordHash
    } = req.body;

    const users =
      await runD1Query(
        `
        SELECT
          id,
          name,
          email,
          global_role AS globalRole,
          password_hash AS passwordHash
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
        [email]
      );

    const user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    if (user.passwordHash !== passwordHash) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole
      }
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
