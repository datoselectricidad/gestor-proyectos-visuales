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

  const { name } = event.queryStringParameters;
  if (!name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Nombre del proyecto requerido" })
    };
  }

  const safeName = name.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
  const projectPath = `${BASE_PATH}/${safeName}`;

  try {
    // Cargar info del proyecto
    const { data: infoData } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: `${projectPath}/info.json`,
    });
    const projectInfo = JSON.parse(Buffer.from(infoData.content, "base64").toString("utf8"));

    // Listar anotaciones
    const { data: files } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: projectPath,
    });

    const annotations = [];
    for (const file of files) {
      if (file.name.startsWith("anotacion_") && file.name.endsWith(".json")) {
        const { data: annData } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path: file.path,
        });
        const ann = JSON.parse(Buffer.from(annData.content, "base64").toString("utf8"));
        annotations.push(ann);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        name: projectInfo.name,
        description: projectInfo.description || '',
        imageData: projectInfo.imageData,
        annotations: annotations
      })
    };
  } catch (error) {
    if (error.status === 404) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Proyecto no encontrado" })
      };
    }
    console.error("Error en get-project:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al cargar el proyecto" })
    };
  }
};