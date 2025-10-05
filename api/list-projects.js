// api/list-projects.js
const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const BASE_PATH = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

module.exports = async (req, res) => {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: BASE_PATH,
    });

    // La API devuelve un array solo si es una carpeta
    const projects = Array.isArray(data)
      ? data
          .filter(item => item.type === "dir")
          .map(dir => ({
            name: dir.name.replace(/_/g, " "), // para mostrar con espacios
            encodedName: dir.name, // para uso interno
          }))
      : [];

    res.status(200).json({ projects });
  } catch (error) {
    if (error.status === 404) {
      // Carpeta 'proyectos' no existe → no hay proyectos
      return res.status(200).json({ projects: [] });
    }
    console.error("Error en list-projects:", error);
    res.status(500).json({ error: "Error al listar proyectos" });
  }
};