import mongoose from "mongoose";
import { Settings, Service, Blog } from "../backend/src/models/index.js";
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
});
try {
  const existing = await Settings.findOne({ key: "site" }).lean();
  const patch = {
    title: "Tech Solutions",
    email: "digitalmitra786@gmail.com",
  };
  const replaceBrand = (value) =>
    value
      .replaceAll("Digital Mitra Agency", "Tech Solutions")
      .replaceAll("Tech Solution Agency", "Tech Solutions");
  for (const field of [
    "description",
    "defaultSeoTitle",
    "defaultSeoDescription",
  ])
    if (existing?.[field])
      patch[field] = replaceBrand(existing[field]);
  await Settings.updateOne({ key: "site" }, { $set: patch }, { upsert: true });
  for (const Model of [Service, Blog])
    for (const row of await Model.find({
      $or: [
        { seoTitle: /Tech Solution Agency/ },
        { seoTitle: /Digital Mitra Agency/ },
        { author: { $in: ["Tech Solution Agency", "Digital Mitra Agency"] } },
      ],
    })) {
      if (row.seoTitle) row.seoTitle = replaceBrand(row.seoTitle);
      if (row.author) row.author = replaceBrand(row.author);
      await row.save();
    }
  console.log(
    "Saved Tech Solutions name and contact email to site settings.",
  );
} finally {
  await mongoose.disconnect();
}
