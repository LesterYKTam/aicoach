// src/handlers/createProfile.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  try {
    const tableName = process.env.PROFILES_TABLE;
    if (!tableName) throw new Error("Missing env PROFILES_TABLE");

    const body = event.body ? JSON.parse(event.body) : {};
    const { deviceId, profileId, displayName, grade } = body;

    if (!deviceId || !profileId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "deviceId and profileId are required" }),
      };
    }

    const now = new Date().toISOString();

    const item = {
      deviceId,
      profileId,
      displayName: displayName ?? null,
      grade: grade ?? null,
      updatedAt: now,
      createdAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, item }),
    };
  } catch (err) {
    console.error("createProfile error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message || "Internal error" }),
    };
  }
};
