const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres.default:aca17f811169931b30192f92cb2ae7b3@lactamap-db.mosqueda.dev:5433/qa?schema=public",
});
client.connect()
  .then(() => {
    console.log('Connected successfully');
    return client.end();
  })
  .catch(err => {
    console.error('Connection error', err.stack);
    process.exit(1);
  });
