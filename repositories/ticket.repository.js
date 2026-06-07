class TicketRepository {
  constructor(pool, redisClient) {
    this.pool = pool;
    this.redis = redisClient;
  }

  async getAvailableTickets(eventId) {
    const cacheKey = `event:${eventId}:stock`;

    // Vérifier le cache
    const cachedStock = await this.redis.get(cacheKey);
    if (cachedStock) {
      return {
        source: "cache",
        data: parseInt(cachedStock),
      };
    }

    // Vérifier la base de données
    const result = await this.pool.query(
      "SELECT total_tickets, sold_tickets FROM events WHERE id = $1",
      [eventId],
    );

    if (result.rows.length === 0) return null;

    const { total_tickets, sold_tickets } = result.rows[0];
    const available = total_tickets - sold_tickets;

    // Sauvegarder l'information dans le cache
    await this.redis.setex(`event:${eventId}:stock`, 30, available);

    return {
      source: "database",
      data: available,
    };
  }

  async updateTicketStock(client, eventId, userId, quantity) {
    const user = await client.query(
      "SELECT * FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );

    if (user.rows.length === 0) throw new Error("USER_NOT_FOUND");

    const checkAvailability = await client.query(
      "SELECT total_tickets, sold_tickets FROM events WHERE id = $1 FOR UPDATE",
      [eventId],
    );

    if (checkAvailability.rows.length === 0) throw new Error("EVENT_NOT_FOUND");

    const { total_tickets, sold_tickets } = checkAvailability.rows[0];
    const available = total_tickets - sold_tickets;

    if (quantity > available) throw new Error("NOT_ENOUGH_TICKETS");

    const newSoldTotal = sold_tickets + quantity;

    await client.query("UPDATE events SET sold_tickets = $1 WHERE id = $2", [
      newSoldTotal,
      eventId,
    ]);

    return { success: true };
  }

  async invalidateCache(eventId) {
    const cacheKey = `event:${eventId}:stock`;
    await this.redis.del(cacheKey);
  }
}

module.exports = TicketRepository;
