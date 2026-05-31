const Redis = require("ioredis");

const redisConfig = {
  host: "127.0.0.1",
  port: 6380,
  maxRetriesPerRequest: null,
};

const connexion = new Redis(redisConfig);

module.exports = connexion;
