// api/save-project.js
const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const BRANCH = "main";
const BASE_PATH = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Obtiene el SHA de un archivo si existe, o null si no existe.
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
    // Si el archivo no existe, GitHub devuelve 404
    if (error.status === 404) {
      return null;
    }
    // Otros errores (token inválido, etc.) se lanzan
    throw error;
  }
}

module.exports = async (req, res) => {
  // Solo permitir método POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    // Parsear cuerpo de la solicitud
    const body = JSON.parse(req.body);
    const { name, description = "", imageData, annotations = [] } = body;

    // Validar nombre del proyecto
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "El nombre del proyecto es requerido" });
    }

    // Sanitizar nombre para usarlo como carpeta (solo letras, números, guiones y guiones bajos)
    const safeName = name.trim().replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    const projectPath = `${BASE_PATH}/${safeName}`;

    // === 1. Guardar metadatos del proyecto ===
    const projectInfo = { name: name.trim(), description, imageData };
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
      sha: infoSha, // null si es nuevo
    });

    // === 2. Guardar cada anotación como archivo individual ===
    for (const ann of annotations) {
      if (!ann || typeof ann.id !== "number") continue; // saltar anotaciones inválidas

      const annPath = `${projectPath}/anotacion_${ann.id}.json`;
      const annContent = Buffer.from(JSON.stringify(ann, null, 2)).toString("base64");
      const annSha = await getFileSha(annPath);

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: annPath,
        message: `Anotación ${ann.id} en proyecto "${name}"`,
        content: annContent,
        branch: BRANCH,
        sha: annSha,
      });
    }

    // === Respuesta exitosa ===
    res.status(200).json({
      success: true,
      message: "Proyecto y anotaciones guardados correctamente en GitHub",
      projectName: safeName,
    });

  } catch (error) {
    console.error("Error en save-project:", error);

    // Devolver siempre JSON, incluso en errores
    let errorMessage = "Error interno al guardar en GitHub";
    if (error.status === 401 || error.status === 403) {
      errorMessage = "Token de GitHub inválido o sin permisos (requiere 'public_repo')";
    } else if (error.status === 404) {
      errorMessage = "Repositorio no encontrado o no accesible";
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};