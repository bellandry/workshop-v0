const { Worker } = require("bullmq");
const connexion = require("./config/redis");
const pool = require("./config/db");

// Simulation de la génération du PDF
const heavyPdfGeneration = (duration) => {
  const start = Date.now();
  while (Date.now() - start < duration) {}
};

// Simulation de l'attente réseau
const waitNetwork = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration));

const worker = new Worker(
  "ticket-processing",
  async (task) => {
    const client = await pool.connect();
    const { eventId, userId, quantity } = task.data;
    console.log(
      `[Worker]: Début de traiment de la tache #${task.id} pour l'utilisateur ${task.data.email}`,
    );

    await waitNetwork(100);
    heavyPdfGeneration(400);

    await client.query(
      "INSERT INTO invoices (event_id, user_id, status, quantity) VALUES ($1, $2, $3, $4)",
      [eventId, userId, "PDF_GENERATED", quantity],
    );

    console.log(
      `[Worker]: Tache #${task.id} terminée avec succès! PDF généré et mail envoyé`,
    );
    client.release();
  },
  {
    connection: connexion,
    concurrency: 2,
  },
);

worker.on("failed", (task, error) => {
  console.error(`[Worker]: La tache #${task.id} a échouée: ${error.message}`);
});
