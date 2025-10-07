// netlify/functions/save-project.js
const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const BRANCH = "main";
const BASE_PATH = "proyectos";

// Validar configuración crítica
if (!GITHUB_TOKEN) {
  console.error("❌ ERROR: GITHUB_TOKEN no está definido en las variables de entorno.");
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Obtiene el SHA de un archivo en GitHub (necesario para actualizarlo)
 */
async function getFileSha(path) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
      ref: BRANCH,
    });
    return data.sha;
  } catch (error) {
    if (error.status === 404) return null; // archivo no existe
    throw error; // otro error (permisos, red, etc.)
  }
}

/**
 * Manejador principal de Netlify Function
 */
exports.handler = async (event, context) => {
  // Solo aceptar POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Método no permitido. Usa POST." })
    };
  }

  try {
    // Parsear cuerpo
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Cuerpo inválido: debe ser JSON válido." })
      };
    }

    const { name, description = "", imageData, annotations = [] } = body;

    // Validar nombre
    if (!name || typeof name !== "string" || name.trim() === "") {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "El nombre del proyecto es obligatorio y debe ser texto." })
      };
    }

    // Sanitizar nombre para usarlo en rutas
    const safeName = name.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s_-]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();

    if (safeName === "") {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "El nombre del proyecto no es válido después de sanitizar." })
      };
    }

    const projectPath = `${BASE_PATH}/${safeName}`;

    // === 1. Guardar info del proyecto ===
    const projectInfo = {
      name: name.trim(),
      description: String(description || ""),
      imageData: String(imageData || "")
    };

    const infoContent = Buffer.from(JSON.stringify(projectInfo, null, 2)).toString("base64");
    const infoPath = `${projectPath}/info.json`;
    const infoSha = await getFileSha(infoPath);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: infoPath,
      message: `Guardar proyecto: ${name}`,
      content: infoContent,
      branch: BRANCH,
      sha: infoSha,
    });

    // === 2. Guardar anotaciones ===
    for (const ann of annotations) {
      if (!ann || typeof ann.id !== "number") continue;

      const annPath = `${projectPath}/anotacion_${ann.id}.json`;
      const annContent = Buffer.from(JSON.stringify(ann, null, 2)).toString("base64");
      const annSha = await getFileSha(annPath);

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: annPath,
        message: `Anotación ${ann.id} en "${name}"`,
        content: annContent,
        branch: BRANCH,
        sha: annSha,
      });
    }

    // === Éxito ===
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: "Proyecto y anotaciones guardados correctamente en GitHub.",
        projectName: safeName
      })
    };

  } catch (error) {
    console.error("🚨 Error en save-project:", error);

    let errorMessage = "Error interno al guardar en GitHub.";
    if (error.status === 401 || error.status === 403) {
      errorMessage = "Token de GitHub inválido o sin permisos. Se requiere 'public_repo'.";
    } else if (error.status === 404) {
      errorMessage = "Repositorio o rama no encontrada. Verifica que el repo sea público.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error.toString() : undefined
      })
    };
  }
};