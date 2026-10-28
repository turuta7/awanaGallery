/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('children', (t) => {
    t.increments('id');
    t.text('name').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('drawings', (t) => {
    t.increments('id');
    t.integer('child_id').notNullable().references('children.id').onDelete('CASCADE');
    // file_unique_id від Telegram — щоб той самий малюнок не додався двічі
    t.text('file_unique_id').notNullable().unique();
    t.text('file_id');
    t.text('filename').notNullable();
    t.integer('width');
    t.integer('height');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['child_id']);
    t.index(['created_at']);
  });

  // visitor_id — випадковий id з localStorage браузера: один лайк на малюнок від відвідувача
  await knex.schema.createTable('likes', (t) => {
    t.integer('drawing_id').notNullable().references('drawings.id').onDelete('CASCADE');
    t.text('visitor_id').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.primary(['drawing_id', 'visitor_id']);
  });

  // Хто з Telegram ввів пароль, і якій дитині зараз додає малюнки
  await knex.schema.createTable('bot_users', (t) => {
    t.bigInteger('telegram_id').primary();
    t.text('name');
    t.integer('current_child_id').references('children.id').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('bot_users');
  await knex.schema.dropTableIfExists('likes');
  await knex.schema.dropTableIfExists('drawings');
  await knex.schema.dropTableIfExists('children');
}
