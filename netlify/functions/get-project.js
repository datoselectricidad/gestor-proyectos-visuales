// netlify/functions/get-project.js
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Método no permitido" })
    };
  }

  const { name } = event.queryStringParameters;
  if (!name) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Nombre del proyecto requerido" })
    };
  }

  // Sanitizar nombre (igual que en save-project.js)
  const safeName = name.trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_-]/gi, "")
    .replace(/\s+/g, "_")
    .toLowerCase();

  if (safeName === "") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Nombre del proyecto no válido" })
    };
  }

  const projectPath = `${BASE_PATH}/${safeName}`;

  try {
    // 1. Cargar info del proyecto
    const {  infoData } = await octokit.rest.repos.getContent({
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

    // 3. Cargar solo anotaciones
    const annotations = [];
    for (const file of files) {
      if (file.type === "file" && file.name.startsWith("anotacion_") && file.name.endsWith(".json")) {
        const {  annData } = await octokit.rest.repos.getContent({
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projectInfo.name,
        description: projectInfo.description || '',
        imageData: projectInfo.imageData,
        annotations: annotations
      })
    };

  } catch (error) {
    console.error("Error en get-project:", error);

    if (error.status === 404) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Proyecto no encontrado" })
      };
    }

    let msg = "Error interno al cargar el proyecto";
    if (error.status === 403) {
      msg = "Token de GitHub sin permisos (requiere 'public_repo')";
    } else if (error.message) {
      msg = error.message;
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: msg })
    };
  }
};