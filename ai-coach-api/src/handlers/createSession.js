const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  try {
    const tableName = process.env.SESSIONS_TABLE;
    if (!tableName) throw new Error("Missing env SESSIONS_TABLE");

    const body = event.body ? JSON.parse(event.body) : {};
    const { deviceId, profileId, topic } = body;

    if (!profileId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "profileId is required" }),
      };
    }

    const now = new Date().toISOString();
    const sessionId = randomUUID();

    const item = {
      sessionId,
      profileId,
      createdAt: now,      // needed for GSI1ByProfile sort key
      updatedAt: now,
      deviceId: deviceId ?? null,
      topic: topic ?? null,
      status: "active",
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        // prevent accidental overwrite if someone reuses sessionId
        ConditionExpression: "attribute_not_exists(sessionId)",
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, item }),
    };
  } catch (err) {
    console.error("createSession error:", err);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message || "Internal error" }),
    };
  }
};
