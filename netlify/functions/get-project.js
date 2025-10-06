// api/get-project.js
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

  const safeName = name.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
  const projectPath = `${BASE_PATH}/${safeName}`;

  try {
    // 1. Cargar info del proyecto
    const { data: infoData } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: `${projectPath}/info.json`,
    });
    const projectInfo = JSON.parse(Buffer.from(infoData.content, "base64").toString("utf8"));

    // 2. Listar contenido de la carpeta del proyecto
    const { data: files } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: projectPath,
    });

    // 3. Filtrar y cargar solo anotaciones (.json que empiecen con "anotacion_")
    const annotations = [];
    for (const file of files) {
      if (
        file.type === "file" &&
        file.name.startsWith("anotacion_") &&
        file.name.endsWith(".json")
      ) {
        const { data: annData } = await octokit.rest.repos.getContent({
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
      description: projectInfo.description,
      imageData: projectInfo.imageData,
      annotations,
    });
  } catch (error) {
    console.error("Error en get-project:", error);
    if (error.status === 404) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    res.status(500).json({ error: "Error al cargar el proyecto" });
  }
};