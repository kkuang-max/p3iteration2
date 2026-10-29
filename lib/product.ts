// Product content shown by the kiosk. Swap this file to demo a different product.

export type PartId = "tongue" | "laces" | "upper" | "toe" | "heel" | "midsole" | "outsole";

export type PartInfo = {
  id: PartId;
  label: string;
  blurb: string;
  specs: string;
};

export const PRODUCT = {
  name: "STRIDE ONE",
  tagline: "INTERACTIVE EXHIBIT",
  // Shown when no part is hovered.
  overview: {
    label: "STRIDE ONE",
    blurb: "A lightweight everyday runner built from seven parts, each tuned for comfort, support and grip.",
    specs: "[DAILY TRAINER] · 248 G · 8 MM DROP",
  },
};

export const PARTS: Record<PartId, PartInfo> = {
  tongue: {
    id: "tongue",
    label: "TONGUE",
    blurb: "Gusseted and padded so it stays centred, mile after mile.",
    specs: "[ENGINEERED MESH] · GUSSETED · 6 MM FOAM",
  },
  laces: {
    id: "laces",
    label: "LACES",
    blurb: "Flat laces that lock down without pressure points.",
    specs: "[RECYCLED POLY] · FLAT WEAVE · LOCK LOOP",
  },
  upper: {
    id: "upper",
    label: "UPPER",
    blurb: "Breathable knit that flexes exactly where your foot does.",
    specs: "[ENGINEERED KNIT] · ZONAL VENTING · 210 G",
  },
  toe: {
    id: "toe",
    label: "TOE CAP",
    blurb: "A reinforced toe box that shrugs off scuffs and stubs.",
    specs: "[TPU OVERLAY] · ABRASION GUARD",
  },
  heel: {
    id: "heel",
    label: "HEEL COUNTER",
    blurb: "Cradles your heel to keep every landing stable.",
    specs: "[MOULDED TPU] · ANTI-SLIP LINING",
  },
  midsole: {
    id: "midsole",
    label: "MIDSOLE",
    blurb: "Responsive foam that hands energy back with every step.",
    specs: "[SUPERCRITICAL FOAM] · 8 MM DROP · 38 MM STACK",
  },
  outsole: {
    id: "outsole",
    label: "OUTSOLE",
    blurb: "Rubber tread mapped to where your foot actually lands.",
    specs: "[RUBBER COMPOUND] · MULTI-DIRECTIONAL LUGS",
  },
};

// Label columns either side of the shoe, as laid out in the design.
export const LEFT_LABELS: PartId[] = ["tongue", "laces", "upper", "toe"];
export const RIGHT_LABELS: PartId[] = ["heel", "midsole", "outsole"];

// Order used when cycling (attract mode).
export const PART_ORDER: PartId[] = ["outsole", "midsole", "upper", "laces", "tongue", "heel", "toe"];
