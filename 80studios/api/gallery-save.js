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

  return data;
}

function getImageUrl(image) {
  return image.displayUrl || image.display_url || image.url || "";
}

function getThumbnailUrl(image) {
  return (
    image.thumbnailUrl ||
    image.thumbnail_url ||
    image.displayUrl ||
    image.display_url ||
    image.url ||
    ""
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const gallery = req.body;

    if (!gallery || !gallery.id) {
      return res.status(400).json({
        success: false,
        error: "Missing gallery data"
      });
    }

    const images = Array.isArray(gallery.images)
      ? gallery.images
      : [];

    const cover =
      gallery.cover ||
      getThumbnailUrl(images[0] || {}) ||
      getImageUrl(images[0] || "") ||
      "";

    await runD1Query(
      `
      INSERT INTO galleries (
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
        cover,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        folder_id = excluded.folder_id,
        title = excluded.title,
        slug = excluded.slug,
        path = excluded.path,
        owner_id = excluded.owner_id,
        created_by = excluded.created_by,
        visibility = excluded.visibility,
        share_token = excluded.share_token,
        location_name = excluded.location_name,
        town = excluded.town,
        state = excluded.state,
        country = excluded.country,
        notes = excluded.notes,
        cover = excluded.cover,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        gallery.id,
        gallery.projectId || gallery.project_id || "",
        gallery.folderId || gallery.folder_id || null,
        gallery.title || gallery.name || gallery.id,
        gallery.slug || gallery.id,
        gallery.path || "",
        gallery.ownerId || gallery.owner_id || "andrew-devlin",
        gallery.createdBy || gallery.created_by || gallery.ownerId || "andrew-devlin",
        gallery.visibility || "private",
        gallery.shareToken || gallery.share_token || null,
        gallery.library?.locationName || gallery.locationName || gallery.title || "",
        gallery.library?.town || gallery.town || "",
        gallery.library?.state || gallery.state || "",
        gallery.library?.country || gallery.country || "USA",
        gallery.admin?.notes || gallery.notes || "",
        cover
      ]
    );

    await runD1Query(
      `
      DELETE FROM images
      WHERE gallery_id = ?
      `,
      [gallery.id]
    );

    for (let index = 0; index < images.length; index++) {
      const image = images[index];

      const assetId =
        image.assetId ||
        image.asset_id ||
        `${gallery.id}-image-${index}`;

      await runD1Query(
        `
        INSERT INTO images (
          id,
          gallery_id,
          asset_id,
          filename,
          url,
          display_url,
          thumbnail_url,
          content_type,
          caption,
          tags_json,
          source,
          sort_order,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          assetId,
          gallery.id,
          assetId,
          image.filename || "",
          image.url || getImageUrl(image),
          getImageUrl(image),
          getThumbnailUrl(image),
          image.contentType || image.content_type || "",
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
      imageCount: images.length,
      cover
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
