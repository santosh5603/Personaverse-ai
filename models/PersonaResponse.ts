import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const PersonaResponseSchema = new Schema({
  simulationId: {
    type: Schema.Types.ObjectId,
    ref: "Simulation",
    required: true,
    index: true,
  },
  personaId: { type: Number, required: true },
  traits: {
    age: { type: String, required: true },
    profession: { type: String, required: true },
    personality: { type: String, required: true },
    commStyle: { type: String, required: true },
  },
  scores: {
    attention: { type: Number, min: 0, max: 100 },
    trust: { type: Number, min: 0, max: 100 },
    engagement: { type: Number, min: 0, max: 100 },
    likelihoodToAct: { type: Number, min: 0, max: 100 },
  },
  reasoning: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export type PersonaResponseDoc = InferSchemaType<typeof PersonaResponseSchema>;

const PersonaResponse =
  (models.PersonaResponse as Model<PersonaResponseDoc>) ||
  model<PersonaResponseDoc>("PersonaResponse", PersonaResponseSchema);

export default PersonaResponse;
