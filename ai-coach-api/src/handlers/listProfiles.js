const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  try {
    const tableName = process.env.PROFILES_TABLE;
    if (!tableName) throw new Error("Missing env PROFILES_TABLE");

    const qs = event.queryStringParameters || {};
    const deviceId = qs.deviceId;

    if (!deviceId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "deviceId query parameter is required",
        }),
      };
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "deviceId = :d",
        ExpressionAttributeValues: {
          ":d": deviceId,
        },
        ScanIndexForward: true, // ascending by profileId
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        items: result.Items || [],
        count: result.Count || 0,
      }),
    };
  } catch (err) {
    console.error("listProfiles error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: err.message || "Internal server error",
      }),
    };
  }
};
