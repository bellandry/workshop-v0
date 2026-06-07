const { z, email } = require("zod");

const idSchema = z.object({
  id: z.string(),
});

const ticketSchema = z.object({
  userId: z.number(),
  quantity: z.number(),
  email: z.email(),
});

class TicketController {
  constructor(ticketService) {
    this.ticketService = ticketService;
  }

  getTickets = async (req, res, next) => {
    try {
      const validateId = idSchema.parse(req.params);
      const { id: eventId } = validateId;

      const result = await this.ticketService.getTickets(eventId);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Erreur Zod", details: error.errors });
      }

      if (error.message === "EVENT_NOT_FOUND") {
        return res.status(404).json({ error: "Evenement non trouvé" });
      }

      next(error);
    }
  };

  buyTicket = async (req, res, next) => {
    try {
      const validateId = idSchema.parse(req.params);
      const { id: eventId } = validateId;

      const validateUser = ticketSchema.parse(req.body);
      const { userId, quantity, email } = validateUser;

      const result = await this.ticketService.purchaseTicket({
        eventId,
        userId,
        quantity,
        email,
      });

      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Erreur Zod", details: error.errors });
      }

      if (error.message === "NOT_ENOUGH_TICKETS") {
        return res.status(400).json({ error: "Pas assez de tickets" });
      }

      if (error.message === "EVENT_NOT_FOUND") {
        return res.status(404).json({ error: "Evenement non trouvé" });
      }

      if (error.message === "INVALID_QUANTITY") {
        return res.status(400).json({ error: "Quantité invalide" });
      }

      if (error.message === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      next(error);
    }
  };
}

module.exports = TicketController;
