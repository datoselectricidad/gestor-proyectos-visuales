const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const BRANCH = "main";
const FOLDER = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    let body;
    try {
      body = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ error: "JSON inválido" });
    }

    const { name, ...projectData } = body;
    if (!name) {
      return res.status(400).json({ error: "El nombre del proyecto es requerido" });
    }

    const fileName = name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() + ".json";
    const path = `${FOLDER}/${fileName}`;

    let sha = null;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path,
        ref: BRANCH,
      });
      sha = data.sha;
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    const content = Buffer.from(JSON.stringify(projectData, null, 2)).toString("base64");
    const commitMessage = sha ? `Actualizar proyecto: ${name}` : `Crear proyecto: ${name}`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path,
      message: commitMessage,
      content,
      branch: BRANCH,
      sha,
    });

    res.status(200).json({ success: true, message: "Proyecto guardado en GitHub", fileName });
  } catch (error) {
    console.error("Error en save-project:", error);
    res.status(500).json({ error: "Error al guardar en GitHub", details: error.message });
  }
};
