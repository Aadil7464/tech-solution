import { test } from "node:test";
import assert from "node:assert/strict";
import { excelRow, syncLeadToExcel } from "../services/microsoft-excel.js";

test("Excel row maps the saved lead to the required columns", () => {
  const lead = {
    _id: "lead-123",
    createdAt: new Date("2026-11-02T10:15:00.000Z"),
    name: "Test Customer",
    email: "test@example.com",
    phone: "+91 98765 43210",
    company: "Test Company",
    service: "Website Development",
    budget: "25000-50000",
    message: "A complete test project message.",
    status: "New",
  };
  assert.deepEqual(excelRow(lead), [
    "lead-123",
    "2026-11-02T10:15:00.000Z",
    "Test Customer",
    "test@example.com",
    "+91 98765 43210",
    "Test Company",
    "Website Development",
    "25000-50000",
    "A complete test project message.",
    "New",
    "Website Contact Form",
  ]);
});

test("missing Microsoft configuration leaves synchronization pending without calling Graph", async () => {
  const result = await syncLeadToExcel({ _id: "lead-1" }, {});
  assert.deepEqual(result, { status: "pending", errorCode: "NOT_CONFIGURED" });
});
