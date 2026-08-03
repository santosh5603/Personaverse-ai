import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ConsensusReportSchema = new Schema({
  simulationId: {
    type: Schema.Types.ObjectId,
    ref: "Simulation",
    required: true,
    index: true,
  },
  overallScores: {
    attention: { type: Number, required: true },
    trust: { type: Number, required: true },
    engagement: { type: Number, required: true },
    likelihoodToAct: { type: Number, required: true },
  },
  standoutQuotes: { type: [String], default: [] },
  insightSummary: { type: String },
  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },
  recommendations: { type: [String], default: [] },
  patterns: {
    type: {
      _id: false,
      strongestDimension: { dimension: String, value: Number },
      weakestDimension: { dimension: String, value: Number },
      bestCluster: { trait: String, mean: Number },
      worstCluster: { trait: String, mean: Number },
      polarization: Number,
    },
    default: null,
  },
  clusterBreakdown: {
    type: [
      {
        _id: false,
        trait: { type: String, required: true },
        count: { type: Number, required: true },
        avgScores: {
          attention: { type: Number },
          trust: { type: Number },
          engagement: { type: Number },
          likelihoodToAct: { type: Number },
        },
      },
    ],
    default: [],
  },
  generatedAt: { type: Date, default: Date.now },
});

export type ConsensusReportDoc = InferSchemaType<typeof ConsensusReportSchema>;

const ConsensusReport =
  (models.ConsensusReport as Model<ConsensusReportDoc>) ||
  model<ConsensusReportDoc>("ConsensusReport", ConsensusReportSchema);

export default ConsensusReport;
