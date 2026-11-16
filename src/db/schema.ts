import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  preferredNeighborhood: text('preferred_neighborhood'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  role: text('role').notNull(), // 'user' | 'model'
  model: text('model').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const savedPlaces = pgTable('saved_places', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  query: text('query').notNull(),
  mapsUri: text('maps_uri'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const promoReels = pgTable('promo_reels', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  productId: text('product_id'),
  title: text('title').notNull(),
  caption: text('caption').notNull(),
  aspectRatio: text('aspect_ratio').notNull(), // '16:9' | '9:16'
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  chatMessages: many(chatMessages),
  savedPlaces: many(savedPlaces),
  promoReels: many(promoReels),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const savedPlacesRelations = relations(savedPlaces, ({ one }) => ({
  user: one(users, {
    fields: [savedPlaces.userId],
    references: [users.id],
  }),
}));

export const promoReelsRelations = relations(promoReels, ({ one }) => ({
  user: one(users, {
    fields: [promoReels.userId],
    references: [users.id],
  }),
}));
