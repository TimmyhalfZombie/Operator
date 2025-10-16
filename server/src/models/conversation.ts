import mongoose, { Schema, Types } from 'mongoose';

export interface IConversation {
  _id: Types.ObjectId;
  members: Types.ObjectId[];           // [customerId, operatorId]
  requestId?: Types.ObjectId | null;   // optional link to assist request
  title?: string;                      // optional static title
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    members: [{ type: Schema.Types.ObjectId, ref: 'users', index: true }],
    requestId: { type: Schema.Types.ObjectId, ref: 'assistrequests', default: null, index: true },
    title: String,
    lastMessage: String,
    lastMessageAt: Date,
  },
  { timestamps: true, collection: 'conversations' }
);

export const Conversation =
  mongoose.models.conversations || mongoose.model<IConversation>('conversations', ConversationSchema);
