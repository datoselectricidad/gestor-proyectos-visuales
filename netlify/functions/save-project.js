const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const BRANCH = "main";
const BASE_PATH = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

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
    if (error.status === 404) return null;
    throw error;
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { name, description = "", imageData, annotations = [] } = body;
    if (!name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Nombre del proyecto requerido" })
      };
    }

    const safeName = name.trim().replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    const projectPath = `${BASE_PATH}/${safeName}`;

    // Guardar info del proyecto
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
      sha: infoSha,
    });

    // Guardar anotaciones
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Proyecto guardado en GitHub",
        projectName: safeName
      })
    };
  } catch (error) {
    console.error("Error en save-project:", error);
    let msg = "Error interno";
    if (error.status === 401 || error.status === 403) {
      msg = "Token de GitHub inválido o sin permisos (requiere 'public_repo')";
    } else if (error.message) {
      msg = error.message;
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: msg })
    };
  }
};