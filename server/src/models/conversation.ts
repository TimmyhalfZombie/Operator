import mongoose, { Schema, Types } from 'mongoose';

export interface IConversation {
  _id: Types.ObjectId;
  members: Types.ObjectId[];           // [customerId, operatorId]
  requestId?: Types.ObjectId | null;   // optional link to assist request
  participantsHash: string;            // canonical "memberA:memberB" (sorted)
  title?: string;
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function makeParticipantsHash(members: Types.ObjectId[] = []): string {
  const ids = members.map(String).sort(); // stable order
  return ids.join(':');
}

const ConversationSchema = new Schema<IConversation>(
  {
    members: [{ type: Schema.Types.ObjectId, ref: 'users', index: true, required: true }],
    requestId: { type: Schema.Types.ObjectId, ref: 'assistrequests', default: null, index: true },
    participantsHash: { type: String, index: true, unique: true }, // enforce 1:1
    title: String,
    lastMessage: String,
    lastMessageAt: Date,
  },
  { timestamps: true, collection: 'conversations' }
);

ConversationSchema.pre('validate', function (next) {
  if (!this.participantsHash && Array.isArray(this.members)) {
    this.participantsHash = makeParticipantsHash(this.members as any);
  }
  next();
});

ConversationSchema.pre('save', function (next) {
  // keep hash in sync if members changed
  if (this.isModified('members')) {
    this.participantsHash = makeParticipantsHash(this.members as any);
  }
  next();
});

export const Conversation =
  mongoose.models.conversations || mongoose.model<IConversation>('conversations', ConversationSchema);
