const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function encodeNextToken(key) {
  if (!key) return null;
  return Buffer.from(JSON.stringify(key)).toString("base64");
}

function decodeNextToken(token) {
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  try {
    const tableName = process.env.SESSIONS_TABLE;
    if (!tableName) throw new Error("Missing env SESSIONS_TABLE");

    const qs = event.queryStringParameters || {};
    const profileId = qs.profileId;
    const limit = qs.limit ? Math.min(parseInt(qs.limit, 10), 50) : 20;
    const nextToken = qs.nextToken || null;

    if (!profileId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "profileId is required" }),
      };
    }

    const exclusiveStartKey = decodeNextToken(nextToken);

    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1ByProfile",
        KeyConditionExpression: "profileId = :p",
        ExpressionAttributeValues: {
          ":p": profileId,
        },
        ScanIndexForward: false, // newest first (createdAt desc)
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey || undefined,
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        items: result.Items || [],
        count: result.Count || 0,
        nextToken: encodeNextToken(result.LastEvaluatedKey),
      }),
    };
  } catch (err) {
    console.error("listSessions error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message || "Internal error" }),
    };
  }
};
