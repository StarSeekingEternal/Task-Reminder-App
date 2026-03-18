// send-reminders.mjs
// Scheduled Lambda (run via EventBridge every 5 minutes or hourly)
// - Queries DynamoDB GSI for overdue reminders (sent = false)
// - Sends ONE consolidated email via SES
// - Updates each task to sent = true

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// SET REGIONS LATER
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);
const sesClient = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

const TABLE_NAME = process.env.TABLE_NAME || "tasks";
const GSI_NAME = process.env.GSI_NAME || "RemindersByTime";   // ← You MUST create this GSI
// SET EMAILS LATER
const SENDER_EMAIL = process.env.SENDER_EMAIL;      // Must be verified in SES
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;

export const handler = async (event) => {
  const now = Math.floor(Date.now() / 1000);

  console.log(`Running reminder check at ${new Date().toISOString()}`);

  // ── 1. Query GSI for overdue + unsent tasks ───────────────────────
  let items = [];
  let lastEvaluatedKey = undefined;

  try {
    do {
      const queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI_NAME,
        KeyConditionExpression: "reminderBucket = :bucket AND reminderTime <= :now",
        ExpressionAttributeValues: {
          ":bucket": "reminders",
          ":now": now,
        },
        FilterExpression: "sent = :false",           // only unsent
        ExpressionAttributeValues: {
          ":false": false,
        },
        // ProjectionExpression: "taskId, title, reminderTime", // optional for performance
      });

      if (lastEvaluatedKey) {
        queryCommand.input.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(queryCommand);
      items.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (err) {
    console.error("DynamoDB Query failed:", err);
    return { statusCode: 500, message: "Failed to query reminders" };
  }

  if (items.length === 0) {
    console.log("No pending reminders to send");
    return { statusCode: 200, message: "No pending reminders" };
  }

  console.log(`Found ${items.length} overdue reminders`);

  // ── 2. Build nice email content ───────────────────────────────────
  const reminderListHtml = items
    .map((task) => {
      const dueDate = new Date(task.reminderTime * 1000).toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `<li><strong>${task.title}</strong> — due ${dueDate}</li>`;
    })
    .join("");

  const htmlBody = `
    <h2>📅 Task Reminders Due Now</h2>
    <p>You have <strong>${items.length}</strong> reminder(s) that have passed:</p>
    <ul style="line-height:1.6;">${reminderListHtml}</ul>
    <hr>
    <p><small>This email was sent automatically from your Task Reminder App.</small></p>
  `;

  const textBody = items
    .map((task) => `• ${task.title} (due ${new Date(task.reminderTime * 1000).toLocaleString()})`)
    .join("\n");

  // ── 3. Send email via SES ─────────────────────────────────────────
  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: SENDER_EMAIL,
        Destination: { ToAddresses: [RECIPIENT_EMAIL] },
        Message: {
          Subject: { Data: `🔔 ${items.length} Task Reminder${items.length > 1 ? "s" : ""}` },
          Body: {
            Html: { Data: htmlBody },
            Text: { Data: `Task Reminders:\n\n${textBody}` },
          },
        },
      })
    );
    console.log(`Email sent successfully to ${RECIPIENT_EMAIL}`);
  } catch (err) {
    console.error("SES SendEmail failed:", err);
    return { statusCode: 500, message: "Failed to send email" };
  }

  // ── 4. Mark all tasks as sent ─────────────────────────────────────
  let updatedCount = 0;
  const updatePromises = items.map(async (task) => {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { taskId: task.taskId },
          UpdateExpression: "SET sent = :sent",
          ExpressionAttributeValues: {
            ":sent": true,
          },
        })
      );
      updatedCount++;
    } catch (err) {
      console.error(`Failed to update task ${task.taskId}:`, err);
    }
  });

  await Promise.all(updatePromises);

  console.log(`Successfully updated ${updatedCount}/${items.length} tasks to sent = true`);

  return {
    statusCode: 200,
    message: `Processed ${items.length} reminders`,
    sentCount: items.length,
  };
};