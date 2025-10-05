const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const FOLDER = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: FOLDER,
    });

    const projects = data
      .filter(file => file.name.endsWith(".json"))
      .map(file => ({
        name: file.name.replace(/\.json$/, ''),
        download_url: file.download_url,
        size: file.size,
      }));

    res.status(200).json({ projects });
  } catch (error) {
    console.error("Error en list-projects:", error);
    res.status(500).json({ error: "Error al listar proyectos", details: error.message });
  }
};
