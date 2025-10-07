const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const BASE_PATH = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

module.exports = async (req, res) => {
  const { name } = req.query;
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

  try {
    const {  infoData } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: `${projectPath}/info.json`,
    });
    const projectInfo = JSON.parse(Buffer.from(infoData.content, "base64").toString("utf8"));

    const {  files } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: projectPath,
    });

    const annotations = [];
    for (const file of files) {
      if (file.name.startsWith("anotacion_") && file.name.endsWith(".json")) {
        const {  annData } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path: file.path,
        });
        const ann = JSON.parse(Buffer.from(annData.content, "base64").toString("utf8"));
        annotations.push(ann);
      }
    }

    res.status(200).json({
      name: projectInfo.name,
      description: projectInfo.description || '',
      imageData: projectInfo.imageData,
      annotations: annotations
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    console.error("Error en get-project:", error);
    let msg = "Error interno";
    if (error.status === 403) {
      msg = "Token sin permisos";
    } else if (error.message) {
      msg = error.message;
    }
    res.status(500).json({ error: msg });
  }
};