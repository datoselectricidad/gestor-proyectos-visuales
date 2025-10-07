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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const body = JSON.parse(req.body);
    const { name, description = "", imageData, annotations = [] } = body;
    if (!name) {
      return res.status(400).json({ error: "Nombre del proyecto requerido" });
    }

    const safeName = name.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s_-]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();

    if (safeName === "") {
      return res.status(400).json({ error: "Nombre no válido" });
    }

    const projectPath = `${BASE_PATH}/${safeName}`;
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

    res.status(200).json({
      success: true,
      message: "Proyecto guardado en GitHub",
      projectName: safeName
    });
  } catch (error) {
    console.error("Error en save-project:", error);
    let msg = "Error interno";
    if (error.status === 401 || error.status === 403) {
      msg = "Token de GitHub inválido o sin permisos (requiere 'public_repo')";
    } else if (error.message) {
      msg = error.message;
    }
    res.status(500).json({ error: msg });
  }
};