const { test, describe } = require("node:test");
const assert = require("node:assert");
const TicketService = require("../services/ticket.service");

describe("TicketService - purchaseTicket()", () => {
  test("Normal case : purchase and tickets stocks available", async () => {
    const mockTicketRepo = {
      updateTicketStock: async (client, eventId, userId, quantity) => {
        return { success: true };
      },
      invalidateCache: async (eventId) => {},
    };

    // Créer un faut pool de connexion
    const mockPool = {
      connect: async () => ({
        query: async (sql) => {
          return { rows: [] };
        },
        release: () => {},
      }),
    };

    // Créer une fausse queue
    const mockTicketQueue = {
      add: async (jobName, data) => {
        return { id: "job123" };
      },
    };

    // Créer le service de ticket avec les faux objets
    const ticketService = new TicketService(
      mockTicketRepo,
      mockPool,
      mockTicketQueue,
    );

    const result = await ticketService.purchaseTicket({
      eventId: 1,
      userId: 1,
      quantity: 2,
      email: "[EMAIL_ADDRESS]",
    });

    assert.deepStrictEqual(result, { message: "Achat terminé avec succès" });
  });

  test("Error case: not enough tickets available", async () => {
    const mockTicketRepo = {
      updateTicketStock: async (client, eventId, userId, quantity) => {
        throw new Error("NOT_ENOUGH_TICKETS");
      },
      invalidateCache: async (eventId) => {},
    };

    // Créer un faut pool de connexion
    const mockPool = {
      connect: async () => ({
        query: async (sql) => {
          return { rows: [] };
        },
        release: () => {},
      }),
    };

    // Créer une fausse queue
    const mockTicketQueue = {
      add: async (jobName, data) => {
        return { id: "job123" };
      },
    };

    const ticketService = new TicketService(
      mockTicketRepo,
      mockPool,
      mockTicketQueue,
    );

    await assert.rejects(
      ticketService.purchaseTicket({
        eventId: 1,
        userId: 1,
        quantity: 2,
        email: "[EMAIL_ADDRESS]",
      }),
      { message: "NOT_ENOUGH_TICKETS" },
    );
  });
});
