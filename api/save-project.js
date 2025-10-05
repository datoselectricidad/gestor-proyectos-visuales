// api/save-project.js
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
  } catch (e) {
    return null; // archivo no existe
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const body = JSON.parse(req.body);
    const { name, description = "", imageData, annotations = [] } = body;
    if (!name) return res.status(400).json({ error: "Nombre del proyecto requerido" });

    const safeName = name.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    const projectPath = `${BASE_PATH}/${safeName}`;

    // Guardar info del proyecto
    const infoContent = Buffer.from(
      JSON.stringify({ name, description, imageData }, null, 2)
    ).toString("base64");
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

    // Guardar cada anotación
    for (const ann of annotations) {
      const annPath = `${projectPath}/anotacion_${ann.id}.json`;
      const annContent = Buffer.from(JSON.stringify(ann, null, 2)).toString("base64");
      const annSha = await getFileSha(annPath);
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: annPath,
        message: `Anotación ${ann.id} en ${name}`,
        content: annContent,
        branch: BRANCH,
        sha: annSha,
      });
    }

    res.status(200).json({ success: true, projectName: safeName });
  } catch (error) {
    console.error("Error en save-project:", error);
    res.status(500).json({ error: "Error al guardar en GitHub", details: error.message });
  }
};