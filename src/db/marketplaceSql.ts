import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { chatMessages, promoReels, savedPlaces, users } from './schema.ts';

export async function getUserChatHistory(uid: string) {
  try {
    return await db
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        model: chatMessages.model,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(chatMessages.id);
  } catch (error) {
    console.error('Database query failed in getUserChatHistory:', error);
    throw new Error('Unable to load conversation history right now.', { cause: error });
  }
}

export async function appendChatMessages(
  userId: number,
  entries: { role: string; model: string; content: string }[]
) {
  if (entries.length === 0) return [];
  try {
    return await db
      .insert(chatMessages)
      .values(
        entries.map((entry) => ({
          userId,
          role: entry.role,
          model: entry.model,
          content: entry.content,
        }))
      )
      .returning();
  } catch (error) {
    console.error('Database query failed in appendChatMessages:', error);
    throw new Error('Unable to save conversation messages.', { cause: error });
  }
}

export async function clearUserChatHistory(userId: number) {
  try {
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  } catch (error) {
    console.error('Database query failed in clearUserChatHistory:', error);
    throw new Error('Unable to clear conversation history.', { cause: error });
  }
}

export async function getSavedPlaces(uid: string) {
  try {
    return await db
      .select({
        id: savedPlaces.id,
        title: savedPlaces.title,
        query: savedPlaces.query,
        mapsUri: savedPlaces.mapsUri,
        notes: savedPlaces.notes,
        createdAt: savedPlaces.createdAt,
      })
      .from(savedPlaces)
      .innerJoin(users, eq(savedPlaces.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(savedPlaces.id));
  } catch (error) {
    console.error('Database query failed in getSavedPlaces:', error);
    throw new Error('Unable to load saved Hawassa places.', { cause: error });
  }
}

export async function saveGroundedPlace(
  userId: number,
  place: { title: string; query: string; mapsUri?: string | null; notes?: string | null }
) {
  try {
    const result = await db
      .insert(savedPlaces)
      .values({
        userId,
        title: place.title,
        query: place.query,
        mapsUri: place.mapsUri ?? null,
        notes: place.notes ?? null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in saveGroundedPlace:', error);
    throw new Error('Unable to save place bookmark.', { cause: error });
  }
}

export async function deleteSavedPlace(userId: number, placeId: number) {
  try {
    await db
      .delete(savedPlaces)
      .where(and(eq(savedPlaces.id, placeId), eq(savedPlaces.userId, userId)));
  } catch (error) {
    console.error('Database query failed in deleteSavedPlace:', error);
    throw new Error('Unable to delete saved place.', { cause: error });
  }
}

export async function getPromoReels(uid: string) {
  try {
    return await db
      .select({
        id: promoReels.id,
        productId: promoReels.productId,
        title: promoReels.title,
        caption: promoReels.caption,
        aspectRatio: promoReels.aspectRatio,
        createdAt: promoReels.createdAt,
      })
      .from(promoReels)
      .innerJoin(users, eq(promoReels.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(promoReels.id));
  } catch (error) {
    console.error('Database query failed in getPromoReels:', error);
    throw new Error('Unable to load saved promo reels.', { cause: error });
  }
}

export async function recordPromoReel(
  userId: number,
  reel: { productId?: string | null; title: string; caption: string; aspectRatio: string }
) {
  try {
    const result = await db
      .insert(promoReels)
      .values({
        userId,
        productId: reel.productId ?? null,
        title: reel.title,
        caption: reel.caption,
        aspectRatio: reel.aspectRatio,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in recordPromoReel:', error);
    throw new Error('Unable to save promo reel metadata.', { cause: error });
  }
}
