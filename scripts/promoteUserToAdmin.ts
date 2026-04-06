import { db } from '../db/index';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const username = process.argv[2]?.trim();
  if (!username) {
    console.error('Uso: npm run user:promote:admin -- <username>');
    process.exit(1);
  }

  const [updated] = await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.username, username))
    .returning();

  if (!updated) {
    console.error(`Usuário não encontrado: ${username}`);
    process.exit(1);
  }

  console.log(`OK: ${updated.username} agora é admin (id=${updated.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

