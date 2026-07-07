# AWS Task Reminder Web App

A serverless web application that allows users to schedule email reminders for future tasks.

Built using AWS services including Lambda, API Gateway, DynamoDB, EventBridge, SES, and Amplify.

---

<img width="1917" height="1017" alt="image" src="https://github.com/user-attachments/assets/4ff449cb-5e31-4e3b-b870-cf392ca82b1b" />




---

## Overview

The AWS Task Reminder Web App allows users to create reminders by entering:

- Task name
- Reminder date and time

When the scheduled time arrives, the application automatically sends an email reminder to the user.

The application uses a fully serverless architecture, eliminating the need to manage servers while keeping infrastructure costs low.

---

## Features

- Create task reminders through a web interface
- Store reminder data in DynamoDB
- Automatically send email reminders through Amazon SES
- Serverless architecture
- Responsive frontend hosted on AWS Amplify
- Scheduled reminder processing using EventBridge

---

## Architecture

+-------------+
|   Amplify   |
+-------------+
       |
       v
+-------------+
| API Gateway |
+-------------+
       |
       v
+-------------+
|   Lambda    |
| createTask  |
+-------------+
       |
       v
+-------------+
| DynamoDB    |
+-------------+

EventBridge (hourly)
       |
       v
+-------------+
|   Lambda    |
|checkReminder|
+-------------+
       |
       v
+-------------+
| Amazon SES  |
+-------------+

## AWS Services Used

### AWS Amplify
Hosts the frontend and provides continuous deployment from GitHub.

### API Gateway
Exposes REST endpoints used by the frontend.

### AWS Lambda
Handles business logic.

Functions:

- createTask
  - Validates requests
  - Stores reminders in DynamoDB

- checkReminders
  - Runs every hour
  - Finds reminders that are due
  - Sends email notifications
  - Marks reminders as sent

### DynamoDB

Stores reminder information.

Example item:

```json
{
  "taskId": "123",
  "expireAt": "1783544400",
  "taskName": "Complete assignment",
  "reminderTime": "1783458000",
  "reminderBucket": "reminders",
  "sent": "false",
  "title": "Display Project"
}
```

### EventBridge
Triggers the reminder checking Lambda every hour

### Amazon SES
Sends reminder emails to user

## Database Design

The application uses DynamoDB as its primary datastore.

### Primary Table

Table Name: tasks

| Attribute | Purpose |
|------------|-----------|
| taskId | Unique identifier |
| title | Reminder text |
| reminderTime | Scheduled reminder timestamp |
| reminderBucket | For the GSI |
| sent | Delivery status |
| expireAt | For database cleanup |

### Global Secondary Index

GSI:
- Index name: reminder-index
- Partition key: reminder_bucket (All entries will be "reminders")
- Sort key: reminder_timestamp

This index allows efficient retrieval of reminders that are due within a specific time window.

## Why I Built This

I built this project to gain hands-on experience with AWS serverless services and event-driven architecture.

The project demonstrates:
- REST API development
- Cloud deployment
- Database design
- Event-driven processing
- Automated email workflows
- Full-stack integration
