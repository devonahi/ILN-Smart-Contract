import { config } from './config.js';
import { getDb } from './database/db.js';
import { createApp } from './app.js';

const db = getDb(config.dbPath);
const app = createApp(db);

app.listen(config.port, () => {
  console.log(`ILN Indexer API running on port ${config.port}`);
});
