import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import type { User } from "../schema/index.js";
import { userIdentities, users } from "../schema/index.js";

export interface TelegramUserInput {
  /** Telegram's numeric user id, as a string. */
  telegramUserId: string;
  displayName: string;
}

/**
 * Find the Timeaway user linked to this Telegram identity, creating user +
 * identity link if none exists. Display name is refreshed on change so the
 * canonical user tracks what the person currently calls themselves.
 */
export async function upsertTelegramUser(
  db: Db,
  input: TelegramUserInput,
): Promise<User> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ user: users })
      .from(userIdentities)
      .innerJoin(users, eq(userIdentities.userId, users.id))
      .where(
        and(
          eq(userIdentities.provider, "telegram"),
          eq(userIdentities.externalId, input.telegramUserId),
        ),
      );

    if (existing) {
      if (existing.user.displayName === input.displayName) return existing.user;
      const [updated] = await tx
        .update(users)
        .set({ displayName: input.displayName })
        .where(eq(users.id, existing.user.id))
        .returning();
      return updated!;
    }

    const [user] = await tx
      .insert(users)
      .values({ displayName: input.displayName })
      .returning();
    await tx.insert(userIdentities).values({
      userId: user!.id,
      provider: "telegram",
      externalId: input.telegramUserId,
    });
    return user!;
  });
}
