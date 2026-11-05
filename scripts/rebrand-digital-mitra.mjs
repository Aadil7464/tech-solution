import mongoose from "mongoose";
import { Settings, Service, Blog } from "../backend/src/models/index.js";
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
});
try {
  const existing = await Settings.findOne({ key: "site" }).lean();
  const patch = {
    title: "Digital Mitra Agency",
    email: "digitalmitra@gmail.com",
  };
  for (const field of [
    "description",
    "defaultSeoTitle",
    "defaultSeoDescription",
  ])
    if (existing?.[field])
      patch[field] = existing[field].replaceAll(
        "Tech Solution Agency",
        "Digital Mitra Agency",
      );
  await Settings.updateOne({ key: "site" }, { $set: patch }, { upsert: true });
  for (const Model of [Service, Blog])
    for (const row of await Model.find({
      $or: [
        { seoTitle: /Tech Solution Agency/ },
        { author: "Tech Solution Agency" },
      ],
    })) {
      if (row.seoTitle)
        row.seoTitle = row.seoTitle.replaceAll(
          "Tech Solution Agency",
          "Digital Mitra Agency",
        );
      if (row.author === "Tech Solution Agency")
        row.author = "Digital Mitra Agency";
      await row.save();
    }
  console.log(
    "Saved Digital Mitra Agency name and contact email to site settings.",
  );
} finally {
  await mongoose.disconnect();
}
