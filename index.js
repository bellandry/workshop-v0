const express = require("express");
const { z } = require("zod");
const dotenv = require("dotenv");
const { Queue } = require("bullmq");
const connexion = require("./redis");
const pool = require("./db");
dotenv.config();

const ticketQueue = new Queue("ticket-processing", { connection: connexion });

const app = express();
app.use(express.json());

const monitorPool = () => {
  const total = pool.totalCount;
  const idle = pool.idleCount;
  const waiting = pool.waitingCount;
  const active = total - idle;

  console.clear();
  console.log(`--- Postgres Pool Status ---`);
  console.log(`Active Connexions      : ${active}`);
  console.log(`Idle Connexions        : ${idle}`);
  console.log(`Total Connexions       : ${total} / 10`);
  console.log(`Waiting Requests       : ${waiting}`);
  console.log(`----------- End ------------`);
};

setInterval(monitorPool, 1000);

// schema de validation des utilisateurs
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(12),
  age: z.number(),
});

// schema de validation d'achat de ticket
const ticketSchema = z.object({
  userId: z.number(),
  quantity: z.number(),
});

// schema de validation d'achat de ticket
const eventSchema = z.object({
  id: z.string(),
});

// Réccupérer les utilisateurs
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    const users = result.rows;

    res.json({ data: users });
  } catch (error) {
    res.status(500).json({ error: " Une erreur est survenue" });
  }
});

// Créer un utilisateur
app.post("/users", async (req, res) => {
  try {
    const validate = userSchema.parse(req.body);
    const { email, password, age } = validate;

    const verifUser = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const exist = verifUser.rows[0];

    if (exist)
      return res
        .status(400)
        .json({ error: "Cette adresse mail est déja utilisée" });

    const result = await pool.query(
      "INSERT INTO users(email, password, age) VALUES($1,$2, $3) RETURNING *",
      [email, password, age],
    );
    const newUser = result.rows[0];

    res.json({ data: newUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res
      .status(500)
      .json({ error: "Erreur lors de la création de l'utilisateur" });
  }
});

app.get("/event-tickets/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const validateEvent = eventSchema.parse(req.params);
    const { id: eventId } = validateEvent;

    // Vérifier la disponibilité dans le cache et retourner si oui
    const cachedStock = await connexion.get(`event:${eventId}:stock`);
    if (cachedStock) {
      return res.json({
        source: "cache",
        data: parseInt(cachedStock),
        memoryUsage: process.memoryUsage(),
      });
    }

    // Sinon, on lit sur le disque
    const result = await client.query(
      "SELECT total_tickets, sold_tickets FROM events WHERE id = $1",
      [eventId],
    );
    if (!result.rows[0]) {
      return res.status(404).json({
        source: "database",
        message: "Evenement non trouvé !",
        memoryUsage: process.memoryUsage(),
      });
    }

    const available =
      result.rows[0].total_tickets - result.rows[0].sold_tickets;

    // Sauvegarder l'information dans le cache
    await connexion.setex(`event:${eventId}:stock`, 30, available);

    res.json({
      source: "database",
      data: available,
      memoryUsage: process.memoryUsage(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Erreur Zod" + error.errors });
    }
    res.status(500).json({ error: "An error occured" });
  } finally {
    client.release();
  }
});

app.post("/buy-ticket/:id", async (req, res) => {
  const client = await pool.connect(); // Etablis une connexion dédiée à la transaction

  try {
    const validateEvent = eventSchema.parse(req.params);
    const { id: eventId } = validateEvent;
    const validateUser = ticketSchema.parse(req.body);
    const { userId, quantity } = validateUser;

    // Début de la transaction
    await client.query("BEGIN");

    const checkEvent = await client.query("SELECT * FROM events WHERE id =$1", [
      eventId,
    ]);
    const event = checkEvent.rows[0];

    if (!event)
      return res.status(404).json({ error: "Evenement non trouvé !" });

    const result = await client.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    const user = result.rows[0];

    if (!user)
      return res.status(404).json({ error: "Utilisateur non trouvé !" });

    // Sélectio avec vérrou pour possible rollback
    const checkAvailability = await client.query(
      "SELECT total_tickets, sold_tickets FROM events WHERE id = $1 FOR UPDATE",
      [eventId],
    );
    const availability = checkAvailability.rows[0];
    const available = availability.total_tickets - availability.sold_tickets;

    if (quantity > available) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Désolé, pas assez de billets pour cet événement" });
    }

    const newSoldTotal = availability.sold_tickets + quantity;
    await client.query("UPDATE events SET sold_tickets = $1 WHERE id = $2", [
      newSoldTotal,
      eventId,
    ]);

    await client.query("COMMIT");

    // Génération de la facture en PDF, envoi par mail
    await ticketQueue.add(
      "generate-and-send",
      {
        userId,
        eventId,
        quantity,
        email: user.email,
      },
      {
        attempts: 3,
        backoff: 5000,
      },
    );

    res.json({
      message: `Achat terminé avec succès pour l'événement: ${event.name}`,
      email: user.email,
      bought_tickets: quantity,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Erreur Zod" + error.errors });
    }
    res.status(500).json({ error: "An error occured" });
  } finally {
    client.release();
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log("Serveur démarré sur le port 3000");
});
