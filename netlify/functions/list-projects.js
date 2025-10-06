const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "datoselectricidad";
const REPO = "gestor-proyectos-visuales";
const BASE_PATH = "proyectos";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" })
    };
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: BASE_PATH,
    });

    const projects = Array.isArray(data)
      ? data.filter(item => item.type === "dir").map(dir => ({
          name: dir.name.replace(/_/g, " "),
          encodedName: dir.name,
        }))
      : [];

    return {
      statusCode: 200,
      body: JSON.stringify({ projects })
    };
  } catch (error) {
    if (error.status === 404) {
      return {
        statusCode: 200,
        body: JSON.stringify({ projects: [] })
      };
    }
    console.error("Error en list-projects:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al listar proyectos" })
    };
  }
};