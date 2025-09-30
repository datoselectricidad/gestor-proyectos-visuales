const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "anotaciones";
const FOLDER = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: "Nombre del proyecto requerido" });
  }

  const fileName = name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() + ".json";
  const path = `${FOLDER}/${fileName}`;

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });

    const content = Buffer.from(data.content, "base64").toString("utf8");
    const project = JSON.parse(content);

    res.status(200).json({ name, ...project });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    console.error("Error en get-project:", error);
    res.status(500).json({ error: "Error al obtener proyecto", details: error.message });
  }
};