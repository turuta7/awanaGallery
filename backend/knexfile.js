import 'dotenv/config';

export default {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
    loadExtensions: ['.js'],
    stub: './knex-migration.stub', // шаблон для npm run migrate:make (ES-модулі)
  },
};
