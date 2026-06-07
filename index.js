const express = require("express");
const pool = require("./config/db");
const redisConnection = require("./config/redis");
const { Queue } = require("bullmq");
const dotenv = require("dotenv");
dotenv.config();

const TicketRepository = require("./repositories/ticket.repository");
const TicketService = require("./services/ticket.service");
const TicketController = require("./controllers/ticket.controller");

const app = express();
const PORT = process.env.PORT;

// Middleware JSON
app.use(express.json());

const ticketQueue = new Queue("ticket-processing", {
  connection: redisConnection,
});

// Injection de  l'architecture en couche
const ticketRepository = new TicketRepository(pool, redisConnection);
const ticketService = new TicketService(ticketRepository, pool, ticketQueue);
const ticketController = new TicketController(ticketService);

// Route pour obtenir les tickets
app.get("/event-tickets/:id", ticketController.getTickets);

// Route d'achat de billet
app.post("/buy-tickets/:id", ticketController.buyTicket);

// Middleware pour les erreurs 500
app.use((err, res) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur" });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Le serveur est connecté sur le port ${PORT}`);
});
