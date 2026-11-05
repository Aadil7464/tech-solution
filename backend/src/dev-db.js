import path from "node:path";
import fs from "node:fs/promises";
import { MongoMemoryServer } from "mongodb-memory-server";
// Development convenience only: the MongoDB binary runs locally with durable files.
const dbPath = path.resolve(".local-mongodb");
await fs.mkdir(dbPath, { recursive: true });
const server = await MongoMemoryServer.create({
  instance: {
    port: 27017,
    dbPath,
    storageEngine: "wiredTiger",
    dbName: "tech_solution_agency",
  },
});
console.log(
  "Local development MongoDB: " + server.getUri("tech_solution_agency"),
);
console.log(
  "Files persist in backend/.local-mongodb. Keep this terminal running.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  });
