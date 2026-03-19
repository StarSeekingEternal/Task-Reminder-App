/* The create-task Lambda function: receives task details from the frontend,
   validates and enriches the data, and saves it to DynamoDB.
*/

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

// Initialize clients (best practice: outside handler)
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "tasks";

const headers = { "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Content-Type": "application/json" };

export const handler = async (event) => {

  // ── 1. Parse incoming payload ──────────────────────────────────────

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
      headers: headers
    };
  }

  const { title, reminderTime } = body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Field 'title' is required and must be a non-empty string" }),
      headers: headers
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!reminderTime || typeof reminderTime !== "number" || reminderTime <= now) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Field 'reminderTime' is required and must be a future timestamp" }),
      headers: headers
    };
  }


  // ── 2. Enrich the item with server-side fields ──────────────────────

  const item = {
    taskId: randomUUID(),                               // primary key (string)
    title: title.trim(),                                // title of task
    reminderTime: reminderTime,                         // time to send reminder
    reminderBucket: "reminders",                        // GSI partition key for querying by reminder time
    sent: false,                                        // whether reminder has been sent
    expireAt: reminderTime + 86400                      // Set TTL to 24 hours from reminder time
  };

  // ── 3. Save to DynamoDB ─────────────────────────────────────────────

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Task reminder created successfully",
        task: item,
      }),
      headers: headers
    };
  } catch (error) {
    console.error("DynamoDB Put failed:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to save task",
        details: error.message || "Internal server error",
      }),
      headers: headers
    };
  }
};