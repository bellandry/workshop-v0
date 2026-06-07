const express = require("express");
const pool = require("./src/config/db");
const redisConnection = require("./src/config/redis");
const loggerMiddleware = require("./src/middlewares/logger");
const rateLimiter = require("./src/middlewares/rateLimiter");
const { Queue } = require("bullmq");
const dotenv = require("dotenv");
dotenv.config();

const TicketRepository = require("./src/repositories/ticket.repository");
const TicketService = require("./src/services/ticket.service");
const TicketController = require("./src/controllers/ticket.controller");

const app = express();
const PORT = process.env.PORT;

// Middleware JSON
app.use(express.json());
app.use(loggerMiddleware);

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
app.post("/buy-tickets/:id", rateLimiter, ticketController.buyTicket);

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Le serveur est connecté sur le port ${PORT}`);
});
