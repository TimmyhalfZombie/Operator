import mongoose, { Schema, Types } from 'mongoose';

export interface IConversation {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];      // [customerId, operatorId]
  requestId?: Types.ObjectId | null;   // optional link to assist request
  participantsHash: string;            // canonical "memberA:memberB" (sorted)
  title?: string;
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function makeParticipantsHash(participants: Types.ObjectId[] = []): string {
  const ids = participants.map(String).sort(); // stable order
  return ids.join(':');
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'users', index: true, required: true }],
    requestId: { type: Schema.Types.ObjectId, ref: 'assistrequests', default: null, index: true },
    participantsHash: { type: String, index: true, unique: true }, // enforce 1:1
    title: String,
    lastMessage: String,
    lastMessageAt: Date,
  },
  { timestamps: true, collection: 'conversations' }
);

ConversationSchema.pre('validate', function (next) {
  if (!this.participantsHash && Array.isArray(this.participants)) {
    this.participantsHash = makeParticipantsHash(this.participants as any);
  }
  next();
});

ConversationSchema.pre('save', function (next) {
  // keep hash in sync if participants changed
  if (this.isModified('participants')) {
    this.participantsHash = makeParticipantsHash(this.participants as any);
  }
  next();
});

ConversationSchema.pre('init', function (doc) {
  const legacyMembers = Array.isArray((doc as any)?.members) ? (doc as any).members : null;
  if (legacyMembers && !Array.isArray(doc?.participants)) {
    doc.participants = legacyMembers;
  }
});

export const Conversation =
  mongoose.models.conversations || mongoose.model<IConversation>('conversations', ConversationSchema);
