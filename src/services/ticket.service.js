class TicketService {
  constructor(ticketRepository, pool, ticketQueue) {
    this.ticketRepo = ticketRepository;
    this.pool = pool;
    this.ticketQueue = ticketQueue;
  }

  async getTickets(eventId) {
    return this.ticketRepo.getAvailableTickets(eventId);
  }

  async purchaseTicket({ eventId, userId, quantity, email }) {
    if (quantity < 1) throw new Error("INVALID_QUANTITY");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await this.ticketRepo.updateTicketStock(
        client,
        eventId,
        userId,
        quantity,
      );

      await client.query("COMMIT");

      await Promise.all([
        this.ticketRepo.invalidateCache(eventId),
        this.ticketQueue.add("generate-and-send", {
          userId,
          eventId,
          quantity,
          email,
        }),
      ]);

      return { message: "Achat terminé avec succès" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = TicketService;
