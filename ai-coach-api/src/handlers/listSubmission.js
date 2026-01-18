exports.handler = async (event) => {
  console.log("listSubmissions event:", JSON.stringify(event));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      message: "listSubmissions handler reached",
      items: [],
    }),
  };
};
