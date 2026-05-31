const { Worker } = require("bullmq");
const connexion = require("./redis");

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
    console.log(
      `[Worker]: Début de traiment de la tache #${task.id} pour l'utilisateur ${task.data.email}`,
    );

    await waitNetwork(100);
    heavyPdfGeneration(400);

    console.log(
      `[Worker]: Tache #${task.id} terminée avec succès! PDF généré et mail envoyé`,
    );
  },
  {
    connection: connexion,
    concurrency: 2,
  },
);

worker.on("failed", (task, error) => {
  console.error(`[Worker]: La tache #${task.id} a échouée: ${error.message}`);
});
