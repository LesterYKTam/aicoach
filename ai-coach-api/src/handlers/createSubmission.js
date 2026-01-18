exports.handler = async (event) => {
  console.log("createSubmission event:", JSON.stringify(event));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      message: "createSubmission handler reached",
    }),
  };
};
