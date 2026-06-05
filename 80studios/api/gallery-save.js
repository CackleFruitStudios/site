function requireEnv(name) {

  const value =
    process.env[name];

  if (!value) {

    throw new Error(
      `Missing environment variable: ${name}`
    );
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
          "Authorization": `Bearer ${apiToken}`,
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

  return data;
}

export default async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    const gallery =
      req.body;

    if (!gallery || !gallery.id) {

      return res.status(400).json({
        success: false,
        error: "Missing gallery data"
      });
    }

    await runD1Query(
      `
      INSERT OR REPLACE INTO galleries (
        id,
        project_id,
        folder_id,
        title,
        slug,
        path,
        owner_id,
        created_by,
        visibility,
        share_token,
        location_name,
        town,
        state,
        country,
        notes,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        gallery.id,
        gallery.projectId || "",
        gallery.folderId || null,
        gallery.title || gallery.id,
        gallery.slug || gallery.id,
        gallery.path || "",
        gallery.ownerId || "andrew-devlin",
        gallery.createdBy || gallery.ownerId || "andrew-devlin",
        gallery.visibility || "private",
        gallery.shareToken || null,
        gallery.library?.locationName || gallery.title || "",
        gallery.library?.town || "",
        gallery.library?.state || "",
        gallery.library?.country || "USA",
        gallery.admin?.notes || ""
      ]
    );

    const images =
      gallery.images || [];

    for (let index = 0; index < images.length; index++) {

      const image =
        images[index];

      await runD1Query(
        `
        INSERT OR REPLACE INTO images (
          id,
          gallery_id,
          asset_id,
          filename,
          url,
          content_type,
          caption,
          tags_json,
          source,
          sort_order,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          image.assetId || `${gallery.id}-image-${index}`,
          gallery.id,
          image.assetId || "",
          image.filename || "",
          image.url || "",
          image.contentType || "",
          image.caption || "",
          JSON.stringify(image.tags || []),
          image.source || "r2",
          index
        ]
      );
    }

    return res.status(200).json({
      success: true,
      message: "Gallery saved to D1",
      galleryId: gallery.id,
      imageCount: images.length
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
