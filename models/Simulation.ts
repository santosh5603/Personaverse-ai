import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SimulationSchema = new Schema({
  userId: { type: String, required: true, index: true },
  contentType: { type: String, enum: ["youtube", "image"], required: true },
  sourceUrl: { type: String },
  imageBase64: { type: String, required: true },
  contextText: { type: String },
  status: {
    type: String,
    enum: ["pending", "processing", "complete", "failed"],
    default: "pending",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

export type SimulationDoc = InferSchemaType<typeof SimulationSchema>;

// `models.Simulation ||` guard: re-registering a model after a dev hot reload
// throws OverwriteModelError.
const Simulation =
  (models.Simulation as Model<SimulationDoc>) ||
  model<SimulationDoc>("Simulation", SimulationSchema);

export default Simulation;
